# Number Formatting

**Task:** "Format numbers as currency and with thousand separators."

## Without Ponytail

```bash
npm install numeral
# or: npm install accounting
```

```js
import numeral from "numeral";

numeral(1234567.89).format("$1,234.00"); // "$1,234,567.89"
numeral(0.745).format("0.0%");           // "74.5%"
numeral(1500).format("0.0a");            // "1.5k"
```

## With Ponytail

```js
// ponytail: Intl.NumberFormat does this, locale-aware
new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
  .format(1234567.89);
// → "$1,234,567.89"

new Intl.NumberFormat("en-US", { style: "percent" })
  .format(0.745);
// → "74.5%"

new Intl.NumberFormat("en-US", { notation: "compact" })
  .format(1500);
// → "1.5K"
```

**1 dependency → 0 dependencies.** `Intl.NumberFormat` is built into every JS runtime, handles every locale correctly, and gets currency symbols, decimal separators, and grouping right for any market without a lookup table. A library that hardcodes formats will always be wrong for someone.
