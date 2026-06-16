# URL Parameters

**Task:** "Parse and build URL query strings."

## Without Ponytail

```bash
npm install query-string
# 4.5 kB gzipped, 3.5M downloads/week
```

```js
import qs from "query-string";

// Parse
const params = qs.parse(location.search);
// → { page: "2", sort: "name", tags: ["js", "css"] }

// Build
const url = qs.stringify({ page: 2, sort: "name", tags: ["js", "css"] });
// → "page=2&sort=name&tags=js&tags=css"
```

## With Ponytail

```js
// ponytail: URLSearchParams does this
const params = new URLSearchParams(location.search);

// Read
params.get("page");         // "2"
params.getAll("tags");      // ["js", "css"]

// Build
const out = new URLSearchParams({ page: 2, sort: "name" });
out.append("tags", "js");
out.append("tags", "css");
out.toString(); // "page=2&sort=name&tags=js&tags=css"
```

**1 dependency → 0 dependencies.** `URLSearchParams` is in every browser and in Node.js since v10. It handles encoding, repeated keys, and iteration. The package was a polyfill for an API that has shipped everywhere for years.
