// Reads the server version from package.json so it can't drift from the
// package's actual version on release (#535).
import { readFileSync } from "node:fs";

export function getVersion() {
  return JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;
}
