# Security Policy

## Supported versions

Ponytail is published as [`@dietrichgebert/ponytail`](https://www.npmjs.com/package/@dietrichgebert/ponytail).
Only the latest release line receives fixes; older versions are not patched.

| Version | Supported |
| --- | --- |
| 4.x | yes |
| < 4.0 | no |

## Reporting a vulnerability

Report privately through GitHub's
[security advisory form](https://github.com/DietrichGebert/ponytail/security/advisories/new).
Please do not open a public issue for a vulnerability.

Include what you have: affected version, the file or rule involved, what an
attacker gains, and the smallest reproduction you can manage.

You can expect an acknowledgement within a week, and an assessment with a fix
or an explanation of why it is not a vulnerability within a month. A fix ships
in the next release, and the advisory is published once it is available.

## What counts

Ponytail ships agent rules, skills, commands, hooks, and an MCP server. The
interesting classes here are:

- a hook, command, or script that executes attacker-controlled input;
- a skill or rule that instructs an agent to exfiltrate secrets, weaken a
  security control, or run something outside the workspace;
- a marketplace or plugin manifest that resolves outside the plugin directory;
- a dependency or workflow change that lets untrusted code run in CI or reach
  the publish path.

Rule text you disagree with, model output you did not like, and findings that
need a user to run an obviously hostile command themselves are not
vulnerabilities. Open a normal issue for those.

## Supply chain

Workflows pin every action to a commit SHA, Dependabot keeps those pins and the
npm manifests current, and releases publish from CI with npm trusted publishing
(OIDC) so no long-lived token exists. Dependency trees are committed as
lockfiles.
