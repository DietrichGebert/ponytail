const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.join(__dirname, '..');
const instructions = path.join(root, 'hooks', 'ponytail-instructions.js');
const context = require(instructions).getPonytailInstructions('lite').repeat(256);

// Exercise real child stdout with enough data to exceed the OS pipe buffer.
// Delaying the reader exposes exit-before-flush even on Linux, where the
// ordinary ~5KB payload often fits in one write and hides the macOS bug.
function run(t, script, options = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-output-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const stateDir = options.host === 'cursor' ? path.join(home, '.cursor') : home;
  fs.mkdirSync(stateDir, { recursive: true });
  const flag = path.join(stateDir, '.ponytail-active');
  fs.writeFileSync(flag, options.mode || 'lite');
  const env = {
    HOME: home, USERPROFILE: home, PLUGIN_DATA: home,
    CLAUDE_CONFIG_DIR: home, XDG_CONFIG_HOME: home,
    PONYTAIL_DEFAULT_MODE: 'lite',
    PONYTAIL_SUBAGENT_MATCHER: options.matcher || '',
  };
  // Keep Node's platform essentials on Windows without inheriting host config.
  if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
  if (options.host === 'cursor') {
    delete env.PLUGIN_DATA;
    env.CURSOR_VERSION = 'test';
    env.CURSOR_PROJECT_DIR = home;
    fs.mkdirSync(path.join(stateDir, 'rules'));
    fs.writeFileSync(path.join(stateDir, 'rules', 'ponytail.mdc'), 'fixture');
  }
  const code = `
    const instructions = require(${JSON.stringify(instructions)});
    const original = instructions.getPonytailInstructions;
    instructions.getPonytailInstructions = mode => original(mode).repeat(256);
    ${options.setup || ''}
    require(${JSON.stringify(path.join(root, 'hooks', script))});
    if (process.send) process.send('ready');
  `;
  const start = Date.now();
  const child = spawn(process.execPath, ['-e', code], {
    env, ...(options.ready ? { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] } : {}),
  });
  let stdout = '', stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.stdout.pause();
  let reader, input;
  function schedule() {
    reader = options.noDrain ? null : setTimeout(() => child.stdout.resume(), options.readDelay || 100);
    input = setTimeout(() => {
      if (options.keepStdin) child.stdin.write(options.input || '');
      else child.stdin.end(options.input || '');
    }, options.inputDelay || 0);
  }
  if (options.ready) child.once('message', schedule);
  else schedule();
  child.stdin.on('error', error => {
    // An intentionally stdin-independent hook can exit before the test writes.
    if (error.code !== 'EPIPE' && error.code !== 'ERR_STREAM_DESTROYED') throw error;
  });
  return new Promise((resolve, reject) => {
    let failure;
    const guard = setTimeout(() => {
      failure = new Error(`${script} did not exit within 3500ms`);
      child.kill('SIGKILL');
    }, 3500);
    // Drain remaining OS-buffered bytes after a bounded non-draining test exits.
    child.on('exit', () => child.stdout.resume());
    child.on('error', error => { failure = error; });
    child.on('close', (code, signal) => {
      clearTimeout(guard); clearTimeout(reader); clearTimeout(input);
      if (failure) return reject(failure);
      resolve({ code, signal, stdout, stderr, elapsed: Date.now() - start, mode: fs.readFileSync(flag, 'utf8') });
    });
  });
}

function checkContext(result, event, expected) {
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.signal, null);
  const parsed = JSON.parse(result.stdout);
  assert.deepEqual(parsed, { hookSpecificOutput: { hookEventName: event, additionalContext: expected } });
}

const tracker = 'ponytail-mode-tracker.js';
const subagent = 'ponytail-subagent.js';
const prompt = JSON.stringify({ prompt: '/ponytail lite' });
const agent = JSON.stringify({ agent_type: 'general' });
const switched = 'PONYTAIL MODE CHANGED — level: lite\n\n' + context;

test('SessionStart control flushes complete JSON to an asynchronous reader', async t => {
  checkContext(await run(t, 'ponytail-activate.js'), 'SessionStart', context);
});

test('mode tracker flushes complete JSON before exiting (#1043)', async t => {
  checkContext(await run(t, tracker, { input: prompt }), 'UserPromptSubmit', switched);
});

