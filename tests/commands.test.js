#!/usr/bin/env node
// Every ponytail command the pi extension registers must also ship as a
// file-based command for the hosts that need one: Claude Code (commands/*.toml,
// which Gemini CLI reuses) and OpenCode (.opencode/command/*.md). /ponytail-help
// was advertised in the README and the help card but missing both files; this
// guards that drift -- a registered command with no adapter file fails here.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function readCommandTomlPrompt(name) {
  const text = fs.readFileSync(path.join(root, 'commands', `${name}.toml`), 'utf8');
  const match = text.match(/^prompt = "((?:\\.|[^"])*)"$/m);
  assert.ok(match, `missing prompt in commands/${name}.toml`);
  return JSON.parse(`"${match[1]}"`);
}

function readOpenCodeCommandPrompt(name) {
  const text = fs.readFileSync(path.join(root, '.opencode', 'command', `${name}.md`), 'utf8');
  return text.replace(/^---\n[\s\S]*?\n---\n*/, '').trim();
}

// pi-extension registers the canonical command set.
const piSource = fs.readFileSync(path.join(root, 'pi-extension', 'index.js'), 'utf8');
const commands = [...piSource.matchAll(/registerCommand\(["']([\w-]+)["']/g)].map((m) => m[1]);
const commandFiles = fs.readdirSync(path.join(root, 'commands'))
  .filter((name) => name.endsWith('.toml'))
  .map((name) => path.basename(name, '.toml'))
  .sort();
const openCodeCommands = fs.readdirSync(path.join(root, '.opencode', 'command'))
  .filter((name) => name.endsWith('.md'))
  .map((name) => path.basename(name, '.md'))
  .sort();

test('pi registers at least the base command', () => {
  assert.ok(commands.includes('ponytail'), 'expected pi to register a ponytail command');
});

test('registered command set matches shared command files', () => {
  assert.deepEqual([...commands].sort(), commandFiles);
  assert.deepEqual(openCodeCommands, commandFiles);
});

test('every registered command ships a Claude commands/*.toml', () => {
  for (const name of commands) {
    assert.ok(
      fs.existsSync(path.join(root, 'commands', `${name}.toml`)),
      `missing commands/${name}.toml`,
    );
  }
});

test('every registered command ships an OpenCode .opencode/command/*.md', () => {
  for (const name of commands) {
    assert.ok(
      fs.existsSync(path.join(root, '.opencode', 'command', `${name}.md`)),
      `missing .opencode/command/${name}.md`,
    );
  }
});

test('OpenCode command prompts match commands/*.toml', () => {
  for (const name of commands) {
    const expected = readCommandTomlPrompt(name).replace('{{args}}', '$ARGUMENTS');
    assert.equal(readOpenCodeCommandPrompt(name), expected, `${name} command prompt drifted`);
  }
});

test('ponytail-help skill lists every registered command', () => {
  const help = fs.readFileSync(path.join(root, 'skills', 'ponytail-help', 'SKILL.md'), 'utf8');
  for (const name of commands) {
    assert.match(help, new RegExp(`\\*\\*${name}\\*\\*`), `ponytail-help omits ${name}`);
    assert.match(help, new RegExp(`/${name}\\b`), `ponytail-help omits /${name}`);
  }
});

test('README command tables list every registered command', () => {
  for (const file of ['README.md', 'README.es.md', 'README.ko.md']) {
    const readme = fs.readFileSync(path.join(root, file), 'utf8');
    for (const name of commands) {
      assert.match(readme, new RegExp(`/${name}\\b`), `${file} omits /${name}`);
    }
  }
});
