# Crewcut

**Short grey hair, short code, proper structure.**

You know him. Grey crew cut. Has seen every framework come and go. He writes less code than you, but every class has one job and every dependency comes through the constructor.

Crewcut is a plugin for Claude Code and GitHub Copilot. It makes the agent write the smallest change that fully solves the task, as proper object-oriented code.

Crewcut is a fork of [ponytail](https://github.com/DietrichGebert/ponytail) by Dietrich Gebert. Ponytail pushes hard for minimal code. Crewcut keeps that, but does not count structure as bloat.

## What crewcut adds to ponytail

- **No static services.** Static members only for pure functions, extension methods, constants and factory methods. A class that does I/O or holds state is an instance class.
- **Constructor injection.** Dependencies come in through the constructor. Use the platform's DI container when the app already has one. Otherwise wire by hand in `Main`.
- **Interfaces where substitution is needed.** A dependency that a caller or a test must replace gets an interface, even with one implementation.
- **Composition over inheritance.** Classes are not sealed by default.
- **One responsibility per class, one type per file, records for data.**
- **Unit tests in the project's test framework**, with the project's mocking library (NSubstitute for new .NET projects).
- **Existing code is flagged, not rewritten.** New code follows the rules. A violation in old code is named in one line and refactored only on request.

The object-oriented rules apply to C#, Java, Kotlin, TypeScript and other OO languages. Standalone scripts and microcontroller firmware are exempt.

Everything else comes from ponytail: read the code first, reuse what exists, prefer the standard library, add no unrequested features, fix bugs at the root cause, and never cut validation, error handling, security or accessibility.

The full rules are in [`skills/crewcut/SKILL.md`](skills/crewcut/SKILL.md).

## Install

Claude Code:

```
/plugin install crewcut --marketplace HermitOS/crewcut
```

Older Claude Code versions, GitHub Copilot and settings: see [INSTALL.md](INSTALL.md).

## What the plugin does on your machine

Crewcut runs three Node.js hooks from the plugin folder. It sends nothing over the network and fetches nothing.

| Hook               | What it does |
|--------------------|--------------|
| `SessionStart`     | Adds the crewcut rules to the session context. Adds a short map of the project's top-level classes and functions, built from `git ls-files` and a regex per language, so existing code is reused. |
| `SubagentStart`    | Adds the same rules to each subagent. Limit this with `CREWCUT_SUBAGENT_MATCHER`. |
| `UserPromptSubmit` | Detects level switches (`/crewcut lite`, "stop crewcut") and records the level. |

Files it writes, all outside the plugin folder:

| File | Purpose |
|------|---------|
| `~/.claude/.crewcut-active` | The current level, read by the statusline. |
| `~/.claude/crewcut-modes/<hash>` | The level per project, keyed by a SHA-256 hash of the project path. |
| `~/.claude/crewcut-statusline.sh` or `.ps1` | A copy of the statusline script, so it survives plugin updates. |
| `~/.claude/.crewcut-statusline-nudged` | Marks that the statusline setup was offered once. |
| `~/.config/crewcut/config.json` (`%APPDATA%\crewcut\config.json` on Windows) | The default level, only when you run `/crewcut default <level>`. |

`~/.claude` is replaced by `CLAUDE_CONFIG_DIR` when that is set.

**Statusline offer:** if you have no `statusLine` in `~/.claude/settings.json`, the first session asks the agent to offer adding one that runs the copied statusline script. Nothing is changed unless you accept. Crewcut makes this offer only once.

To remove all of these files, run `node scripts/uninstall.js` before uninstalling the plugin.

## Commands

| Command          | What it does                                                         |
|------------------|----------------------------------------------------------------------|
| `/crewcut`       | Switch the level: `lite`, `full` (default), `ultra`, or `off`.       |
| `/crewcut-review`| Review of the current change: bugs, risk, load, tests, speed, lean, structure. |
| `/crewcut-audit` | The same review for the whole repo.                                  |
| `/crewcut-debt`  | Collect `shortcut:` comments into a list of known shortcuts.         |
| `/crewcut-help`  | Quick reference.                                                     |

## Upstream

`main` holds crewcut. Upstream changes are merged in from the `upstream` remote:

```bash
git remote add upstream https://github.com/DietrichGebert/ponytail.git
git fetch upstream
git merge upstream/main
```

Expect conflicts in the rule files and in anything renamed from `ponytail` to `crewcut`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

MIT. See [LICENSE](LICENSE). Original work copyright Dietrich Gebert.
