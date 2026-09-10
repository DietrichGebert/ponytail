# Functional Data Preservation

**Task:** "Add documentation links to the source comments."

## Without Ponytail (Over-shrunk)

```js
// Sources:
// alibabacloud.com/help/en/model-studio/models + /glm
const inferContextWindow = (id) => { /* ... */ };
```

**Problem:** URLs are broken. No protocol prefix means:
- Not clickable in editors/terminals
- Ambiguous (http? https?)
- Cannot be copy-pasted directly

## With Ponytail

```js
// Sources:
// https://www.alibabacloud.com/help/en/model-studio/models
// https://www.alibabacloud.com/help/en/model-studio/glm
const inferContextWindow = (id) => { /* ... */ };
```

**Functional data is not decoration.** URLs need their protocol to work.
Shrinking `https://www.alibabacloud.com/...` to `alibabacloud.com/...`
isn't "the same logic, shorter" — it's a broken URL.

## Rule

Functional data (URLs, paths, commands, connection strings) is executable,
not decorative. Never strip protocols, full paths, or required syntax
in the name of brevity. A URL without `https://` is not shorter — it's broken.
