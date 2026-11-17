// The records one session leaves in its transcript, in the shape Claude Code writes them: a JSON object per line.
// The prompt, `npm test`, an Edit that calls an existing helper, a Read, a Write of a new file, `npm test` again.

type Row = { [field: string]: unknown }

const use = (id: string, name: string, input: Row) => ({ type: 'tool_use', id, name, input })
const result = (id: string, content: unknown, failed = false) => ({ tool_use_id: id, type: 'tool_result', content, is_error: failed })
const reply = (id: string, content: unknown[]): Row => ({
  type: 'assistant',
  message: { id, type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'tool_use', usage: { input_tokens: 10, output_tokens: 20 }, content },
})
const answered = (content: unknown[]): Row => ({ type: 'user', message: { role: 'user', content } })

const LEGACY = 'export function legacy(cart: Cart) {\n  return 0\n}'
const SEND = 'export function send(cart: Cart) {\n  return lineTotal(cart.items)\n}'
const TOTALS = 'export function lineTotal(items: number[]) {\n  return items.reduce((sum, n) => sum + n, 0)\n}\n'
const PASS_14 = '> shop@1.0.0 test\n> node --test tests/*.test.js\n\nℹ tests 14\nℹ suites 3\nℹ pass 14\nℹ fail 0\nℹ cancelled 0'
const PASS_15 = '> shop@1.0.0 test\n> node --test tests/*.test.js\n\nℹ tests 15\nℹ suites 3\nℹ pass 15\nℹ fail 0\nℹ cancelled 0'

const RECORDS: Row[] = [
  { type: 'user', message: { role: 'user', content: 'send the cart through the new totals helper and keep the tests green' } },
  reply('msg_1', [use('toolu_01', 'Bash', { command: 'npm test', description: 'Run the test suite' })]),
  answered([result('toolu_01', PASS_14)]),
  reply('msg_2', [use('toolu_02', 'Edit', { file_path: '/repo/src/cart.ts', old_string: LEGACY, new_string: SEND, replace_all: false })]),
  answered([result('toolu_02', 'The file /repo/src/cart.ts has been updated.')]),
  reply('msg_3', [use('toolu_03', 'Read', { file_path: '/repo/src/money.ts' })]),
  answered([result('toolu_03', [{ type: 'text', text: '1\texport function lineTotal(items: number[]) {' }])]),
  reply('msg_4', [use('toolu_04', 'Write', { file_path: '/repo/src/totals.ts', content: TOTALS })]),
  answered([result('toolu_04', 'File created successfully at: /repo/src/totals.ts')]),
  reply('msg_5', [use('toolu_05', 'Bash', { command: 'npm test', description: 'Re-run the test suite' })]),
  answered([result('toolu_05', PASS_15)]),
]

export const BAND_SESSION = RECORDS.map(row => JSON.stringify(row)).join('\n')
