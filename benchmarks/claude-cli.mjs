// No automatically loaded tools/plugins/skills/project context; the Ponytail
// arm supplies its skill explicitly for this single-shot Claude CLI benchmark.
// Default is a dry run; --run explicitly permits API calls. --probe runs email only.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import loc from './loc.js';
import correctness from './correctness.js';

const execute = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tasks = JSON.parse(fs.readFileSync(path.join(root, 'benchmarks/prompts.json'), 'utf8')).tasks;
const skill = fs.readFileSync(path.join(root, 'skills/ponytail/SKILL.md'), 'utf8');
const models = ['claude-opus-5', 'claude-fable-5-1'];
const probe = process.argv.includes('--probe');
const cells = [];
for (let repetition = 1; repetition <= (probe ? 1 : 3); repetition++) {
  for (const task of probe ? tasks.slice(0, 1) : tasks) {
    for (const arm of probe ? ['baseline'] : ['baseline', 'ponytail']) {
      for (const model of models) cells.push({ model, arm, repetition, task });
    }
  }
}

function argumentsFor(cell) {
  return ['-p', cell.task.prompt, '--safe-mode', '--system-prompt', cell.arm === 'baseline' ? '' : skill,
    '--tools', '', '--disable-slash-commands', '--strict-mcp-config', '--no-session-persistence',
    '--output-format', 'json', '--effort', 'medium', '--max-budget-usd', '0.4', '--model', cell.model];
}

