# How to contribute

Crewcut is a small project maintained by one person. Issues, ideas and pull requests are welcome.

## MENU

[Who can contribute](#who-can-contribute) Anyone can, but please tell us a little about yourself.

[Use of AI and prevention of AI Slop](#use-of-ai-and-prevention-of-ai-slop) Yes, you can use AI. Follow these guidelines.

[Submitting issues](#submitting-issues) Bug reports and feature requests.

[Raising pull requests](#raising-pull-requests) The process to follow.

[Changes from upstream](#changes-from-upstream) Fixes that belong in ponytail.

[License](#license) Please read this so you know the licensing.

---------

## Who can contribute

Anyone can contribute.

Please make your GitHub profile a little informative. A "funny" account name is fine, but add a name that tells us who we are talking to. Your location or time zone helps us know when you are likely to be active.

If you are new to GitHub, a short introduction in your first comment goes a long way. If you work for a company and contribute because of its needs, please say so.

A good profile helps build trust.

PS: *We will never discriminate against anyone based on who you are or why you want to contribute.*

## Use of AI and Prevention of AI Slop

AI is here to stay, and yes, we know you'll use it. This project is itself a set of instructions for AI agents. The important part is **how** you use it.

> [!IMPORTANT]
> We don't accept [AI Slop](https://arxiv.org/html/2603.27249v1): large amounts of AI-generated content that has not been properly reviewed, understood, or validated by the contributor.
>
> Contributions generated and submitted entirely by AI agents, without meaningful human review and ownership, are not accepted.
>
> **You are responsible for everything you submit**, regardless of whether it was written by you or generated with the help of AI.
>
> Repeated violations may result in you being blocked from contributing.

### These are easy wins

- Use AI to improve spelling, grammar, and sentence structure.
- Use AI to analyze existing code and explain how it works.
- Use AI to help you understand an issue or make a plan before you start.
- Use AI to review your own work before submitting it.

### But be more careful with code and rule text

- Keep changes small and focused. **You** should know what you want to achieve and **you** should drive the AI, not the other way around.
- Rule changes change how agents behave. Test a rule change in a real session before you submit it, and describe what changed in the agent's behavior.
- Don't submit code or rules you can't explain or maintain yourself.
- AI can confidently give incorrect explanations. Verify technical details before you put them in code, docs, issues, or pull requests.

**Think of AI as an assistant, not as the contributor.**

### Further reading

- LLVM's [AI Tool Use Policy](https://llvm.org/docs/AIToolPolicy.html), which follows many of the same principles.

## Submitting Issues

### Before you submit an issue

- Make sure you run the latest version of crewcut.
- **Search** the [issue list](https://github.com/HermitOS/crewcut/issues?q=is%3Aissue) (including closed issues). If you're unsure, raise it anyway.

### Submitting a good issue

- Give the issue a short, clear title.
- Tell us which host you use (Claude Code or Copilot CLI/Chat) and its version, and your OS.
- For a rule problem: give the prompt, what the agent did, and what you expected it to do.
- For a hook problem: include the exact error text.

## Raising Pull Requests

- Every pull request **must** refer to an issue. Discuss the approach in the issue first.
- Keep the rule copies in sync. `skills/crewcut/SKILL.md` is the source. `AGENTS.md`, `.github/copilot-instructions.md` and the fallback text in `hooks/crewcut-instructions.js` must carry the same rules.
- Run the checks locally before you submit:

| Action             | Command                             |
|--------------------|-------------------------------------|
| Rule copies match  | `node scripts/check-rule-copies.js` |
| Versions agree     | `node scripts/check-versions.js`    |
| Tests              | `npm test`                          |

### Inactive Pull Requests

If we don't hear back from you within **7 days** after we request changes, we may close the pull request. Tell us if you need longer. A closed pull request can be reopened.

## Changes from upstream

Crewcut is a fork of [ponytail](https://github.com/DietrichGebert/ponytail). A bug in code crewcut has not changed (most of the hooks) probably exists in ponytail too. Please report it [there](https://github.com/DietrichGebert/ponytail/issues) as well, so both projects get the fix.

## License

Crewcut is under the [MIT license](LICENSE). By contributing, you assert that:

* The contribution is your own original work.
* You have the right to assign the copyright for the work (it is not owned by your employer, or you have been given copyright assignment in writing).
