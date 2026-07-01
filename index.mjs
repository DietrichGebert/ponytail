// Flat entry point that re-exports the actual plugin from the canonical
// .opencode/plugins/ location. Some hosts (notably opencode's Bun-based
// loader) cannot resolve a package.json `main` that descends into a
// dot-prefixed directory (./.opencode/plugins/...). Pointing `main` and
// `exports["."]` at this flat file lets those hosts resolve the entry, while
// the original .mjs remains in place for hosts that load it via the
// `.opencode/plugins/*.mjs` convention.
export { ponytail as default, ponytail, Ponytail, PonytailPlugin } from './.opencode/plugins/ponytail.mjs';
export { parseCommandFile } from './.opencode/plugins/ponytail.mjs';