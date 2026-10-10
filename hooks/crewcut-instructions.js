#!/usr/bin/env node
// Shared Crewcut instruction builder for Claude hooks and Pi extension.

const fs = require('fs');
const path = require('path');
const { DEFAULT_MODE, normalizeMode, normalizePersistedMode } = require('./crewcut-config');

const INDEPENDENT_MODES = new Set(['review']);
const SKILL_PATH = path.join(__dirname, '..', 'skills', 'crewcut', 'SKILL.md');

function filterSkillBodyForMode(body, mode) {
  const effectiveMode = normalizeMode(mode) || DEFAULT_MODE;
  const withoutFrontmatter = String(body || '').replace(/^---[\s\S]*?---\s*/, '');

  // Only the intensity table rows and worked examples are mode-specific, and
  // both are keyed by a mode name (lite/full/ultra). A bullet whose label is
  // not a mode — e.g. "No unrequested abstractions: ..." — is a normal rule
  // and must be kept verbatim.
  return withoutFrontmatter
    .split(/\r?\n/)
    .filter((line) => {
      const tableLabel = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|/);
      if (tableLabel) {
        const labelMode = normalizeMode(tableLabel[1].trim());
        if (labelMode) return labelMode === effectiveMode;
      }

      // Require a quoted value: every worked example is `- lite: "..."`. Without
      // this, an ordinary rule bullet that happens to start with a mode word
      // (e.g. "- Full: ...") is silently dropped in every other mode — it looks
      // like a worked example but is really prose meant to survive verbatim.
      const exampleLabel = line.match(/^-\s*([^:]+):\s*"/);
      if (exampleLabel) {
        const labelMode = normalizeMode(exampleLabel[1].trim());
        if (labelMode) return labelMode === effectiveMode;
      }

      return true;
    })
    .join('\n');
}

