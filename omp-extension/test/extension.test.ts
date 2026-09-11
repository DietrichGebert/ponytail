import { afterEach, beforeEach, expect, test } from "bun:test";
import type { ExtensionAPI, ExtensionCommandContext } from "@oh-my-pi/pi-coding-agent";
import { getActiveSkills, setActiveSkills, type Skill } from "@oh-my-pi/pi-coding-agent/extensibility/skills";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ponytailExtension from "../index";

const aliases = ["ponytail-review", "ponytail-audit", "ponytail-gain", "ponytail-debt", "ponytail-help"];
const root = fileURLToPath(new URL("../../", import.meta.url));
const environmentKeys = ["XDG_CONFIG_HOME", "PONYTAIL_DEFAULT_MODE", "PONYTAIL_QUIET_STARTUP"];
let directory: string;
let previousEnvironment: (string | undefined)[];
let previousSkills: readonly Skill[];

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "ponytail-omp-"));
  previousEnvironment = environmentKeys.map((key) => process.env[key]);
  previousSkills = getActiveSkills();
  process.env.XDG_CONFIG_HOME = directory;
  delete process.env.PONYTAIL_DEFAULT_MODE;
  delete process.env.PONYTAIL_QUIET_STARTUP;
  setActiveSkills(aliases.map((name) => {
    const baseDir = join(root, "skills", name);
    return { name, description: name, baseDir, filePath: join(baseDir, "SKILL.md"), source: "test" };
  }));
});

afterEach(() => {
  setActiveSkills(previousSkills);
  environmentKeys.forEach((key, index) => {
    if (previousEnvironment[index] === undefined) delete process.env[key];
    else process.env[key] = previousEnvironment[index];
  });
  rmSync(directory, { recursive: true, force: true });
});

type EventResult = { systemPrompt: string[] } | void;
type Handler = (event: object, ctx: ExtensionCommandContext) => EventResult | Promise<EventResult>;
type Command = { handler: (args: string, ctx: ExtensionCommandContext) => void | Promise<void> };

function harness() {
  const events = new Map<string, Handler>();
  const commands = new Map<string, Command>();
  const messages: { text: string; options?: { deliverAs?: string } }[] = [];
  const notices: { message: string; level: string }[] = [];
  let manager = SessionManager.inMemory(directory);
  let idle = true;
  let trusted = true;
  // Only the native API surface exercised by this extension is supplied here.
  const ctx = {
    get sessionManager() { return manager; },
    cwd: directory,
    hasUI: true,
    isIdle: () => idle,
    isProjectTrusted: () => trusted,
    ui: { notify: (message: string, level: string) => notices.push({ message, level }) },
  } as unknown as ExtensionCommandContext;
  const api = {
    on: (name: string, handler: Handler) => events.set(name, handler),
    registerCommand: (name: string, command: Command) => commands.set(name, command),
    appendEntry: (name: string, data: unknown) => manager.appendCustomEntry(name, data),
    sendUserMessage: (text: string, options?: { deliverAs?: string }) => messages.push({ text, options }),
  } as unknown as ExtensionAPI;
  ponytailExtension(api);
  return {
    ctx, messages, notices,
    get manager() { return manager; },
    set manager(value) { manager = value; },
    set idle(value: boolean) { idle = value; },
    set trusted(value: boolean) { trusted = value; },
    emit: (name: string, event: object = {}) => events.get(name)!(event, ctx),
    command: (name: string, args = "") => commands.get(name)!.handler(args, ctx),
    async prompt(systemPrompt = ["BASE"]) {
      const result = await events.get("before_agent_start")!({ systemPrompt, prompt: "Implement a feature" }, ctx);
      return result?.systemPrompt ?? systemPrompt;
    },
  };
}

