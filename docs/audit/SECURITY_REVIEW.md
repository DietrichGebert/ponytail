# Ponytail Security Review — 2026-10-25

Threat model: ponytail hooks run **inside users' coding agents** with the agent's own privileges, on every session start and prompt submit, on macOS/Linux/Windows. Untrusted inputs: agent-provided JSON on stdin, workspace/repository content (via the map and the band import reading Claude session transcripts), `settings.json`/`hooks.json` contents, environment variables, and the plugin's own install path. Primary risks reviewed: shell injection through hook commands, path traversal, ReDoS, instruction-context injection from repo content, secret exposure, supply chain.

## Findings and mitigations (verified in source)

**No high-risk findings.** Controls verified present and correct:

1. **Shell injection** — every subprocess call uses argument arrays (`execFileSync`/`spawnSync` with argv, `spawn` detached): `ponytail-activate.js:67`, `ponytail-map.js:42`, `ponytail-band-import.js:204`. The two places a path is interpolated into a shell command string (statusline snippet, cursor `hooks.json` entries) are guarded by the `isShellSafe` character allowlist (`ponytail-config.js:47`), with a refuse-and-instruct fallback rather than escaping. Verified live: statusline setup works on this machine.
2. **ReDoS** — the user-supplied `PONYTAIL_SUBAGENT_MATCHER` regex is tested under `vm.runInNewContext(..., { timeout: 100 })` with fail-open, so a catastrophic-backtracking regex cannot block the hook (`ponytail-subagent.js`, #658).
3. **Path handling** — all writes are anchored at `os.homedir()`/env-config dirs; the statusline copy uses temp+`rename` with `COPYFILE_EXCL` (no write-through-symlink, no half-written script); per-project mode keys are sha256 of the normalized path (no traversal via `CLAUDE_PROJECT_DIR`).
4. **Untrusted JSON** — BOM-stripped before `JSON.parse` (Windows pipes); malformed payloads fail open to "inject" so scoping never silently drops the persona; `cursor-hooks.js` refuses to touch a malformed `hooks.json` rather than overwrite it.
5. **Fail-open philosophy is availability-correct** — every hook failure mode degrades to "no ruleset this turn," never to a blocked session; none of the fail-open paths bypass a security control (the ruleset is advisory guidance, not an authorization boundary).
6. **Secrets** — grep across hooks/scripts/skills/pi-extension found no credentials; `.gitignore` excludes `.env*` (with `!.env.example`); no tokens in logs; error paths truncate (`slice(0,500)`).
7. **Supply chain** — zero runtime dependencies; devDependency-free test run (`node --test` only); CI uses least-privilege (`contents: read`) with all three actions pinned by full SHA (`test.yml`); `npm pack` contents match the declared `files` list (46 files).
8. **Privacy** — `ponytail-band-import.js` reads only `~/.claude/projects/**/*.jsonl` (the user's own transcripts), excludes temp-dir sessions, writes aggregates (session id, project basename, tokens/cost numbers) to the user's own config dir. No network egress anywhere in shipped code.
9. **Instruction-injection surface** — the map hook (`ponytail-map.js`) reads workspace file *names* and export/function *identifiers* only (regex per language, `SAFE_PATH` allowlist, 2000-char budget), not file bodies; identifiers cannot carry instructions through the `NAME` regex. Session-transcript parsing in band-import extracts typed fields via anchored regex, never re-emits transcript content to the model.

## Residual risks (documented, accepted)

- **R-1 (P3)**: `scripts/publish-openclaw-skills.js` builds a `shell:true` command line with a minimal `quote()` (POSIX-unsafe for `$`/backtick inside double quotes). Maintainer-only, not shipped, args are repo-controlled plus the maintainer's own passthrough — the "attacker" is the maintainer misquoting their own flags. Accepted; a full escaper would be unneeded machinery (ponytail rule 1).
- **R-2 (P3)**: `benchmarks/correctness.js` executes model-generated Python in a temp file with `execSync` — by design (it is a correctness benchmark); the module ships nowhere (`package.json#files` excludes `benchmarks/`), and the harness chdir's to the temp dir. CI-only surface.
- **R-3 (observation)**: hooks trust `CLAUDE_CONFIG_DIR`/`PLUGIN_DATA`/etc. env vars for state location. An attacker who controls a user's environment variables already outranks ponytail's threat model.

## Verification commands actually run

- Full source review of every shipped executable: `hooks/*.js` (8), `hooks/band/*` (5), `scripts/{uninstall,cursor-hooks}.js`, `pi-extension/index.js`, `.opencode/plugins/ponytail.mjs`, `__init__.py` (Hermes), statusline `.sh`+`.ps1`.
- `grep -rniE "password|secret|api[_-]key|token"` over shipped code — no hits beyond token-count prose.
- Live hook execution on Windows (see AUDIT_REPORT §3).
- `npm pack --dry-run` file-set verification.

Skipped: no dynamic security scanner exists in-repo and none was installed (zero-dep project; a scanner would add supply-chain surface to a package whose value is having none).
