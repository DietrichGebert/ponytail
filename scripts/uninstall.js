#!/usr/bin/env node
import { existsSync, rmSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const targets = [
  join(homedir(), '.config', 'opencode', '.occam-active'),
  join(homedir(), '.config', 'occam')
];

for (const target of targets) {
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
    console.log(`[OCCAM-CLEANUP] Removed: ${target}`);
  }
}
console.log('[OCCAM-CLEANUP] Uninstalled cleanly.');
