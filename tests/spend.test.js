#!/usr/bin/env node
// ponytail — spend firewall tests.
//
// The three failure modes that make a spend guard worse than none:
//   counting the same message twice (blocks a session that is under budget),
//   missing spend entirely (never blocks), and
//   throwing (wedges the session over the guard's own bug).
// Each has a test below.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const hook = path.join(root, 'hooks', 'ponytail-spend.js');

const pricing = require('../hooks/spend/pricing');
const policy = require('../hooks/spend/policy');
const ledger = require('../hooks/spend/ledger');
const commands = require('../hooks/spend/commands');
const { readUsageSince } = require('../hooks/spend/transcript');
const { meter } = require('../hooks/spend/meter');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-spend-'));
process.on('exit', () => fs.rmSync(temp, { recursive: true, force: true }));

let counter = 0;
function sandbox() {
  const dir = path.join(temp, 'box-' + counter++);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// One assistant message as the transcript actually stores it: repeated once per
// content block, every copy carrying the same usage.
function assistantLines(id, model, usage, copies = 1) {
  const line = JSON.stringify({
    type: 'assistant',
    requestId: 'req_' + id,
    message: { id: 'msg_' + id, model, usage },
  });
  return Array(copies).fill(line);
}

function writeTranscript(dir, lines) {
  const file = path.join(dir, 'transcript.jsonl');
  fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');
  return file;
}

function runHook(payload, env) {
  return spawnSync(process.execPath, [hook], {
    env: { ...process.env, ...env },
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });
}

// ---------------------------------------------------------------- pricing

test('rates resolve through the forms a model id actually arrives in', () => {
  assert.deepEqual(pricing.resolveRate('claude-opus-5'), { input: 5, output: 25 });
  assert.deepEqual(pricing.resolveRate('us.anthropic.claude-sonnet-5'), { input: 3, output: 15 });
  assert.deepEqual(pricing.resolveRate('claude-opus-4-5@20251101'), { input: 5, output: 25 });
  assert.deepEqual(pricing.resolveRate('claude-haiku-4-5-20251001'), { input: 1, output: 5 });
  // Unknown id, known family — an unreleased opus must not bill as free.
  assert.deepEqual(pricing.resolveRate('claude-opus-9-turbo'), { input: 5, output: 25 });
  assert.equal(pricing.resolveRate('llama3.2:latest'), null);
  assert.equal(pricing.resolveRate(''), null);
});

test('config price overrides win over the built-in table', () => {
  const rate = pricing.resolveRate('claude-opus-5', { 'claude-opus-5': { input: 1, output: 2 } });
  assert.deepEqual(rate, { input: 1, output: 2 });
});

test('cache tokens are priced at their own multipliers, not the input rate', () => {
  const rate = { input: 10, output: 0 };
  // 1M of each, so the cost in dollars reads back as the multiplier.
  assert.equal(pricing.costOf({ cache_read_input_tokens: 1e6 }, rate), 10 * pricing.CACHE_READ);
  assert.equal(pricing.costOf({ cache_creation_input_tokens: 1e6 }, rate), 10 * pricing.CACHE_WRITE_5M);
  assert.equal(
    pricing.costOf({ cache_creation: { ephemeral_1h_input_tokens: 1e6 } }, rate),
    10 * pricing.CACHE_WRITE_1H,
  );
});

test('cost is zero for junk input rather than NaN', () => {
  assert.equal(pricing.costOf(null, { input: 1, output: 1 }), 0);
  assert.equal(pricing.costOf({ output_tokens: -5 }, { input: 1, output: 1 }), 0);
  assert.equal(pricing.costOf({ output_tokens: 5 }, null), 0);
});

// ------------------------------------------------------------- transcript

test('one message split across content blocks is counted once', () => {
  const dir = sandbox();
  const usage = { input_tokens: 100, output_tokens: 1000 };
  const file = writeTranscript(dir, [
    ...assistantLines('a', 'claude-opus-5', usage, 3),
    ...assistantLines('b', 'claude-opus-5', usage, 2),
  ]);
  const { records } = readUsageSince(file, { offset: 0, seen: [] });
  assert.equal(records.length, 2, 'five lines, two real messages');
});

test('a second read only picks up what was appended', () => {
  const dir = sandbox();
  const usage = { output_tokens: 1000 };
  const file = writeTranscript(dir, assistantLines('a', 'claude-opus-5', usage));

  const first = readUsageSince(file, { offset: 0, seen: [] });
  assert.equal(first.records.length, 1);

  const second = readUsageSince(file, first);
  assert.equal(second.records.length, 0, 'nothing appended, nothing to count');

  fs.appendFileSync(file, assistantLines('b', 'claude-opus-5', usage)[0] + '\n');
  const third = readUsageSince(file, second);
  assert.equal(third.records.length, 1);
  assert.equal(third.records[0].id, 'msg_b');
});

test('a half-written trailing line waits for the next read', () => {
  const dir = sandbox();
  const file = writeTranscript(dir, assistantLines('a', 'claude-opus-5', { output_tokens: 10 }));
  fs.appendFileSync(file, '{"type":"assistant","message":{"id":"msg_partial"');

  const first = readUsageSince(file, { offset: 0, seen: [] });
  assert.equal(first.records.length, 1, 'the partial line is not parsed');

  // Completed on the next flush — now it counts, exactly once.
  fs.appendFileSync(file, ',"model":"claude-opus-5","usage":{"output_tokens":10}}}\n');
  const second = readUsageSince(file, first);
  assert.equal(second.records.length, 1);
  assert.equal(second.records[0].id, 'msg_partial');
});

test('a truncated transcript recounts instead of reading past the end', () => {
  const dir = sandbox();
  const file = writeTranscript(dir, assistantLines('a', 'claude-opus-5', { output_tokens: 10 }));
  const stale = { offset: 999999, seen: [] };
  const { records, offset } = readUsageSince(file, stale);
  assert.equal(records.length, 1);
  assert.ok(offset < 999999);
});

test('unreadable and corrupt transcripts yield nothing, never throw', () => {
  assert.deepEqual(readUsageSince(path.join(sandbox(), 'nope.jsonl'), { offset: 0, seen: [] }).records, []);
  assert.deepEqual(readUsageSince(null, { offset: 0, seen: [] }).records, []);

  const dir = sandbox();
  const file = writeTranscript(dir, ['not json at all', '{"broken":', 'null']);
  assert.deepEqual(readUsageSince(file, { offset: 0, seen: [] }).records, []);
});

// ------------------------------------------------------------------ meter

test('metering totals real spend and survives being run repeatedly', () => {
  const box = sandbox();
  process.env.XDG_CONFIG_HOME = box;
  const file = writeTranscript(box, [
    // 1M output on opus ($25) duplicated across two content blocks
    ...assistantLines('a', 'claude-opus-5', { output_tokens: 1e6 }, 2),
    // 1M output on haiku ($5)
    ...assistantLines('b', 'claude-haiku-4-5', { output_tokens: 1e6 }),
  ]);

  const first = meter('sess-meter', file, {});
  assert.equal(first.costUsd, 30);
  assert.equal(first.tokens, 2e6);

  const again = meter('sess-meter', file, {});
  assert.equal(again.costUsd, 30, 're-running the hook must not re-bill');
});

test('tokens from an unpriced model are surfaced, not swallowed', () => {
  const box = sandbox();
  process.env.XDG_CONFIG_HOME = box;
  const file = writeTranscript(box, assistantLines('a', 'llama3.2:latest', { output_tokens: 5000 }));

  const state = meter('sess-unpriced', file, {});
  assert.equal(state.costUsd, 0);
  assert.equal(state.tokens, 5000);
  assert.equal(state.unpricedTokens, 5000);
  assert.deepEqual(state.unpricedModels, ['llama3.2:latest']);
});

// ----------------------------------------------------------------- ledger

test('a hostile session id cannot escape the ledger directory', () => {
  assert.equal(ledger.safeName('../../.bashrc'), '.._.._.bashrc');
  assert.equal(ledger.safeName(''), 'default');
  assert.equal(ledger.safeName('..'), 'default');
  process.env.XDG_CONFIG_HOME = sandbox();
  assert.equal(path.dirname(ledger.ledgerPath('a/b')), ledger.ledgerDir());
});

test('a corrupt ledger reads as a fresh one', () => {
  const box = sandbox();
  process.env.XDG_CONFIG_HOME = box;
  ledger.save('sess-corrupt', { ...ledger.emptyLedger('sess-corrupt'), costUsd: 4 });
  fs.writeFileSync(ledger.ledgerPath('sess-corrupt'), '{ truncated', 'utf8');
  assert.equal(ledger.load('sess-corrupt').costUsd, 0);
});

// ----------------------------------------------------------------- policy

test('the firewall stays off until someone sets a limit', () => {
  assert.equal(policy.getSpendConfig({}).enabled, false);
  assert.equal(policy.getSpendConfig({ PONYTAIL_SPEND_LIMIT: '0' }).enabled, false);
  assert.equal(policy.getSpendConfig({ PONYTAIL_SPEND_LIMIT: 'lots' }).enabled, false);
  assert.equal(policy.getSpendConfig({ PONYTAIL_SPEND_LIMIT: '5' }).enabled, true);
});

test('env overrides the config file, and mode off disables enforcement', () => {
  const box = sandbox();
  process.env.XDG_CONFIG_HOME = box;
  fs.mkdirSync(path.join(box, 'ponytail'), { recursive: true });
  fs.writeFileSync(
    path.join(box, 'ponytail', 'config.json'),
    JSON.stringify({ spend: { limit: 2, warnAt: 0.5, mode: 'warn' } }),
    'utf8',
  );

  const fromFile = policy.getSpendConfig({});
  assert.equal(fromFile.limitUsd, 2);
  assert.equal(fromFile.warnAt, 0.5);
  assert.equal(fromFile.mode, 'warn');

  const overridden = policy.getSpendConfig({ PONYTAIL_SPEND_LIMIT: '9', PONYTAIL_SPEND_MODE: 'off' });
  assert.equal(overridden.limitUsd, 9);
  assert.equal(overridden.enabled, false, 'mode off means nothing is enforced');
});

test('thresholds accept both 0.75 and "75%"', () => {
  assert.equal(policy.parseFraction('75%'), 0.75);
  assert.equal(policy.parseFraction(0.75), 0.75);
  assert.equal(policy.parseFraction('120%'), null);
  assert.equal(policy.parseFraction(1), null, 'a threshold at the limit is not a warning');
});

test('a malformed price override is ignored rather than trusted', () => {
  assert.equal(policy.parsePrices({ x: { input: 'free', output: 1 } }), null);
  assert.equal(policy.parsePrices({ x: { input: -1, output: 1 } }), null);
  assert.deepEqual(policy.parsePrices({ X: { input: 1, output: 2 } }), { x: { input: 1, output: 2 } });
});

test('tiers cross where the budget says they do', () => {
  const config = { enabled: true, limitUsd: 10, warnAt: 0.75, mode: 'block' };
  assert.equal(policy.evaluate(1, config).tier, 'ok');
  assert.equal(policy.evaluate(7.4, config).tier, 'ok');
  assert.equal(policy.evaluate(7.5, config).tier, 'warn');
  assert.equal(policy.evaluate(10, config).tier, 'block');
  assert.equal(policy.evaluate(999, config).tier, 'block');
});

test('warn mode reports the overrun but never blocks', () => {
  const config = { enabled: true, limitUsd: 10, warnAt: 0.75, mode: 'warn' };
  const decision = policy.evaluate(50, config);
  assert.equal(decision.tier, 'warn');
  assert.equal(decision.overLimit, true);
  assert.equal(decision.remainingUsd, 0);
});

// --------------------------------------------------------------- commands

test('the spend command grammar', () => {
  assert.deepEqual(commands.parseSpendCommand('/ponytail spend'), { action: 'status' });
  assert.deepEqual(commands.parseSpendCommand('@ponytail spend reset'), { action: 'reset' });
  assert.deepEqual(commands.parseSpendCommand('/ponytail:ponytail spend limit 5'), { action: 'limit', amount: 5 });
  assert.deepEqual(commands.parseSpendCommand('/ponytail spend limit $2.50'), { action: 'limit', amount: 2.5 });
  assert.deepEqual(commands.parseSpendCommand('/ponytail spend warn'), { action: 'mode', mode: 'warn' });
  assert.equal(commands.parseSpendCommand('/ponytail spend limit').action, 'invalid');
  assert.equal(commands.parseSpendCommand('/ponytail ultra'), null);
  assert.equal(commands.parseSpendCommand('how much did I spend'), null, 'prose is not a command');
});

test('writing a limit keeps the rest of config.json intact', () => {
  const box = sandbox();
  process.env.XDG_CONFIG_HOME = box;
  fs.mkdirSync(path.join(box, 'ponytail'), { recursive: true });
  const configPath = path.join(box, 'ponytail', 'config.json');
  fs.writeFileSync(configPath, JSON.stringify({ defaultMode: 'ultra', spend: { mode: 'warn' } }), 'utf8');

  commands.applySpendCommand({ action: 'limit', amount: 7 }, 'sess-cmd');
  const saved = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.equal(saved.defaultMode, 'ultra', 'the mode default must survive a budget write');
  assert.deepEqual(saved.spend, { mode: 'warn', limit: 7 });
});

// ------------------------------------------------------------ hook wiring

test('with no limit set the hook does nothing and writes no ledger', () => {
  const box = sandbox();
  const file = writeTranscript(box, assistantLines('a', 'claude-opus-5', { output_tokens: 1e6 }));
  const result = runHook(
    { hook_event_name: 'PreToolUse', session_id: 'quiet', transcript_path: file },
    { XDG_CONFIG_HOME: box, PONYTAIL_SPEND_LIMIT: '' },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(fs.existsSync(path.join(box, 'ponytail', 'spend')), false);
});

test('over budget, PreToolUse denies with the documented shape', () => {
  const box = sandbox();
  const file = writeTranscript(box, assistantLines('a', 'claude-opus-5', { output_tokens: 1e6 }));
  const result = runHook(
    { hook_event_name: 'PreToolUse', session_id: 'burn', transcript_path: file },
    { XDG_CONFIG_HOME: box, PONYTAIL_SPEND_LIMIT: '1' },
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout).hookSpecificOutput;
  assert.equal(output.hookEventName, 'PreToolUse');
  assert.equal(output.permissionDecision, 'deny');
  assert.match(output.permissionDecisionReason, /PONYTAIL SPEND LIMIT REACHED/);
});

test('over budget, UserPromptSubmit denies the turn before it starts', () => {
  const box = sandbox();
  const file = writeTranscript(box, assistantLines('a', 'claude-opus-5', { output_tokens: 1e6 }));
  const result = runHook(
    { hook_event_name: 'UserPromptSubmit', session_id: 'burn2', transcript_path: file, prompt: 'keep going' },
    { XDG_CONFIG_HOME: box, PONYTAIL_SPEND_LIMIT: '1' },
  );
  const output = JSON.parse(result.stdout);
  assert.equal(output.decision, 'deny');
  assert.match(output.reason, /blocked/);
});

test('the warning is emitted once, not on every tool call', () => {
  const box = sandbox();
  const file = writeTranscript(box, assistantLines('a', 'claude-opus-5', { output_tokens: 1e6 }));
  const env = { XDG_CONFIG_HOME: box, PONYTAIL_SPEND_LIMIT: '30' }; // $25 spent = 83%

  assert.match(
    runHook({ hook_event_name: 'PreToolUse', session_id: 'warned', transcript_path: file }, env).stdout,
    /PONYTAIL SPEND WARNING/,
  );
  assert.equal(
    runHook({ hook_event_name: 'PreToolUse', session_id: 'warned', transcript_path: file }, env).stdout,
    '',
    'the same warning must not repeat on every tool call',
  );
});

test('a blocked session can still raise its own limit', () => {
  const box = sandbox();
  const file = writeTranscript(box, assistantLines('a', 'claude-opus-5', { output_tokens: 1e6 }));
  const env = { XDG_CONFIG_HOME: box, PONYTAIL_SPEND_LIMIT: '1' };

  // Blocked...
  assert.match(
    runHook({ hook_event_name: 'UserPromptSubmit', session_id: 'stuck', transcript_path: file, prompt: 'go' }, env).stdout,
    /LIMIT REACHED/,
  );
  // ...but the command that fixes it still gets through.
  const raise = runHook(
    { hook_event_name: 'UserPromptSubmit', session_id: 'stuck', transcript_path: file, prompt: '/ponytail spend limit 100' },
    { XDG_CONFIG_HOME: box },
  );
  assert.match(raise.stdout, /PONYTAIL SPEND LIMIT SET/);
  assert.doesNotMatch(raise.stdout, /deny/);
});

test('/ponytail spend reports without a limit configured', () => {
  const box = sandbox();
  const file = writeTranscript(box, assistantLines('a', 'claude-opus-5', { output_tokens: 1e6 }));
  const result = runHook(
    { hook_event_name: 'UserPromptSubmit', session_id: 'report', transcript_path: file, prompt: '/ponytail spend' },
    { XDG_CONFIG_HOME: box },
  );
  assert.match(result.stdout, /\$25\.00 this session/);
  assert.match(result.stdout, /firewall is off/);
});

test('garbage on stdin fails open instead of wedging the session', () => {
  const box = sandbox();
  const result = spawnSync(process.execPath, [hook], {
    env: { ...process.env, XDG_CONFIG_HOME: box, PONYTAIL_SPEND_LIMIT: '1' },
    input: 'not json',
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '', 'no decision at all beats a wrong one');
});

test('a missing transcript never blocks', () => {
  const box = sandbox();
  const result = runHook(
    { hook_event_name: 'PreToolUse', session_id: 'ghost', transcript_path: path.join(box, 'gone.jsonl') },
    { XDG_CONFIG_HOME: box, PONYTAIL_SPEND_LIMIT: '0.01' },
  );
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
});

test('/ponytail spend does not get eaten by the mode tracker', () => {
  const box = sandbox();
  const claudeDir = path.join(box, 'claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(path.join(claudeDir, '.ponytail-active'), 'ultra', 'utf8');

  const result = spawnSync(process.execPath, [path.join(root, 'hooks', 'ponytail-mode-tracker.js')], {
    env: { ...process.env, CLAUDE_CONFIG_DIR: claudeDir, XDG_CONFIG_HOME: box },
    input: JSON.stringify({ prompt: '/ponytail spend limit 5' }),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '', 'the tracker must stay silent on a spend command');
  assert.equal(
    fs.readFileSync(path.join(claudeDir, '.ponytail-active'), 'utf8'),
    'ultra',
    'asking about the budget must not reset the intensity level',
  );
});