if (process.argv.includes('--self-check')) {
  assert.equal(cells.length, 60);
  const args = argumentsFor(cells[0]);
  assert.equal(args[args.indexOf('--system-prompt') + 1], '');
  assert.equal(args[args.indexOf('--tools') + 1], '');
  assert.equal(argumentsFor({ ...cells[0], arm: 'ponytail' })[4], skill);
  console.log('PASS: 60 cells, blank baseline, exact skill, no tools');
} else if (!process.argv.includes('--run')) {
  const gradeArg = process.argv.indexOf('--grade');
  if (gradeArg >= 0) {
    const outputArg = process.argv.indexOf('--output');
    assert(outputArg >= 0 && process.argv[outputArg + 1], '--output <new-file.json> required');
    const artifact = JSON.parse(fs.readFileSync(process.argv[gradeArg + 1], 'utf8'));
    const login = os.userInfo().username.toLowerCase();
    for (const sample of artifact.samples) {
      if (sample.failure) continue;
      const original = sample.response.result;
      sample.originalResponseTextSHA256 = createHash('sha256').update(original).digest('hex');
      sample.initialCorrectness = sample.correctness;
      sample.correctness = correctness(original, { vars: { task: sample.task.prompt } });
      sample.hasFencedCode = /```[a-zA-Z0-9_+-]*\r?\n/.test(original);
      sample.locInterpretation = sample.hasFencedCode ? 'fenced code' : 'whole-response fallback; may include prose';
      let redactions = 0;
      sample.response.result = original.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (email) => {
        if (!email.toLowerCase().startsWith(login)) return email;
        redactions++;
        return 'example.user@example.com';
      });
      let identifiers = 0;
      sample.response.result = sample.response.result.replace(/\b[\w.-]+\b/g, (word) => {
        if (word.toLowerCase() !== login) return word;
        identifiers++;
        return 'operator';
      });
      assert.equal(loc(sample.response.result).score, sample.codeLOC, 'Redaction changed LOC');
      sample.publishedResponseTextSHA256 = createHash('sha256').update(sample.response.result).digest('hex');
      if (redactions || identifiers) {
        sample.redactedCorrectness = correctness(sample.response.result, { vars: { task: sample.task.prompt } });
        assert.equal(sample.redactedCorrectness.pass, sample.correctness.pass, 'Redaction changed gate outcome');
        assert.equal(sample.redactedCorrectness.score, sample.correctness.score, 'Redaction changed gate score');
        sample.redactions = { operatorLikeEmailExamples: redactions, operatorNameMentions: identifiers,
          emailReplacement: 'example.user@example.com', identifierReplacement: 'operator', gatePassAndScorePreserved: true };
      }
    }
    artifact.offlineGrading = { date: new Date().toISOString(), environment: 'Python with pandas installed; unchanged correctness.js',
      note: 'Initial gate retained; offline gate uses original text. Email-example redactions preserve LOC.' };
    artifact.unmeasuredReserveUSD = artifact.samples.filter(s => s.failure && !s.response).length * 0.4;
    fs.writeFileSync(process.argv[outputArg + 1], JSON.stringify(artifact, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(`Regraded ${artifact.samples.length} samples without model calls`);
    process.exit(0);
  }
  console.log(JSON.stringify({ calls: cells.length, models, budgetUSD: 8, perCallUSD: 0.4,
    baseline: 'Empty custom system; CLI billing header and SDK identity remain in both arms.' }, null, 2));
} else {
  const outputArg = process.argv.indexOf('--output');
  assert(outputArg >= 0 && process.argv[outputArg + 1], '--output <new-file.json> required');
  const output = path.resolve(process.argv[outputArg + 1]);
  const resumeArg = process.argv.indexOf('--resume');
  const artifact = resumeArg >= 0 ? JSON.parse(fs.readFileSync(process.argv[resumeArg + 1], 'utf8')) : {
    created: new Date().toISOString(), method: 'single-shot text, not agentic',
    cliVersion: (await execute('claude', ['--version'])).stdout.trim(), nodeVersion: process.version, priorProbeCostUSD: 0,
    skillSHA256: createHash('sha256').update(skill).digest('hex'), samples: [], stopped: [] };
  assert.equal(artifact.skillSHA256, createHash('sha256').update(skill).digest('hex'), 'Resume skill differs');
  assert(artifact.samples.every(s => tasks.some(t => t.id === s.task.id && t.prompt === s.task.prompt)), 'Resume tasks differ');
  artifact.stopped = artifact.stopped.filter(reason => !reason.endsWith(': timeout'));
  fs.writeFileSync(output, JSON.stringify(artifact, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  let cost = artifact.estimatedCostUSD ?? artifact.priorProbeCostUSD;
  let unmeasuredReserve = artifact.samples.filter(s => s.failure && !s.response).length * 0.4;
  const blocked = new Set(artifact.samples.filter(s => s.failure && s.failure !== 'timeout').map(s => s.model));
  for (const cell of cells) {
    if (blocked.has(cell.model)) continue;
    if (artifact.samples.some(s => s.model === cell.model && s.arm === cell.arm && s.repetition === cell.repetition && s.task.id === cell.task.id)) continue;
    if (cost + unmeasuredReserve + 0.4 > 8) { artifact.stopped.push('Budget reservation would exceed $8'); break; }
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-cli-bench-'));
    let stdout;
    let failure;
    try {
      ({ stdout } = await execute('claude', argumentsFor(cell), { cwd, timeout: 180000,
        killSignal: 'SIGKILL', maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' }));
    } catch (error) {
      stdout = error.stdout;
      failure = error.killed ? 'timeout' : `CLI exit ${error.code}`;
    }
    let response;
    try { response = JSON.parse(stdout); } catch { failure = failure || 'Invalid JSON response'; }
    if (response) {
      delete response.session_id;
      delete response.uuid;
      cost += response.total_cost_usd || 0;
    }
    if (!response) unmeasuredReserve += 0.4;
    const exactModel = response?.modelUsage?.[cell.model];
    if (response?.is_error) failure = failure || response.result || 'API error';
    if (!exactModel) failure = failure || 'Requested model absent from telemetry';
    const sample = { ...cell, response, ...(failure ? { failure } : {
      codeLOC: loc(response.result).score, correctness: correctness(response.result, { vars: { task: cell.task.prompt } }),
    }) };
    artifact.samples.push(sample);
    if (failure && failure !== 'timeout') { blocked.add(cell.model); artifact.stopped.push(`${cell.model}: ${failure}`); }
    artifact.estimatedCostUSD = cost;
    artifact.unmeasuredReserveUSD = unmeasuredReserve;
    fs.writeFileSync(output, JSON.stringify(artifact, null, 2) + '\n');
    console.log(`${artifact.samples.length}/${cells.length} ${cell.model} ${cell.arm} ${cell.task.id}: ${failure || 'completed'}; $${cost.toFixed(6)}`);
  }
  fs.writeFileSync(output, JSON.stringify(artifact, null, 2) + '\n');
}