test("user stop commands disable policy, but extension input and quoted requests do not", async () => {
  const h = harness();
  await h.emit("session_start");
  for (const [source, text] of [["interactive", "STOP PONYTAIL!"], ["rpc", " normal mode. "]]) {
    await h.command("ponytail", "ultra");
    await h.emit("input", { source: "extension", text });
    await h.emit("input", { source, text: "Add a normal mode toggle; do not stop ponytail" });
    expect((await h.prompt()).join("\n")).toContain("level: ultra");
    await h.emit("input", { source, text });
    expect(await h.prompt()).toEqual(["BASE"]);
  }
});

test("defaults affect new sessions without leaking modes across switches", async () => {
  const h = harness();
  await h.emit("session_start");
  const first = h.manager;
  await h.command("ponytail", "off");
  await h.command("ponytail", "default lite");
  h.manager = SessionManager.inMemory(directory);
  await h.emit("session_switch");
  expect((await h.prompt()).join("\n")).toContain("level: lite");
  const second = h.manager;
  await h.command("ponytail", "ultra");
  h.manager = first;
  await h.emit("session_switch");
  expect(await h.prompt()).toEqual(["BASE"]);
  h.manager = second;
  await h.emit("session_switch");
  expect((await h.prompt()).join("\n")).toContain("level: ultra");
});

test("tree navigation and branching use only the active branch, including after compaction", async () => {
  const h = harness();
  await h.emit("session_start");
  const start = h.manager.getLeafId()!;
  await h.command("ponytail", "off");
  const disabled = h.manager.getLeafId()!;
  h.manager.branch(start);
  await h.emit("session_tree");
  expect((await h.prompt()).join("\n")).toContain("level: full");
  await h.command("ponytail", "lite");
  h.manager.branch(disabled);
  await h.emit("session_tree");
  expect(await h.prompt()).toEqual(["BASE"]);
  h.manager.createBranchedSession(start);
  await h.emit("session_branch");
  expect((await h.prompt()).join("\n")).toContain("level: full");
  await h.command("ponytail", "off");
  h.manager.appendCompaction("Compacted conversation", undefined, start, 100);
  await h.emit("session_compact");
  await h.emit("session_start");
  expect(await h.prompt()).toEqual(["BASE"]);
});

test("restoration ignores malformed state and accepts the legacy review mode", async () => {
  const h = harness();
  h.manager.appendCustomEntry("ponytail-mode", { mode: "review" });
  h.manager.appendCustomEntry("ponytail-mode", { mode: "invalid" });
  h.manager.appendCustomEntry("ponytail-mode", null);
  await h.emit("session_start");
  expect((await h.prompt()).join("\n")).toContain("level: review");
  await h.command("ponytail", "default review");
  expect(h.notices.at(-1)?.level).toBe("warning");
  expect((await h.prompt()).join("\n")).toContain("level: review");
});

test("bare activation, status, defaults, and environment overrides retain their distinct effects", async () => {
  const h = harness();
  await h.emit("session_start");
  await h.command("ponytail", "LiTe");
  await h.command("ponytail", "default off");
  await h.command("ponytail", "status");
  expect(h.notices.at(-1)?.message).toContain("current lite");
  expect(h.notices.at(-1)?.message).toContain("default off");
  await h.command("ponytail");
  expect((await h.prompt()).join("\n")).toContain("level: full");
  process.env.PONYTAIL_DEFAULT_MODE = "ultra";
  await h.command("ponytail", "default lite");
  expect(JSON.parse(readFileSync(join(directory, "ponytail/config.json"), "utf8")).defaultMode).toBe("lite");
  expect(h.notices.at(-1)?.message).toContain("env override");
  await h.command("ponytail");
  expect((await h.prompt()).join("\n")).toContain("level: ultra");
});

test("saving a default reports filesystem errors without altering the running mode", async () => {
  const h = harness();
  await h.emit("session_start");
  const blocked = join(directory, "not-a-directory");
  writeFileSync(blocked, "file");
  process.env.XDG_CONFIG_HOME = blocked;
  await h.command("ponytail", "default off");
  expect(h.notices.at(-1)?.level).toBe("error");
  expect((await h.prompt()).join("\n")).toContain("level: full");
});

