// Regenerate the packaged skills/ from the repo-root source of truth.
// In a checkout the plugin reads ../skills directly (thin adapter — no rule
// text duplicated in the repo); skills/ exists only in the npm tarball, since
// npm cannot include files outside the package dir. It is therefore a build
// artifact (gitignored), regenerated on `npm pack`/`npm publish` via prepack.
import { cpSync, existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export function syncSkills(root) {
  const source = join(root, '..', 'skills')
  if (!existsSync(source)) throw new Error(`skills source not found at ${source} — run this from a repo checkout`)
  rmSync(join(root, 'skills'), { recursive: true, force: true })
  cpSync(source, join(root, 'skills'), { recursive: true })
}

// CLI: node scripts/sync-skills.mjs
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
  syncSkills(root)
  console.log('skills/ synced from ../skills')
}
