#!/usr/bin/env node
// Cursor beforeShellExecution hook: slow down avoidable dependency installs.

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const { command = '' } = JSON.parse(input.replace(/^\uFEFF/, ''));
    const installsDependency = /\b(npm|pnpm|yarn|bun)\s+(install|add)\b|\bpip\s+install\b|\bpoetry\s+add\b|\bgo\s+get\b|\bcargo\s+add\b/.test(command);

    if (installsDependency) {
      process.stdout.write(JSON.stringify({
        permission: 'ask',
        user_message: 'Ponytail: dependency install detected. Confirm this is better than stdlib, native platform support, or an already-installed dependency.',
        agent_message: 'Before installing a dependency, apply the Ponytail ladder: stdlib first, native platform second, existing dependency third. Continue only if the new dependency is explicitly justified.',
      }));
      return;
    }
  } catch (e) {
    // Fail open: this is a guidance hook, not a security boundary.
  }

  process.stdout.write(JSON.stringify({ permission: 'allow' }));
});