test('subagent without matcher flushes output without waiting for stdin EOF', async t => {
  const result = await run(t, subagent, { keepStdin: true });
  checkContext(result, 'SubagentStart', context);
  assert.ok(result.elapsed < 800, `stdin-independent path took ${result.elapsed}ms`);
});

test('matching subagent flushes complete JSON on stdin EOF', async t => {
  checkContext(await run(t, subagent, { matcher: '^general$', input: agent }), 'SubagentStart', context);
});

test('Cursor rule activation flushes exactly one notice without changing mode', async t => {
  const notice = 'cursor notice '.repeat(100000);
  const result = await run(t, 'ponytail-activate.js', {
    host: 'cursor', mode: 'ultra', keepStdin: true,
    setup: `require(${JSON.stringify(path.join(root, 'hooks', 'ponytail-runtime.js'))}).cursorRuleNotice = () => 'cursor notice '.repeat(100000);`,
  });
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { additional_context: notice });
  assert.equal(result.mode, 'ultra');
});

test('stdin error recovers arrived data and still flushes output', async t => {
  for (const [script, payload, event, expected] of [
    [tracker, prompt, 'UserPromptSubmit', switched],
    [subagent, agent, 'SubagentStart', context],
  ]) {
    checkContext(await run(t, script, {
      matcher: '^general$', keepStdin: true,
      setup: `queueMicrotask(() => {
        process.stdin.emit('data', ${JSON.stringify(payload)});
        process.stdin.emit('error', new Error('stdin fixture'));
      });`,
    }), event, expected);
  }
});

test('off and definite mismatch remain silent', async t => {
  for (const options of [{ mode: 'off', keepStdin: true }, { matcher: '^explore$', input: agent }]) {
    const result = await run(t, subagent, options);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stdout, '');
  }
});

test('stuck stdin fallback processes arrived data then flushes (#443, #790)', async t => {
  for (const [script, options, event, expected] of [
    [tracker, { input: prompt }, 'UserPromptSubmit', switched],
    [subagent, { matcher: '^general$', input: agent }, 'SubagentStart', context],
    [subagent, { matcher: '^general$' }, 'SubagentStart', context],
  ]) {
    const result = await run(t, script, { ...options, keepStdin: true });
    checkContext(result, event, expected);
    assert.ok(result.elapsed >= 950 && result.elapsed < 2000, `fallback took ${result.elapsed}ms`);
  }
});

test('stdin fallback cannot interrupt a flush already started near its deadline', async t => {
  // Schedule relative to hook readiness, so slow child startup cannot move
  // the drain ahead of the hook's original 1000ms stdin deadline.
  checkContext(await run(t, tracker, { input: prompt, ready: true, inputDelay: 800, readDelay: 1200 }), 'UserPromptSubmit', switched);
});

test('a non-draining asynchronous reader cannot hang explicit hook shutdown', {
  skip: process.platform === 'win32' && 'Windows stdout pipes can block synchronously before the JS timer runs',
}, async t => {
  for (const [script, options] of [
    [tracker, { input: prompt }],
    [subagent, { keepStdin: true }],
    [subagent, { keepStdin: true, matcher: '^general$' }],
  ]) {
    const result = await run(t, script, { ...options, noDrain: true });
    assert.equal(result.code, 0, result.stderr);
    assert.ok(result.stdout.length < context.length, 'fixture must actually backpressure stdout');
    assert.ok(result.elapsed < 3000, `bounded shutdown took ${result.elapsed}ms`);
  }
});

test('stdout callback errors keep EPIPE quiet without masking non-EPIPE failures', async t => {
  for (const code of ['EPIPE', 'EIO']) {
    for (const delayed of [false, true]) {
      const result = await run(t, subagent, {
        setup: `process.stdout._write = (chunk, encoding, callback) => {
          const fail = () => callback(Object.assign(new Error('output fixture'), { code: ${JSON.stringify(code)} }));
          ${delayed ? 'setImmediate(fail);' : 'fail();'}
        };`,
      });
      assert.equal(result.code, code === 'EPIPE' ? 0 : 1, result.stderr);
      if (code === 'EIO') assert.match(result.stderr, /EIO/);
      else assert.equal(result.stderr, '');
    }
  }
});
