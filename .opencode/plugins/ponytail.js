// ponytail — OpenCode plugin
// Lazy senior dev mode. Uses session.created to inject instructions
// and tui.prompt.append to track mode switches.

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOKS_DIR = __dirname;
const statePath = path.join(os.homedir(), '.config', 'opencode', '.ponytail-active');

function setMode(mode) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, mode);
}

function clearMode() {
  try { fs.unlinkSync(statePath); } catch (e) {}
}

function readMode() {
  try { return fs.readFileSync(statePath, 'utf8').trim(); } catch (e) { return null; }
}

function getConfigDir() {
  if (process.env.XDG_CONFIG_HOME) return path.join(process.env.XDG_CONFIG_HOME, 'ponytail');
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'ponytail');
  return path.join(os.homedir(), '.config', 'ponytail');
}

function getDefaultMode() {
  const envMode = process.env.PONYTAIL_DEFAULT_MODE;
  if (envMode && ['off', 'lite', 'full', 'ultra', 'review'].includes(envMode.toLowerCase())) return envMode.toLowerCase();
  try {
    const config = JSON.parse(fs.readFileSync(path.join(getConfigDir(), 'config.json'), 'utf8'));
    if (config.defaultMode && ['off', 'lite', 'full', 'ultra', 'review'].includes(config.defaultMode.toLowerCase())) return config.defaultMode.toLowerCase();
  } catch (e) {}
  return 'full';
}

const SKILL_PATH = path.join(__dirname, '..', 'skills', 'ponytail', 'SKILL.md');

function filterSkillBodyForMode(body, mode) {
  const withoutFrontmatter = String(body || '').replace(/^---[\s\S]*?---\s*/, '');
  return withoutFrontmatter.split(/\r?\n/).filter((line) => {
    const tableMatch = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|/);
    if (tableMatch) return tableMatch[1].trim() === mode;
    const exampleMatch = line.match(/^-\s*([^:]+):\s*/);
    if (exampleMatch) return exampleMatch[1].trim() === mode;
    return true;
  }).join('\n');
}

function getFallbackInstructions(mode) {
  return 'PONYTAIL MODE ACTIVE — level: ' + mode + '\n\n' +
    'You are a lazy senior developer. Lazy means efficient, not careless. The best code is the code never written.\n\n' +
    '## Persistence\n\n' +
    'ACTIVE EVERY RESPONSE. No drift back to over-building. Still active if unsure. Off only: "stop ponytail" / "normal mode".\n\n' +
    'Current level: **' + mode + '**. Switch: `/ponytail lite|full|ultra`.\n\n' +
    '## The ladder\n\n' +
    'Before any code, stop at the first rung that holds:\n' +
    '1. Does this need to be built at all? (YAGNI)\n' +
    '2. Does the standard library do this? Use it.\n' +
    '3. Does a native platform feature cover it? Use it.\n' +
    '4. Does an already-installed dependency solve it? Use it.\n' +
    '5. Can this be one line? Make it one line.\n' +
    '6. Only then: write the minimum code that works.\n\n' +
    '## Rules\n\n' +
    'No abstractions that were not requested. No avoidable dependencies. No boilerplate nobody asked for. ' +
    'Deletion over addition. Boring over clever. Fewest files possible. ' +
    'Ship the lazy version and question the complex request in the same response — never stall. ' +
    'Between two same-size stdlib options, pick the one correct on edge cases. ' +
    'Mark intentional simplifications with a `ponytail:` comment.\n\n' +
    '## Output\n\n' +
    'Code first. Then at most three short lines: what was skipped, when to add it. ' +
    'If the explanation is longer than the code, delete the explanation.\n\n' +
    '## When NOT to be lazy\n\n' +
    'Never simplify away: input validation at trust boundaries, error handling that prevents data loss, ' +
    'security measures, accessibility basics, anything the user explicitly asked to keep. ' +
    'Non-trivial logic leaves ONE runnable check behind. Trivial one-liners need no test.\n\n' +
    '## Boundaries\n\n' +
    'Ponytail governs what you build, not how you talk. "stop ponytail" or "normal mode": revert. Level persists until changed or session end.';
}

function getInstructions(mode) {
  if (mode === 'review') return 'PONYTAIL MODE ACTIVE — level: review. Behavior defined by /ponytail-review skill.';
  try {
    return 'PONYTAIL MODE ACTIVE — level: ' + mode + '\n\n' + filterSkillBodyForMode(fs.readFileSync(SKILL_PATH, 'utf8'), mode);
  } catch (e) {
    return getFallbackInstructions(mode);
  }
}

function injectSystemPrompt(context, instructions) {
  // Uses the experimental.session.compacting hook pattern to inject context
  // For session start, we inject via system prompt addition
  return instructions;
}

module.exports = {
  PonytailPlugin: async ({ client, directory }) => {
    const log = async (level, message) => {
      try {
        await client.app.log({ body: { service: 'ponytail', level, message } });
      } catch (e) {}
    };

    return {
      'session.created': async (input, output) => {
        const mode = getDefaultMode();
        if (mode === 'off') {
          clearMode();
          return;
        }

        setMode(mode);
        const instructions = getInstructions(mode);

        // Inject instructions into the session via system prompt
        // OpenCode supports adding to output.systemPrompt for session.created
        if (output && output.systemPrompt) {
          output.systemPrompt += '\n\n' + instructions;
        }

        await log('info', `Ponytail activated: ${mode}`);
      },

      'tui.prompt.append': async (input) => {
        const prompt = (input.prompt || '').trim().toLowerCase();

        // Match /ponytail commands
        if (/^[/@$]ponytail/.test(prompt)) {
          const parts = prompt.split(/\s+/);
          const cmd = parts[0].replace(/^[@$]/, '/');
          const arg = parts[1] || '';

          let mode = null;

          if (cmd === '/ponytail-review' || cmd === '/ponytail:ponytail-review') {
            mode = 'review';
          } else if (cmd === '/ponytail' || cmd === '/ponytail:ponytail') {
            if (arg === 'lite') mode = 'lite';
            else if (arg === 'full') mode = 'full';
            else if (arg === 'ultra') mode = 'ultra';
            else if (arg === 'off') mode = 'off';
            else mode = getDefaultMode();
          }

          if (mode && mode !== 'off') {
            setMode(mode);
            await log('info', `Ponytail mode changed: ${mode}`);
          } else if (mode === 'off') {
            clearMode();
            await log('info', 'Ponytail deactivated');
          }
        }

        // Detect deactivation phrases
        if (/\b(stop ponytail|normal mode)\b/i.test(prompt)) {
          clearMode();
          await log('info', 'Ponytail deactivated via phrase');
        }
      },
    };
  },
};
