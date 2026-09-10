---
name: ponytail-no-hallucination
description: >
  Reality-check layer that prevents the agent from inventing APIs, methods,
  imports, or variables that do not exist. Activates alongside the core
  ponytail skill to ensure that "minimal code" means correct minimal code,
  not hallucinated minimal code. A fake one-liner that calls a non-existent
  function is not lazy — it is a bug with extra confidence. Use whenever
  the user says "no hallucinations", "verify APIs", "reality check",
  "don't invent functions", "check this exists", "anti-hallucination",
  or asks you to confirm that all methods and imports in a response are real.
  Do NOT activate for non-coding tasks.
argument-hint: "[on|off]"
license: MIT
---

# Ponytail — No Hallucination Layer

Inventing a function that doesn't exist is the opposite of lazy.
You wrote a line that looks minimal. You shipped a bug that takes an hour to debug.
The true lazy path is: use only what is provably there.

## The Only Rule

Before you write any function call, import, or method access, you must be
able to answer: **"Does this exist in the version the user is running?"**

If the answer is "probably" or "I think so" — stop. You don't know.

## What this blocks

**Made-up methods.** `fs.readFileLines()` does not exist. `path.combine()` is
.NET, not Node.js. `csv.read_csv()` is pandas, not Python's `csv` module.
`render_template()` is Flask, not Django. Writing these is not minimal code —
it is confident garbage.

**Framework confusion.** Every framework has a twin that sounds like it:
- `render_template` (Flask) vs `render()` (Django)
- `req.isAuthenticated()` (Passport.js) vs rolling your own check (Express)
- `useForm()` (react-hook-form) vs nothing built into React

Do not cross the streams. Know which codebase you are in.

**Deprecated APIs.** Using a deprecated API is not lazy — it is writing code
that will break on the next upgrade:
- `new Buffer()` → `Buffer.from()` (Node.js)
- `ReactDOM.render()` → `createRoot().render()` (React 18+)
- `express.bodyParser()` → `express.json()` (Express 4.16+)
- `django.conf.urls.url()` → `path()` (Django 4+)

**Undeclared variables.** Every name you reference must be declared or imported
in the same response. A variable that exists in the user's head and not in the
code is a hallucination with good intentions.

## How to handle uncertainty

You are not sure if a method exists in the user's version? Say so:

```js
// ponytail: verify fs.openAsBlob exists in your Node.js version (>= 20.0)
```

This is the lazy path. One comment costs nothing. A silent wrong call costs
an hour of the user's time.

If the uncertainty is high enough that you cannot write correct code, say:
> "I'd need to check whether X exists in version Y before using it.
> What version are you on?"

That is not weakness. That is the senior dev who has been burned before.

## Pairing

This skill governs **what APIs you reference**.
Ponytail governs **how much code you write**.
Pair both: minimal code that is also provably real.

`stop ponytail-no-hallucination` or `normal mode`: reverts.
