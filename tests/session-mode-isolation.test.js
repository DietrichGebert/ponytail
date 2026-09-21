const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.join(__dirname, '..');

test('payload timeout exits even when the host leaves stdin open', async () => {
  const runtime = path.join(root, 'hooks', 'ponytail-runtime.js');
  const child = spawn(process.execPath, ['-e',
    `require(${JSON.stringify(runtime)}).readHookPayload(data => process.stdout.write(JSON.stringify(data)))`,
  ], { stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  const timeout = setTimeout(() => child.kill('SIGKILL'), 2500);
  try {
    const status = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
    assert.equal(status, 0, 'open stdin must not keep a timed-out hook alive');
    assert.equal(stdout, '{}');
  } finally {
    clearTimeout(timeout);
    child.stdin.destroy();
  }
});

function run(script, env, payload) {
  return spawnSync(process.execPath, [path.join(root, 'hooks', script)], {
    env: { ...process.env, ...env },
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });
}

function modeFrom(result) {
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout).systemMessage;
}

function runAsync(script, env, payload) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'hooks', script)], {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', status => resolve({ status, stdout, stderr }));
    child.stdin.end(JSON.stringify(payload));
  });
}

test('hook modes are isolated by session and explicit off survives resume', async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-session-mode-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const env = {
    HOME: temp,
    USERPROFILE: temp,
    PLUGIN_DATA: path.join(temp, 'plugin-data'),
    PONYTAIL_DEFAULT_MODE: 'full',
  };

  assert.equal(modeFrom(run('ponytail-activate.js', env, {
    hook_event_name: 'SessionStart', session_id: 'session-a', source: 'startup',
  })), 'PONYTAIL:FULL');
  assert.equal(modeFrom(run('ponytail-activate.js', env, {
    hook_event_name: 'SessionStart', session_id: 'session-b', source: 'startup',
  })), 'PONYTAIL:FULL');

  const switches = await Promise.all([
    runAsync('ponytail-mode-tracker.js', env, {
      hook_event_name: 'UserPromptSubmit', session_id: 'session-a', prompt: '/ponytail ultra',
    }),
    runAsync('ponytail-mode-tracker.js', env, {
      hook_event_name: 'UserPromptSubmit', session_id: 'session-b', prompt: '/ponytail lite',
    }),
  ]);
  assert.deepEqual(switches.map(modeFrom), ['PONYTAIL:ULTRA', 'PONYTAIL:LITE']);

  assert.equal(modeFrom(run('ponytail-mode-tracker.js', env, {
    session_id: 'session-a', prompt: '/ponytail',
  })), 'PONYTAIL:ULTRA');
  assert.equal(modeFrom(run('ponytail-mode-tracker.js', env, {
    session_id: 'session-b', prompt: '/ponytail',
  })), 'PONYTAIL:LITE');

  assert.equal(modeFrom(run('ponytail-mode-tracker.js', env, {
    session_id: 'session-a', prompt: '/ponytail off',
  })), 'PONYTAIL:OFF');
  assert.equal(modeFrom(run('ponytail-activate.js', env, {
    hook_event_name: 'SessionStart', session_id: 'session-a', source: 'resume',
  })), 'PONYTAIL:OFF');
  assert.equal(modeFrom(run('ponytail-activate.js', env, {
    hook_event_name: 'SessionStart', session_id: 'session-b', source: 'compact',
  })), 'PONYTAIL:LITE');
  assert.equal(modeFrom(run('ponytail-mode-tracker.js', env, {
    session_id: 'session-b', prompt: '/ponytail',
  })), 'PONYTAIL:LITE');

  const inherited = run('ponytail-subagent.js', env, {
    hook_event_name: 'SubagentStart', session_id: 'session-b', agent_type: 'general-purpose',
  });
  assert.equal(inherited.status, 0, inherited.stderr);
  assert.equal(
    JSON.parse(inherited.stdout).hookSpecificOutput.hookEventName,
    'SubagentStart',
  );
  assert.equal(run('ponytail-subagent.js', env, {
    hook_event_name: 'SubagentStart', agent_type: 'general-purpose',
  }).stdout, '', 'missing session ids must not inherit another session mode');

  run('ponytail-mode-tracker.js', env, {
    session_id: { malicious: '../../session-b' }, prompt: '/ponytail ultra',
  });
  assert.equal(modeFrom(run('ponytail-mode-tracker.js', env, {
    session_id: 'session-b', prompt: '/ponytail',
  })), 'PONYTAIL:LITE');
});