test("system policy replaces only its own array block and removes it when disabled", async () => {
  const h = harness();
  const base = ["BASE", "<other-extension>unchanged</other-extension>"];
  const first = await h.prompt(base);
  await h.command("ponytail", "ultra");
  const updated = await h.prompt(first);
  expect(updated.slice(0, -1)).toEqual(base);
  expect(updated.at(-1)).toContain("level: ultra");
  expect(await h.prompt(updated)).toEqual(updated);
  expect(base).toEqual(["BASE", "<other-extension>unchanged</other-extension>"]);
  await h.command("ponytail", "off");
  expect(await h.prompt(updated)).toEqual(base);
});

test("all five aliases send actual active skill bodies, user provenance and args idle or busy", async () => {
  const h = harness();
  setActiveSkills(aliases.map((name) => {
    const filePath = join(directory, `${name}.md`);
    writeFileSync(filePath, `---\nname: ${name}\ndescription: Active skill fixture\n---\nInspect the ${name} fixture boundary before editing.\n`);
    return { name, description: "Active skill fixture", baseDir: directory, filePath, source: "test" };
  }));
  for (const idle of [true, false]) {
    h.idle = idle;
    for (const name of aliases) {
      const skill = getActiveSkills().find((candidate) => candidate.name === name)!;
      await h.command(name, "  inspect src/parser.ts --strict  ");
      const sent = h.messages.at(-1)!;
      expect(sent.text).toContain(`Inspect the ${name} fixture boundary before editing.`);
      expect(sent.text).toContain('User invoked the "' + name + '" skill');
      expect(sent.text).toContain(skill.baseDir);
      expect(sent.text).toContain("User: inspect src/parser.ts --strict");
      expect(sent.text.startsWith("/skill:")).toBe(false);
      expect(sent.options?.deliverAs).toBe(idle ? undefined : "followUp");
    }
  }
});

test("aliases respect active skill selection and recover from missing or unreadable skills", async () => {
  const h = harness();
  const name = "ponytail-review";
  const filePath = join(directory, "SKILL.md");
  setActiveSkills([]);
  await h.command(name);
  expect(h.messages).toEqual([]);
  expect(h.notices.at(-1)?.level).toBe("warning");
  setActiveSkills([{ name, description: "Override", baseDir: dirname(filePath), filePath, source: "test" }]);
  await h.command(name);
  expect(h.messages).toEqual([]);
  expect(h.notices.at(-1)?.level).toBe("error");
  writeFileSync(filePath, "---\nname: ponytail-review\ndescription: Override\n---\nReview only the active override.\n");
  await h.command(name, "src/active.ts");
  expect(h.messages.at(-1)?.text).toContain("Review only the active override.");
  expect(h.messages.at(-1)?.text).toContain("User: src/active.ts");
});

test("an untrusted project skill is refused without blocking user-installed skills", async () => {
  const h = harness();
  const skill = getActiveSkills()[0];
  setActiveSkills([{ ...skill, _source: { provider: "test", providerName: "Test", level: "project", path: skill.filePath } }]);
  h.trusted = false;
  await h.command(skill.name);
  expect(h.messages).toEqual([]);
  expect(h.notices.at(-1)?.level).toBe("warning");
  setActiveSkills([{ ...skill, _source: { provider: "test", providerName: "Test", level: "user", path: skill.filePath } }]);
  await h.command(skill.name);
  expect(h.messages.at(-1)?.text).toContain('User invoked the "' + skill.name + '" skill');
});

test("quiet startup suppresses the toast but not the policy", async () => {
  process.env.PONYTAIL_QUIET_STARTUP = "1";
  const h = harness();
  await h.emit("session_start");
  expect(h.notices).toEqual([]);
  expect((await h.prompt()).join("\n")).toContain("level: full");
});
