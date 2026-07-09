// Robustness audit (issue #65 follow-up): find where ponytail actually breaks on a
// weak model. 12 tasks with classic edge-case traps. Each has a known-good and a
// known-lazy-wrong reference so the instrument is verified before any API spend.
//   node robustness-audit.js --selftest   # no API: prove every check is correct
//   node robustness-audit.js              # baseline vs ponytail, gpt-5.4-mini, n=20
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ponytail: probe once at load; mirrors correctness.js
let pythonCmd;
function python() {
  if (pythonCmd) return pythonCmd;
  for (const cmd of ['python3', 'python']) {
    try { execSync(`${cmd} -c "import sys"`, { stdio: 'pipe' }); pythonCmd = cmd; return pythonCmd; }
    catch (_) {}
  }
  return pythonCmd = 'python3';
}

const N = Number(process.env.AUDIT_N) || 20;
const MODEL = process.env.AUDIT_MODEL || 'gpt-5.4-mini';
const ROOT = path.join(__dirname, '..');
let kv = {};
try {
  kv = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env'), 'utf8')
    .split(/\r?\n/).filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
} catch (_) { /* no .env — fine for --selftest */ }
const KEY = process.env.OPENAI_API_KEY || kv.OPENAI_API_KEY;
const SKILL = fs.readFileSync(path.join(ROOT, 'skills', 'ponytail', 'SKILL.md'), 'utf8');

