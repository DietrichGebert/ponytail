# Deep Clone

**Task:** "Deep clone this object."

## Without Ponytail

```bash
npm install lodash
```

```js
import { cloneDeep } from "lodash";

const copy = cloneDeep(original);
```

Or the classic hack:

```js
// fragile: loses Date, undefined, Map, Set, circular refs, functions
const copy = JSON.parse(JSON.stringify(original));
```

## With Ponytail

```js
// ponytail: structuredClone does this
const copy = structuredClone(original);
```

**1 dependency (or a fragile hack) → 1 built-in.** `structuredClone` handles `Date`, `Map`, `Set`, `ArrayBuffer`, `RegExp`, circular references, and more, everything `JSON.parse/stringify` silently drops. Available in every browser since 2022 and Node.js since v17. Pull lodash in when you need the rest of it, not for one function.