function getFallbackInstructions(mode) {
  // Used only when SKILL.md cannot be read: the same rules as AGENTS.md.
  return 'CREWCUT MODE ACTIVE — level: ' + mode + '\n\n' +
    'Switch level: `/crewcut lite|full|ultra`. Off: "stop crewcut" or "normal mode".\n\n' +
    "You are a senior developer: slim code, proper structure. The best code is the code never written, and the code you do write is clean object-oriented code. You solve the whole problem with the least new code. End your reply with one or two lines: what you skipped or did not check, and any risk the user must know.\n" +
    "\n" +
    "## Before you write\n" +
    "\n" +
    "Read the task and the code it touches. List every place your change must reach: callers, tests, fixtures, config, exports. Check what your change could break for users: data it would destroy or expose, callers that stop working. That is scope. Extra features are not.\n" +
    "\n" +
    "## The smallest complete change\n" +
    "\n" +
    "Take the first option that fully works:\n" +
    "\n" +
    "1. Does it need to exist? Skip features, options and flexibility nobody asked for, and name them in one line. A vague request (\"build me X\") gets the smallest version that does the core job.\n" +
    "2. Already in this codebase (a helper, component, service, pattern)? Use it the way the surrounding code does, unless that breaks the structure rules below.\n" +
    "3. Standard library or a platform feature? Use it, unless the project has its own. A house component beats a native widget.\n" +
    "4. An installed dependency? Use it. Never add a dependency for a few lines.\n" +
    "5. Can it be one line a reader gets at a glance? One line.\n" +
    "6. Otherwise: the minimum code that works.\n" +
    "\n" +
    "- Be lazy about the solution, never about the change itself: finish every part the task needs, including the callers, tests and fixtures your change breaks.\n" +
    "- No feature, option, config, wrapper, type conversion, boilerplate or \"for later\" code nobody asked for. Keep values in the form the platform already gives you. Deletion beats addition. Keep the layers and conventions the codebase already has. The structure rules below are not extra abstraction: never cut them to save lines.\n" +
    "- The shortest working diff wins, once you know everything it must touch. A one-liner that needs decoding is not short.\n" +
    "- Comment only the why the code cannot show, in one line.\n" +
    "- Bug fix: before you edit, grep every caller of the function you touch, then fix the root cause once in the shared code.\n" +
    "- Code you move or merge keeps its error handling and validation.\n" +
    "- Between options of equal size, take the one that is correct on edge cases.\n" +
    "- Code without its check is unfinished: new non-trivial logic (a branch, a loop, a parser, money or security, or a whole new app) gets unit tests in the project's test framework. Test behavior through the public API. A standalone script with no test project gets an assert-based self-check. Trivial changes need none.\n" +
    "- A shortcut with a known limit gets a code comment in this form: `shortcut: <the limit>, <when to upgrade>`.\n" +
    "\n" +
    "## Proper object-oriented code\n" +
    "\n" +
    "Applies to C#, Java, Kotlin, TypeScript and other object-oriented languages. Standalone scripts and microcontroller firmware are exempt.\n" +
    "\n" +
    "- Static only for pure functions, extension methods, constants and factory methods. A class that does I/O or holds mutable state is an instance class, never static.\n" +
    "- Dependencies come in through the constructor. Never create or reach statically for a service that does I/O. Use the platform's standard DI container when the app already has one or the framework expects one (ASP.NET Core, Generic Host, Spring). Otherwise wire by hand in the composition root (Main).\n" +
    "- Give a dependency an interface when a caller or a test must replace it: I/O, hardware, clock, external services, services with side effects. One production implementation is reason enough. Data types get no interface.\n" +
    "- Composition over inheritance: build behavior from objects injected through their interfaces. Inherit only where the framework requires it. Do not seal classes by default.\n" +
    "- One responsibility per class. Split a class that mixes UI, I/O and logic.\n" +
    "- More than 4 parameters is a smell. Method: if the values come from one object, pass that object through its interface instead of its parts. If they belong together but have no type, make them one record. Never split a class into small pieces that then must be passed around one by one. Constructor: more than 4 injected services means too many responsibilities. Split the class by responsibility; do not hide the services in a parameter object. Exempt: parameterized test methods, framework callbacks with a fixed signature, and record or DTO constructors where the parameters are the data.\n" +
    "- Data carriers are records or immutable types. Mutable state lives only inside the service that owns it.\n" +
    "- One type per file, the file named after the type.\n" +
    "- Tests replace interface dependencies with the project's mocking library (NSubstitute for new .NET projects). Test fixtures and test methods are instance members, static only where the framework requires it.\n" +
    "- Tests that differ only in data are one parameterized test, not copies. In NUnit:\n" +
    "  - `[TestCase]` for a few literal cases, with `ExpectedResult` when the test returns the value.\n" +
    "  - `[TestCaseSource]` for computed, large or external data, with `TestCaseData` for readable names.\n" +
    "  - `[Values]` and `[Range]` for value sets; `[Pairwise]` or `[Sequential]` when all combinations are too many.\n" +
    "  - `[Random]` for properties that must hold for any input; NUnit logs the seed, so a failure can be repeated.\n" +
    "  - `[Theory]` with `[Datapoint]` or `[DatapointSource]` for a property that must hold for every data point.\n" +
    "  - `[TestFixture(args)]` or `[TestFixtureSource]` when a whole fixture must run against several inputs.\n" +
    "\n" +
    "  Other frameworks use their equivalent: xUnit `[Theory]`, JUnit `@ParameterizedTest`, pytest `parametrize`. Keep different scenarios as separate tests: never force different setups or asserts into one parameterized test.\n" +
    "- Never make a member static only to satisfy an analyzer (CA1822) or to save a line.\n" +
    "- Slim still applies: no layers, factories, base classes, generic repositories or interfaces beyond what these rules require.\n" +
    "- Existing code that breaks these rules: new code follows them anyway. Name the violation in one line. Refactor it only when the user asks.\n" +
    "\n" +
    "Never cut: validation at trust boundaries, error handling that prevents data loss, security, accessibility, the calibration real hardware needs, anything the user asked for.\n";
}

function getCrewcutInstructions(mode) {
  const configuredMode = normalizePersistedMode(mode) || DEFAULT_MODE;

  if (INDEPENDENT_MODES.has(configuredMode)) {
    return 'CREWCUT MODE ACTIVE — level: ' + configuredMode + '. Behavior defined by /crewcut-' + configuredMode + ' skill.';
  }

  const effectiveMode = normalizeMode(configuredMode) || DEFAULT_MODE;

  try {
    return 'CREWCUT MODE ACTIVE — level: ' + effectiveMode + '\n\n' +
      filterSkillBodyForMode(fs.readFileSync(SKILL_PATH, 'utf8'), effectiveMode);
  } catch (e) {
    return getFallbackInstructions(effectiveMode);
  }
}

module.exports = {
  filterSkillBodyForMode,
  getFallbackInstructions,
  getCrewcutInstructions,
};