// task = { name, prompt, names, arity, cases: [[argsArray, expected], ...], good, bad }
const TASKS = [
  { name: 'is_prime', arity: 1, names: ['is_prime', 'isprime', 'prime'],
    prompt: 'Write a Python function is_prime(n) that returns True if n is prime, else False.',
    cases: [[[2], true], [[1], false], [[0], false], [[-7], false], [[17], true], [[15], false], [[97], true]],
    good: 'def is_prime(n):\n    if n < 2: return False\n    for i in range(2, int(n**0.5)+1):\n        if n % i == 0: return False\n    return True',
    bad: 'def is_prime(n):\n    for i in range(2, n):\n        if n % i == 0: return False\n    return True' },
  { name: 'factorial', arity: 1, names: ['factorial', 'fact'],
    prompt: 'Write a Python function factorial(n).',
    cases: [[[0], 1], [[1], 1], [[5], 120], [[6], 720]],
    good: 'def factorial(n):\n    r = 1\n    for i in range(2, n+1): r *= i\n    return r',
    bad: 'def factorial(n):\n    r = 1\n    for i in range(1, n): r *= i\n    return r' },
  { name: 'fibonacci', arity: 1, names: ['fibonacci', 'fib'],
    prompt: 'Write fibonacci(n) returning the nth Fibonacci number, with fib(0)=0 and fib(1)=1.',
    cases: [[[0], 0], [[1], 1], [[2], 1], [[7], 13], [[10], 55]],
    good: 'def fibonacci(n):\n    a, b = 0, 1\n    for _ in range(n): a, b = b, a+b\n    return a',
    bad: 'def fibonacci(n):\n    a, b = 1, 1\n    for _ in range(n): a, b = b, a+b\n    return a' },
  { name: 'gcd', arity: 2, names: ['gcd'],
    prompt: 'Write gcd(a, b) returning the greatest common divisor.',
    cases: [[[12, 8], 4], [[5, 0], 5], [[0, 5], 5], [[17, 5], 1], [[100, 75], 25]],
    good: 'def gcd(a, b):\n    while b: a, b = b, a % b\n    return a',
    bad: 'def gcd(a, b):\n    for i in range(min(a, b), 0, -1):\n        if a % i == 0 and b % i == 0: return i' },
  { name: 'binary_search', arity: 2, names: ['binary_search', 'bsearch', 'search'],
    prompt: 'Write binary_search(arr, target) returning the index of target in the sorted list arr, or -1 if absent.',
    cases: [[[[1, 2, 3, 4, 5], 3], 2], [[[1, 2, 3, 4, 5], 1], 0], [[[1, 2, 3, 4, 5], 5], 4], [[[1, 2, 3, 4, 5], 6], -1], [[[], 1], -1], [[[1], 1], 0]],
    good: 'def binary_search(arr, target):\n    lo, hi = 0, len(arr)-1\n    while lo <= hi:\n        m = (lo+hi)//2\n        if arr[m] == target: return m\n        elif arr[m] < target: lo = m+1\n        else: hi = m-1\n    return -1',
    bad: 'def binary_search(arr, target):\n    lo, hi = 0, len(arr)-1\n    while lo < hi:\n        m = (lo+hi)//2\n        if arr[m] == target: return m\n        elif arr[m] < target: lo = m+1\n        else: hi = m-1\n    return -1' },
  { name: 'is_leap_year', arity: 1, names: ['is_leap_year', 'is_leap', 'leap'],
    prompt: 'Write is_leap_year(year) returning True if it is a leap year.',
    cases: [[[2000], true], [[1900], false], [[2020], true], [[2021], false], [[2400], true], [[2100], false]],
    good: 'def is_leap_year(y):\n    return y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)',
    bad: 'def is_leap_year(y):\n    return y % 4 == 0' },
  { name: 'days_in_month', arity: 2, names: ['days_in_month'],
    prompt: 'Write days_in_month(year, month) returning the number of days in that month.',
    cases: [[[2020, 2], 29], [[2021, 2], 28], [[1900, 2], 28], [[2000, 2], 29], [[2021, 4], 30], [[2021, 1], 31], [[2021, 12], 31]],
    good: 'import calendar\ndef days_in_month(year, month):\n    return calendar.monthrange(year, month)[1]',
    bad: 'def days_in_month(year, month):\n    return [31,28,31,30,31,30,31,31,30,31,30,31][month-1]' },
  { name: 'int_to_roman', arity: 1, names: ['int_to_roman', 'to_roman', 'roman'],
    prompt: 'Write int_to_roman(n) converting an integer (1-3999) to its Roman numeral string.',
    cases: [[[4], 'IV'], [[9], 'IX'], [[58], 'LVIII'], [[1994], 'MCMXCIV'], [[40], 'XL'], [[3], 'III']],
    good: "def int_to_roman(n):\n    vals=[(1000,'M'),(900,'CM'),(500,'D'),(400,'CD'),(100,'C'),(90,'XC'),(50,'L'),(40,'XL'),(10,'X'),(9,'IX'),(5,'V'),(4,'IV'),(1,'I')]\n    r=''\n    for v,s in vals:\n        while n>=v: r+=s; n-=v\n    return r",
    bad: "def int_to_roman(n):\n    vals=[(1000,'M'),(500,'D'),(100,'C'),(50,'L'),(10,'X'),(5,'V'),(1,'I')]\n    r=''\n    for v,s in vals:\n        while n>=v: r+=s; n-=v\n    return r" },
  { name: 'flatten', arity: 1, names: ['flatten'],
    prompt: 'Write flatten(lst) that fully flattens an arbitrarily nested list of integers into a flat list.',
    cases: [[[[1, [2, [3, 4]], 5]], [1, 2, 3, 4, 5]], [[[]], []], [[[1, 2, 3]], [1, 2, 3]], [[[1, [2], [[3]]]], [1, 2, 3]]],
    good: 'def flatten(lst):\n    out = []\n    for x in lst:\n        if isinstance(x, list): out.extend(flatten(x))\n        else: out.append(x)\n    return out',
    bad: 'def flatten(lst):\n    return [x for s in lst for x in (s if isinstance(s, list) else [s])]' },
  { name: 'chunk', arity: 2, names: ['chunk'],
    prompt: 'Write chunk(lst, size) splitting lst into consecutive sublists of length size (the last may be shorter).',
    cases: [[[[1, 2, 3, 4, 5], 2], [[1, 2], [3, 4], [5]]], [[[1, 2, 3, 4], 2], [[1, 2], [3, 4]]], [[[], 3], []], [[[1], 5], [[1]]]],
    good: 'def chunk(lst, size):\n    return [lst[i:i+size] for i in range(0, len(lst), size)]',
    bad: 'def chunk(lst, size):\n    return [lst[i:i+size] for i in range(0, len(lst)-size+1, size)]' },
  { name: 'clamp', arity: 3, names: ['clamp'],
    prompt: 'Write clamp(value, low, high) returning value bounded to the range [low, high].',
    cases: [[[5, 0, 10], 5], [[-1, 0, 10], 0], [[15, 0, 10], 10], [[0, 0, 10], 0], [[10, 0, 10], 10]],
    good: 'def clamp(value, low, high):\n    return max(low, min(value, high))',
    bad: 'def clamp(value, low, high):\n    if value < low: return low\n    if value > high: return high' },
  { name: 'is_palindrome', arity: 1, names: ['is_palindrome', 'palindrome', 'is_pal'],
    prompt: 'Write is_palindrome(s) returning True if s is a palindrome, ignoring case, spaces, and punctuation.',
    cases: [[['racecar'], true], [['A man, a plan, a canal: Panama'], true], [['hello'], false], [[''], true], [["No 'x' in Nixon"], true], [['ab'], false]],
    good: "def is_palindrome(s):\n    c = [ch.lower() for ch in s if ch.isalnum()]\n    return c == c[::-1]",
    bad: 'def is_palindrome(s):\n    return s == s[::-1]' },
  // Validators: the parse != validate trap. email is ponytail's one measured soft spot
  // on gpt-5.4-mini (~4-5%, parseaddr); the rest hold parity. See results writeup.
  { name: 'email', arity: 1, names: ['validate_email', 'is_valid_email', 'email_validator', 'is_valid', 'validate'],
    prompt: 'Write me a Python function that validates email addresses.',
    cases: [[['user@example.com'], true], [['a@b.co'], true], [['no-at-sign'], false], [[''], false], [['@missing-local.com'], false]],
    good: 'import re\ndef validate_email(e):\n    return bool(re.match(r"^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", e))',
    bad: 'from email.utils import parseaddr\ndef validate_email(e):\n    _, a = parseaddr(e)\n    return a == e and "@" in a' },
  { name: 'url', arity: 1, names: ['validate_url', 'is_valid_url', 'is_url', 'validate', 'is_valid'],
    prompt: 'Write a Python function that validates whether a string is a valid HTTP or HTTPS URL.',
    cases: [[['https://example.com'], true], [['http://a.b/c'], true], [['https://x.io/p?q=1'], true], [['garbage'], false], [[''], false], [['example.com'], false], [['ftp://example.com'], false], [['http://'], false]],
    good: 'from urllib.parse import urlparse\ndef validate_url(u):\n    p = urlparse(u)\n    return p.scheme in ("http","https") and bool(p.netloc)',
    bad: 'from urllib.parse import urlparse\ndef validate_url(u):\n    return bool(urlparse(u))' },
  { name: 'creditcard', arity: 1, names: ['validate_credit_card', 'is_valid_card', 'validate_card', 'luhn', 'validate', 'is_valid'],
    prompt: 'Write a Python function that validates a credit card number.',
    cases: [[['4242424242424242'], true], [['4012888888881881'], true], [['4242424242424241'], false], [['12345'], false], [['abcd'], false]],
    good: 'def validate_credit_card(n):\n    d=[int(c) for c in str(n) if c.isdigit()]\n    if len(d)<13: return False\n    s=0\n    for i,x in enumerate(reversed(d)):\n        if i%2==1:\n            x*=2\n            if x>9: x-=9\n        s+=x\n    return s%10==0',
    bad: "def validate_credit_card(n):\n    s=str(n).replace(' ','')\n    return s.isdigit() and len(s)==16" },
  { name: 'ipv4', arity: 1, names: ['validate_ipv4', 'is_valid_ip', 'is_ipv4', 'validate_ip', 'validate', 'is_valid'],
    prompt: 'Write a Python function that validates an IPv4 address.',
    cases: [[['192.168.1.1'], true], [['0.0.0.0'], true], [['255.255.255.255'], true], [['999.999.999.999'], false], [['256.1.1.1'], false], [['1.2.3'], false], [['abc'], false]],
    good: 'import ipaddress\ndef validate_ipv4(s):\n    try:\n        ipaddress.IPv4Address(s); return True\n    except Exception: return False',
    bad: "import re\ndef validate_ipv4(s):\n    return bool(re.match(r'^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$', s))" },
];

