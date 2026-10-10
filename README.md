# Crewcut

Short hair, short code, proper structure.

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

See [INSTALL.md](INSTALL.md).

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
