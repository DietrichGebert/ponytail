---
name: gavel-review
description: >
  Review test diffs for over-testing, redundant assertions, fat specs, missing
  test.step(), hardcoded data, and Test Constitution violations. One line per
  finding: location, what to cut or fix, what replaces it. Use when the user
  says "review my tests", "gavel-review", "/gavel-review", or "check this test".
  Complements correctness-focused review -- this one hunts test bloat and
  constitution violations.
---

Review test diffs for unnecessary complexity and Test Constitution violations.
One line per finding: location, what to cut or fix, what replaces it. The
diff's best outcome is getting leaner and more disciplined.

## Format

`L<line>: <tag> <what>. <replacement>.`, or `<file>:L<line>: ...` for
multi-file diffs.

Tags:

- `over-test:` multiple assertions checking the same state. Replacement: one focused assertion.
- `fat-spec:` logic, selectors, or data in the spec that belongs in POM/actions/factories. Replacement: thin spec + extracted helper.
- `css-loc:` CSS or XPath selector used. Replacement: semantic locator (getByRole, getByLabel, etc.).
- `hardcoded:` string, ID, URL, or credential in test body. Replacement: factory or fixture.
- `no-step:` logical grouping without test.step() / subTest / equivalent. Replacement: wrap in step.
- `manual-wait:` waitForTimeout, sleep, networkidle. Replacement: framework-native wait or web-first assertion.
- `no-di:` `new PageObject(page)` or `new Service()` in spec. Replacement: fixture DI.
- `yagni:` test that duplicates existing coverage. Replacement: nothing, delete it.
- `shrink:` same test logic, fewer lines. Show the shorter form.

## Examples

Bad: "This test might have too many assertions, consider reducing them."

Good:
- `L12-28: over-test: 5 assertions all check the same modal is visible. One toBeVisible() on the modal container.`
- `L8: css-loc: page.locator('.submit-btn'). Click via getByRole('button', { name: 'Submit' }).`
- `L15: hardcoded: 'test@example.com' in test body. UserFactory.create() for test data.`
- `L3-20: fat-spec: inline selectors and navigation logic. Extract to AdminChallengesPage POM.`
- `L5: no-step: 30-line test with no logical grouping. Wrap navigation, action, and assertion in test.step().`
- `L22: manual-wait: waitForTimeout(3000). Remove; web-first assertion auto-retries.`
- `L2: no-di: new LoginPage(page) in spec. Use fixture DI: { loginPage }.`

## Scoring

End with the only metric that matters: `net: -<N> lines possible, <M> constitution violations.`

If there is nothing to cut: `Lean already. Ship.`

## Boundaries

Scope: test bloat, over-testing, and Test Constitution violations only.
Correctness bugs in the application, security holes, and performance are
explicitly out of scope. Route them to a normal review pass. Does not apply
the fixes, only lists them.

"stop gavel-review" or "normal mode": revert to verbose review style.