function pyBlock(text) {
  const m = [...String(text || '').matchAll(/```(\w*)\r?\n([\s\S]*?)```/g)];
  if (!m.length) return text || '';
  const py = m.find(x => /py/.test(x[1]));
  return (py || m[0])[2];
}

function checkPy(code, task) {
  const harness = `import sys, json, inspect
${code}
TARGET = ${task.arity}
names = json.loads(r'''${JSON.stringify(task.names)}''')
fn = None
for nm in names:
    if nm in dir() and callable(eval(nm)): fn = eval(nm); break
if fn is None:
    for nm, obj in list(globals().items()):
        if callable(obj) and not nm.startswith('_') and not inspect.isclass(obj):
            try:
                if len(inspect.signature(obj).parameters) == TARGET: fn = obj; break
            except (ValueError, TypeError): pass
if fn is None: print('NOFN'); sys.exit(1)
cases = json.loads(r'''${JSON.stringify(task.cases)}''')
for args, expected in cases:
    try: r = fn(*args)
    except Exception as e: print('EXC', args, e); sys.exit(1)
    if r != expected: print('MISMATCH', args, '->', r, 'want', expected); sys.exit(1)
print('PASS')`;
  const f = path.join(os.tmpdir(), `audit-${process.pid}-${Math.random().toString(36).slice(2)}.py`);
  fs.writeFileSync(f, harness);
  try { execSync(`${python()} "${f}"`, { timeout: 10000, encoding: 'utf8', stdio: 'pipe' }); return true; }
  catch (e) { return false; }
  finally { try { fs.unlinkSync(f); } catch (_) {} }
}

