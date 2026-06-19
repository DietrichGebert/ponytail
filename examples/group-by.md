# Group By

**Task:** "Group this array of objects by a key."

## Without Ponytail

```bash
npm install lodash
```

```js
import { groupBy } from "lodash";

const byStatus = groupBy(orders, "status");
// → { pending: [...], shipped: [...], delivered: [...] }
```

Or the hand-rolled version:

```js
const byStatus = orders.reduce((acc, order) => {
  (acc[order.status] ??= []).push(order);
  return acc;
}, {});
```

## With Ponytail

```js
// ponytail: Object.groupBy does this
const byStatus = Object.groupBy(orders, order => order.status);
// → { pending: [...], shipped: [...], delivered: [...] }
```

**1 dependency (or a reduce) → 1 built-in.** `Object.groupBy` shipped in Chrome 117, Firefox 119, Safari 17.4, Node.js 21. If you need a `Map` instead of a plain object: `Map.groupBy(orders, o => o.status)`. Check your target runtime; if you need IE11 or old Node, the `reduce` one-liner is still the right call, not lodash.