async function call(system, user) {
  const body = { model: MODEL, max_completion_tokens: 4096,
    messages: system ? [{ role: 'system', content: system }, { role: 'user', content: user }] : [{ role: 'user', content: user }] };
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) return { err: r.status };
  const j = await r.json();
  return { text: j.choices?.[0]?.message?.content || '' };
}

module.exports = { checkPy, pyBlock, call, TASKS, SKILL };
if (require.main !== module) return;

if (process.argv.includes('--selftest')) {
  let ok = 0, bad = 0;
  for (const t of TASKS) {
    const g = checkPy(t.good, t), b = checkPy(t.bad, t);
    const pass = g === true && b === false;
    console.log(`${pass ? 'ok ' : 'XX '} ${t.name.padEnd(16)} good=${g} bad=${b}`);
    pass ? ok++ : bad++;
  }
  console.log(`\nself-test: ${ok}/${TASKS.length} instruments valid${bad ? ` — ${bad} BROKEN` : ''}`);
  process.exit(bad ? 1 : 0);
}

(async () => {
  const arms = { baseline: null, ponytail: SKILL };
  const grid = {};
  for (const t of TASKS) {
    grid[t.name] = {};
    for (const arm of Object.keys(arms)) {
      let pass = 0, err = 0;
      for (let i = 0; i < N; i++) {
        const res = await call(arms[arm], t.prompt);
        if (res.err) { err++; continue; }
        if (checkPy(pyBlock(res.text), t)) pass++;
      }
      grid[t.name][arm] = { pass, n: N - err };
    }
    const b = grid[t.name].baseline, p = grid[t.name].ponytail;
    const flag = p.pass < b.pass ? '  <-- PONYTAIL REGRESSION' : (p.pass < p.n ? '  (both imperfect)' : '');
    console.log(`${t.name.padEnd(16)} baseline ${b.pass}/${b.n}   ponytail ${p.pass}/${p.n}${flag}`);
  }
  console.log('\n=== ponytail holes (ponytail < baseline) ===');
  let any = false;
  for (const t of TASKS) {
    const b = grid[t.name].baseline, p = grid[t.name].ponytail;
    if (p.pass < b.pass) { console.log(`  ${t.name}: ${b.pass} -> ${p.pass}`); any = true; }
  }
  if (!any) console.log('  none');
})();
