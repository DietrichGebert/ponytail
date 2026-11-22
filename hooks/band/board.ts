// The task board: one self-contained HTML page built from the band's CSV ledgers.
// No server and no network: inline CSS, inline SVG and a few lines of script.

import { LOGO_PATHS, LOGO_VIEWBOX } from './logo'

export const duration = (minutes: number) =>
  minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`

// Agent time reads better with seconds while it is short.
export const elapsed = (ms: number) => {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return duration(Math.round(s / 60))
}

export const fmtTokens = (n: number) =>
  n < 1000 ? `${n}` : n < 1e6 ? `${+(n / 1e3).toFixed(1)}k` : `${+(n / 1e6).toFixed(1)}M`

export type Task = {
  started: string
  project: string
  name: string
  cost: number
  turns: number
  agentMinutes: number
  tokens: number
  reuse: number | null
  tests: string
  level: string
  model: string
}

// RFC 4180 rows: quoted fields may hold commas, doubled quotes and line breaks.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      if (row.some(f => f !== '')) rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  row.push(field)
  if (row.some(f => f !== '')) rows.push(row)
  return rows
}

export function tasksFrom(text: string): Task[] {
  const [head, ...rows] = parseCsv(text)
  if (!head?.includes('key')) return []
  const at = (row: string[], col: string) => row[head.indexOf(col)] ?? ''
  const num = (row: string[], col: string) => Number(at(row, col)) || 0
  return rows.map(row => ({
    started: at(row, 'started'),
    project: at(row, 'project'),
    name: at(row, 'name'),
    cost: num(row, 'cost_usd'),
    turns: num(row, 'turns'),
    agentMinutes: num(row, 'agent_minutes'),
    tokens: num(row, 'tokens_total'),
    reuse: at(row, 'reuse_pct') === '' ? null : num(row, 'reuse_pct'),
    tests: at(row, 'tests'),
    level: at(row, 'level'),
    model: at(row, 'model'),
  }))
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const day = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Project colours, in sidebar order; the share card carries a gradient for each.
const PALETTE = ['#5fe08a', '#7c8cff', '#2fd4c0', '#ff8a3d', '#ff6fb5', '#ffd166', '#4cc3ff', '#b26bff']

const LIGHT = 'color-scheme:light;--bg:#f5f5f3;--panel:#fff;--card:#fff;--line:#ebeae6;--line2:#dedcd6;--text:#1d1c1a;--muted:#77756f;--faint:#a9a7a0;--track:#f2f1ed;--segOn:#fff;--tip:#1d1c1a;--tipText:#fff;--ok:#2f7d3b;--okbg:#e8f5e9;--bad:#b4401b;--badbg:#fcebe4;--warn:#946200;--warnbg:#fbf2d7;--nonebg:#f2f1ed;--empty:#eeede9;--tint:.12;--glow:.45;--shadow:0 1px 2px rgba(25,25,15,.05)'
const MONO_CSS = '"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace'

// Dark is the default; light (chosen, or the system's when "system" is chosen) keeps the same layout.
const CSS = `:root{color-scheme:dark;--bg:#060606;--panel:#0c0c0c;--card:linear-gradient(180deg,#0f0f0f,#090909);--line:#1c1c1b;--line2:#262624;--text:#f3f2ee;--muted:#8d8b84;--faint:#5e5c55;--track:#141413;--segOn:#1f1f1d;--tip:#050505;--tipText:#f3f2ee;--ok:#5fe08a;--okbg:#122016;--bad:#ff6b5b;--badbg:#2a1210;--warn:#f1c96b;--warnbg:#2a2412;--nonebg:#161615;--empty:#151514;--tint:.2;--glow:1;--shadow:inset 0 1px 0 rgba(255,255,255,.035),0 20px 50px rgba(0,0,0,.35)}
:root[data-theme=light]{${LIGHT}}
@media (prefers-color-scheme:light){:root[data-theme=system]{${LIGHT}}}
*{box-sizing:border-box}html,body{margin:0}body{background:var(--bg);color:var(--text);font:14px/1.5 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
.num{font-family:${MONO_CSS};font-variant-numeric:tabular-nums;letter-spacing:-.03em}
.sprite{position:absolute;width:0;height:0;overflow:hidden}
.app{display:grid;grid-template-columns:264px minmax(0,1fr);min-height:100vh}
.side{border-right:1px solid var(--line);padding:24px 16px;display:flex;flex-direction:column;gap:2px;position:sticky;top:0;height:100vh}
.brand{display:flex;align-items:center;gap:10px;font:600 15px/1 ${MONO_CSS};padding:0 10px 24px}
.logo{width:28px;height:32px;flex:none}.logo svg{width:100%;height:100%;display:block}
.side-label{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);padding:6px 10px}
.nav-item{display:flex;align-items:center;gap:10px;width:100%;border:0;background:transparent;color:var(--muted);font:inherit;padding:8px 10px;border-radius:10px;cursor:pointer;text-align:left}
.nav-item .name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nav-item:hover,.nav-item.on{background:var(--track);color:var(--text)}
.nav-item .n{font:12px ${MONO_CSS};color:var(--faint)}
.dot{width:8px;height:8px;border-radius:50%;flex:none;background:var(--c);box-shadow:0 0 10px var(--c)}
.side-foot{margin-top:auto;display:flex;align-items:center;gap:10px;font-size:12px;color:var(--faint);padding:12px 2px 0 10px;border-top:1px solid var(--line)}.foot-text{flex:1;min-width:0}.foot-sep{width:1px;align-self:stretch;margin:4px 0;background:var(--line)}
.theme{display:grid;place-items:center;width:34px;height:34px;flex:none;border:0;border-radius:9px;background:transparent;color:var(--muted);cursor:pointer}.theme:hover{background:var(--track);color:var(--text)}.theme svg{display:none}.theme[data-choice=system] .i-system,.theme[data-choice=light] .i-light,.theme[data-choice=dark] .i-dark{display:block}
main{padding:26px 32px 56px;min-width:0;max-width:1400px;width:100%;margin:0 auto}
.top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:22px;flex-wrap:wrap}
.crumb{color:var(--faint);font-size:13px}.crumb b{color:var(--muted);font-weight:500}
h1{margin:2px 0 0;font-size:26px;font-weight:650;letter-spacing:-.02em}.top p{margin:2px 0 0;color:var(--muted)}
.actions{display:flex;gap:10px;align-items:center}
.seg{display:inline-flex;background:var(--track);border:1px solid var(--line);border-radius:12px;padding:3px;flex:none}
.seg button{border:0;background:transparent;color:var(--muted);font:inherit;font-size:13px;padding:6px 12px;border-radius:9px;cursor:pointer}
.seg button.on{background:var(--segOn);color:var(--text);box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 0 0 1px var(--line2)}
.btn{border:1px solid var(--line2);background:var(--track);color:var(--text);font:inherit;font-size:13px;padding:8px 14px;border-radius:11px;cursor:pointer}.btn:hover{border-color:var(--faint)}
.card{background:var(--card);border:1px solid var(--line);border-radius:22px;box-shadow:var(--shadow)}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:14px}
.kpi{padding:18px 20px 0;position:relative;overflow:hidden}
.kpi::after{content:"";position:absolute;left:0;right:0;bottom:0;height:75%;background:radial-gradient(120% 100% at 50% 135%,var(--k),transparent 70%);opacity:var(--tint);pointer-events:none}
.kpi-label{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:13px}
.kpi-label::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--k);box-shadow:0 0 10px var(--k)}
.kpi-value{font-size:30px;margin-top:4px;white-space:nowrap}
.delta{font:12px ${MONO_CSS};margin-left:8px;vertical-align:6px}.up{color:var(--ok)}.down{color:var(--bad)}
.kpi-note{color:var(--faint);font-size:12px}
.spark{display:block;width:calc(100% + 40px);height:58px;margin:10px -20px 0;position:relative;z-index:1}
.glow-line{opacity:calc(var(--glow) * .8)}
.chart-card{padding:22px 24px 18px;margin-bottom:14px}
.chart-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
.label{color:var(--muted);font-size:13px}.big{font-size:40px;line-height:1.15;margin-top:2px}
.chart-wrap{position:relative;margin-top:6px}
#stream{display:block;width:100%;height:340px;overflow:visible}
.axis{fill:var(--faint);font:11px ${MONO_CSS}}.base{stroke:var(--line2)}.empty-chart{fill:var(--faint);font-size:13px}
.glow{opacity:calc(var(--glow) * .14)}.top-line{stroke:var(--text);stroke-opacity:.35;fill:none}
.hover-line{stroke:var(--text);stroke-opacity:.5}
.tip{position:absolute;pointer-events:none;background:var(--tip);color:var(--tipText);border:1px solid var(--line2);border-radius:12px;padding:7px 11px;font-size:12px;transform:translate(-50%,calc(-100% - 12px));white-space:nowrap;box-shadow:0 10px 30px rgba(0,0,0,.35)}
.tip-date{opacity:.65}.tip-value{font:600 13px ${MONO_CSS}}.heat-tip{position:fixed;z-index:5}
.legend{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.chip{display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:10px;background:var(--track);border:1px solid var(--line);color:var(--text);font:inherit;font-size:13px;cursor:pointer}
.chip .x{color:var(--faint)}.chip[aria-pressed=false]{opacity:.45}
.grid2{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:14px;align-items:start}
.list{padding:20px 0 6px}
.list-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:0 22px 14px}
h3{margin:0;font-size:15px;font-weight:600}h3 .n{color:var(--faint);font-weight:400;margin-left:4px}
.search{display:flex;align-items:center;gap:8px;background:var(--track);border:1px solid var(--line);border-radius:10px;padding:6px 10px;width:220px;color:var(--faint)}
.search input{border:0;outline:0;background:transparent;color:var(--text);font:inherit;font-size:13px;width:100%}
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;font-weight:400;color:var(--faint);font-size:12px;padding:0 10px 10px;white-space:nowrap}
th:first-child,td:first-child{padding-left:22px}th:last-child,td:last-child{padding-right:22px}
td{padding:11px 10px;border-top:1px solid var(--line);white-space:nowrap;vertical-align:middle}
th.r,td.r{text-align:right}
td.name{white-space:normal;min-width:140px;width:100%;max-width:0}.task{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sub{font-size:12px;color:var(--faint)}
.bar{height:3px;border-radius:2px;margin-top:6px;background:linear-gradient(90deg,var(--c),transparent)}
.pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:3px 9px;border-radius:999px;background:var(--nonebg);color:var(--muted)}
.pill i{width:6px;height:6px;border-radius:50%;background:currentColor}
.pill.ok{background:var(--okbg);color:var(--ok)}.pill.bad{background:var(--badbg);color:var(--bad)}.pill.warn{background:var(--warnbg);color:var(--warn)}
td.empty{text-align:center;color:var(--faint);padding:32px}
.heat{padding:20px 22px}.heat .sub{margin:2px 0 14px}
#heat{display:block;width:100%;height:auto}.cell-empty{fill:var(--empty)}.glow-cell{opacity:calc(var(--glow) * .45)}.day{fill:var(--faint);font:12px ${MONO_CSS}}
.heroes{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px}.hero-label{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:12px}.hero-label i{font-style:normal;font-size:11px}.hero-value{font-size:30px;margin-top:4px;white-space:nowrap}.hero-sub{font-size:12px;color:var(--faint);margin-top:2px}.hero-sub b{color:var(--ok);font-weight:500;margin-right:6px}
#facts{margin-top:16px}.fact{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-top:1px solid var(--line);color:var(--muted)}.fact .num{color:var(--text)}
footer{color:var(--faint);font-size:12px;margin-top:22px}
dialog{border:1px solid var(--line);border-radius:18px;padding:0;background:var(--panel);color:var(--text);box-shadow:0 24px 70px rgba(0,0,0,.4);width:min(840px,92vw)}
dialog::backdrop{background:rgba(0,0,0,.55)}
.dlg-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--line)}
.dlg-actions{display:flex;gap:8px}.dlg-body{padding:18px}.dlg-body svg{width:100%;height:auto;display:block;border-radius:12px}
@media (max-width:1360px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:1100px){.grid2{grid-template-columns:minmax(0,1fr)}}
@media (max-width:860px){.app{grid-template-columns:minmax(0,1fr)}.side{position:static;height:auto;flex-direction:row;flex-wrap:wrap;align-items:center;border-right:0;border-bottom:1px solid var(--line)}
.side-label,.foot-text,.foot-sep{display:none}.side-foot{margin:0 0 0 auto;padding:0;border:0}.brand{padding:2px 10px}#projects{display:flex;gap:4px;flex-wrap:wrap}.nav-item{width:auto}
main{padding:16px}.search{width:160px}.big{font-size:32px}}
@media (max-width:520px){.kpis{grid-template-columns:minmax(0,1fr)}.top .actions{width:100%;justify-content:space-between}.list-head{flex-wrap:wrap}.search{width:100%}}`

// The page draws itself from the JSON block: project picker, period, charts and table need no reload.
// Names only ever reach the page as text (textContent), never as HTML.
const APP = `(function () {
  var D = JSON.parse(document.getElementById('board-data').textContent)
  var tasks = D.tasks, now = D.now, DAY = 86400000, NS = 'http://www.w3.org/2000/svg'
  var state = { project: '', metric: 'time', q: '', period: 30, hidden: {} }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  var PALETTE = ${JSON.stringify(PALETTE)}
  // Each KPI its own colour pair, apart from the project colours: the line runs from one to the other.
  var KPI = [['sessions', '#4cc3ff', '#7c8cff'], ['time', '#2fd4c0', '#5fe08a'], ['cost', '#ffd166', '#ff8a3d'], ['tokens', '#ff6fb5', '#b26bff']]
  function byId(id) { return document.getElementById(id) }
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e }
  function svg(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.append(e); return e }
  function two(n) { return (n < 10 ? '0' : '') + n }
  function dayKey(ms) { var d = new Date(ms); return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()) }
  // claude-opus-5-5 reads as Opus 5.5; a trailing date in the id is dropped.
  function modelName(m) { var p = m.replace(/^claude-/, '').split('-'); return p[0] ? p[0][0].toUpperCase() + p[0].slice(1) + (p.length > 1 ? '\\u00a0' + p.slice(1).filter(function (x) { return x.length < 3 }).join('.') : '') : '' }
  function shortDate(key) { return MONTHS[+key.slice(5, 7) - 1] + ' ' + +key.slice(8, 10) }
  function dur(min) { return min < 60 ? min + 'm' : Math.floor(min / 60) + 'h ' + (min % 60) + 'm' }
  function time(ms) { var s = Math.round(ms / 1000); return s < 60 ? s + 's' : s < 3600 ? Math.floor(s / 60) + 'm ' + (s % 60) + 's' : dur(Math.round(s / 60)) }
  function tok(n) { return n < 1000 ? String(Math.round(n)) : n < 1e6 ? +(n / 1e3).toFixed(1) + 'k' : +(n / 1e6).toFixed(1) + 'M' }
  function money(n) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's') }
  function add(a, b) { return a + b }
  var METRICS = {
    sessions: { label: 'Sessions', pick: function () { return 1 }, fmt: String },
    time: { label: 'Agent time', pick: function (t) { return t.agentMinutes * 60000 }, fmt: time },
    cost: { label: 'Cost', pick: function (t) { return t.cost }, fmt: money },
    tokens: { label: 'Tokens', pick: function (t) { return t.tokens }, fmt: tok }
  }
  function total(list, pick) { return list.map(pick).reduce(add, 0) }
  function latest(name) { return tasks.filter(function (t) { return t.project === name }).reduce(function (m, t) { return t.started > m ? t.started : m }, '') }
  var names = Array.from(new Set(tasks.map(function (t) { return t.project }))).sort(function (a, b) { return latest(b).localeCompare(latest(a)) })
  function colorOf(name) { return PALETTE[names.indexOf(name) % PALETTE.length] }
  function scope() { return state.project ? tasks.filter(function (t) { return t.project === state.project }) : tasks }
  function first(list) { return list.reduce(function (m, t) { return !m || t.started < m ? t.started : m }, '') }
  // Days the chosen period covers; "All" reaches back to the first session on screen.
  function span() {
    if (state.period) return state.period
    var f = first(scope())
    return f ? Math.max(7, Math.round((now - new Date(f.slice(0, 10) + 'T00:00').getTime()) / DAY) + 1) : 30
  }
  function days(n) { var out = []; for (var i = n - 1; i >= 0; i--) out.push(dayKey(now - i * DAY)); return out }
  function inDays(list, keys) { return list.filter(function (t) { return keys.indexOf(t.started.slice(0, 10)) >= 0 }) }
  function perDay(list, keys, pick) { return keys.map(function (k) { return total(list.filter(function (t) { return t.started.slice(0, 10) === k }), pick) }) }
  function avg(values, r) { return values.map(function (_, i) { var a = values.slice(Math.max(0, i - r), i + r + 1); return a.reduce(add, 0) / a.length }) }
  // Monotone cubic through the points (as d3's curveMonotoneX): flat at peaks and valleys, never past a point.
  function smooth(p) {
    var n = p.length, m = [], d = 'M' + p[0][0].toFixed(1) + ',' + p[0][1].toFixed(1)
    function slope(i) { return (p[i + 1][1] - p[i][1]) / (p[i + 1][0] - p[i][0]) }
    if (n < 3) return n < 2 ? d : d + 'L' + p[1][0].toFixed(1) + ',' + p[1][1].toFixed(1)
    for (var i = 1; i < n - 1; i++) {
      var s0 = slope(i - 1), s1 = slope(i)
      m[i] = (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), Math.abs(s0 + s1) / 4) || 0
    }
    m[0] = (3 * slope(0) - m[1]) / 2; m[n - 1] = (3 * slope(n - 2) - m[n - 2]) / 2
    for (i = 0; i < n - 1; i++) {
      var dx = (p[i + 1][0] - p[i][0]) / 3
      d += 'C' + (p[i][0] + dx).toFixed(1) + ',' + (p[i][1] + m[i] * dx).toFixed(1) + ' ' + (p[i + 1][0] - dx).toFixed(1) + ',' + (p[i + 1][1] - m[i + 1] * dx).toFixed(1) + ' ' + p[i + 1][0].toFixed(1) + ',' + p[i + 1][1].toFixed(1)
    }
    return d
  }
  function gradient(parent, id, x2, y2, stops) {
    var g = svg('linearGradient', { id: id, gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: x2, y2: y2 }, parent)
    stops.forEach(function (s) { svg('stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] }, g) })
  }
  function blur(parent, id, sd) { svg('feGaussianBlur', { stdDeviation: sd }, svg('filter', { id: id, x: '-20%', y: '-50%', width: '140%', height: '200%' }, parent)) }

  function sidebar() {
    var nav = byId('projects'); nav.textContent = ''
    ;[['', 'All projects', tasks.length]].concat(names.map(function (n) { return [n, n, tasks.filter(function (t) { return t.project === n }).length] })).forEach(function (p) {
      var b = h('button', 'nav-item' + (state.project === p[0] ? ' on' : '')); b.type = 'button'; b.title = p[1]
      if (p[0]) { var d = h('span', 'dot'); d.style.setProperty('--c', colorOf(p[0])); b.append(d) }
      b.append(h('span', 'name', p[1]), h('span', 'n', String(p[2])))
      b.addEventListener('click', function () { state.project = p[0]; state.hidden = {}; render() })
      nav.append(b)
    })
  }

  function header() {
    var list = scope(), name = state.project || 'All projects', f = first(list)
    byId('crumb').textContent = name
    byId('title').textContent = name
    byId('subtitle').textContent = plural(list.length, 'session') + (f ? ' since ' + shortDate(f.slice(0, 10)) + ', ' + f.slice(0, 4) : '')
  }

  function sparkline(values, i, k) {
    var W = 300, H = 58, s = svg('svg', { viewBox: '0 0 300 58', preserveAspectRatio: 'none', 'class': 'spark', 'aria-hidden': 'true' })
    var vals = values.length > 14 ? avg(values, 2) : values, max = Math.max.apply(null, vals.concat([0]))
    if (max <= 0) return s
    var defs = svg('defs', {}, s)
    gradient(defs, 'kl' + i, W, 0, [[0, k[1], 1], [1, k[2], 1]])
    gradient(defs, 'kf' + i, 0, H, [[0, k[2], .38], [1, k[1], 0]])
    blur(defs, 'kg' + i, 5)
    var line = smooth(vals.map(function (v, j) { return [j * W / Math.max(1, vals.length - 1), H - 6 - v / max * (H - 16)] }))
    svg('path', { d: line + 'L' + W + ',' + H + 'L0,' + H + 'Z', fill: 'url(#kf' + i + ')' }, s)
    svg('path', { d: line, fill: 'none', stroke: 'url(#kl' + i + ')', 'stroke-width': 2, filter: 'url(#kg' + i + ')', 'class': 'glow-line', 'vector-effect': 'non-scaling-stroke' }, s)
    svg('path', { d: line, fill: 'none', stroke: 'url(#kl' + i + ')', 'stroke-width': 1.8, 'vector-effect': 'non-scaling-stroke' }, s)
    return s
  }

  function kpis() {
    var list = scope(), n = span(), keys = days(n), wrap = byId('kpis'); wrap.textContent = ''
    var cur = inDays(list, keys), prev = state.period ? inDays(list, days(2 * n).slice(0, n)) : []
    KPI.forEach(function (k, i) {
      var M = METRICS[k[0]], v = total(cur, M.pick), p = total(prev, M.pick)
      var card = h('div', 'card kpi'), value = h('div', 'kpi-value num', M.fmt(v)); card.style.setProperty('--k', k[2])
      if (p > 0) { var pct = Math.round((v - p) / p * 100); value.append(h('span', 'delta ' + (pct >= 0 ? 'up' : 'down'), (pct >= 0 ? '↑' : '↓') + Math.abs(pct) + '%')) }
      var note = !state.period ? 'all time' : p > 0 ? 'vs previous ' + n + ' days' : 'last ' + n + ' days'
      card.append(h('div', 'kpi-label', M.label), value, h('div', 'kpi-note', note), sparkline(perDay(list, keys, M.pick), i, k))
      wrap.append(card)
    })
  }

  function chart() {
    var list = scope(), n = span(), keys = days(n), M = METRICS[state.metric], box = byId('stream'), tip = byId('tip'); tip.hidden = true
    var W = Math.max(320, Math.round(box.getBoundingClientRect().width) || 900), H = 340, top = 66, base = 282
    box.setAttribute('viewBox', '0 0 ' + W + ' ' + H); box.textContent = ''
    var defs = svg('defs', {}, box); blur(defs, 'sglow', 10)
    var shown = names.filter(function (p) { return (!state.project || p === state.project) && list.some(function (t) { return t.project === p }) })
    var projects = shown.filter(function (p) { return !state.hidden[p] })
    var cur = inDays(list, keys).filter(function (t) { return !state.hidden[t.project] })
    byId('chart-sub').textContent = M.label + (state.period ? ', last ' + n + ' days' : ', all time')
    byId('chart-total').textContent = M.fmt(total(cur, M.pick))
    legend(shown)
    var x = function (i) { return n > 1 ? i * W / (n - 1) : W / 2 }
    svg('line', { x1: 0, x2: W, y1: base + 22, y2: base + 22, 'class': 'base' }, box)
    for (var w = 0, step = Math.max(1, Math.ceil(n / 6)); w < n; w += step) svg('text', { x: x(w), y: H - 6, 'class': 'axis', 'text-anchor': w ? 'middle' : 'start' }, box).textContent = shortDate(keys[w])
    var raw = projects.map(function (p) { return perDay(cur.filter(function (t) { return t.project === p }), keys, M.pick) })
    // Real day values: the curve passes through them, nothing is spread to neighbouring days.
    var layers = raw
    var totals = keys.map(function (_, i) { return layers.reduce(function (a, r) { return a + r[i] }, 0) })
    var max = Math.max.apply(null, totals.concat([0]))
    if (max <= 0) { svg('text', { x: W / 2, y: (top + base) / 2, 'text-anchor': 'middle', 'class': 'empty-chart' }, box).textContent = 'No sessions in this period'; return }
    var y = function (v) { return base - v / max * (base - top) }, acc = keys.map(function () { return 0 }), shapes = []
    layers.forEach(function (r, li) {
      var lower = acc, upper = acc.map(function (a, i) { return a + r[i] }), c = colorOf(projects[li]); acc = upper
      gradient(defs, 'sf' + li, 0, base, [[0, c, .95], [1, c, .55]])
      var up = smooth(upper.map(function (v, i) { return [x(i), y(v)] })), low = smooth(lower.map(function (v, i) { return [x(i), y(v)] }).reverse())
      shapes.push({ d: up + 'L' + low.slice(1) + 'Z', fill: 'url(#sf' + li + ')', top: up })
    })
    var last = shapes[shapes.length - 1]
    svg('path', { d: last.top + 'L' + W + ',' + base + 'L0,' + base + 'Z', fill: '#5fe08a', filter: 'url(#sglow)', 'class': 'glow' }, box)
    shapes.forEach(function (s) { svg('path', { d: s.d, fill: s.fill }, box) })
    svg('path', { d: last.top, 'class': 'top-line', 'stroke-width': 1.2 }, box)
    // One dot per session on the axis, at its hour of the day.
    cur.forEach(function (t) {
      var k = keys.indexOf(t.started.slice(0, 10)), hour = (+t.started.slice(11, 13) || 12) / 24
      svg('circle', { cx: Math.min(W - 4, Math.max(4, x(k) + (hour - .5) * W / n)), cy: base + 22, r: 3.2, fill: colorOf(t.project) }, box)
    })
    var hover = svg('line', { y1: top - 12, y2: base, 'class': 'hover-line', visibility: 'hidden' }, box)
    box.onmousemove = function (e) {
      var r = box.getBoundingClientRect(), i = Math.max(0, Math.min(n - 1, Math.round((e.clientX - r.left) / r.width * (n - 1))))
      hover.setAttribute('x1', x(i)); hover.setAttribute('x2', x(i)); hover.setAttribute('visibility', 'visible')
      tip.textContent = ''; tip.append(h('div', 'tip-date', shortDate(keys[i])), h('div', 'tip-value', M.fmt(raw.reduce(function (a, rr) { return a + rr[i] }, 0))))
      tip.style.left = x(i) / W * r.width + 'px'; tip.style.top = y(totals[i]) / H * r.height + 'px'; tip.hidden = false
    }
    box.onmouseleave = function () { hover.setAttribute('visibility', 'hidden'); tip.hidden = true }
  }

  function legend(shown) {
    var box = byId('legend'); box.textContent = ''
    if (shown.length < 2) return
    shown.forEach(function (p) {
      var b = h('button', 'chip'), d = h('span', 'dot'); b.type = 'button'; b.setAttribute('aria-pressed', String(!state.hidden[p])); d.style.setProperty('--c', colorOf(p))
      b.append(d, document.createTextNode(p), h('span', 'x', state.hidden[p] ? '+' : '×'))
      b.addEventListener('click', function () { state.hidden[p] = !state.hidden[p]; chart(); card() })
      box.append(b)
    })
  }

  function pill(text) {
    var kind = /passed/.test(text) ? 'ok' : /failed/.test(text) ? 'bad' : /stale/.test(text) ? 'warn' : ''
    var p = h('span', 'pill ' + kind); p.append(h('i'), document.createTextNode(text || 'not run')); return p
  }

  function table() {
    var body = byId('rows'), q = state.q.trim().toLowerCase(); body.textContent = ''
    var list = inDays(scope(), days(span())).filter(function (t) { return !q || (t.name + ' ' + t.project + ' ' + modelName(t.model)).toLowerCase().indexOf(q) >= 0 })
      .sort(function (a, b) { return b.started.localeCompare(a.started) })
    byId('count').textContent = String(list.length)
    if (!list.length) {
      var tr = h('tr'), td = h('td', 'empty', q ? 'No session matches.' : tasks.length ? 'No sessions in this period.' : 'No sessions yet. The band records a session after its first turn.')
      td.colSpan = 6; tr.append(td); body.append(tr); return
    }
    var max = Math.max.apply(null, list.map(function (t) { return t.agentMinutes })) || 1
    list.forEach(function (t) {
      var tr = h('tr'), name = h('td', 'name'), task = h('div', 'task', t.name || 'Untitled session'), bar = h('div', 'bar'), tests = h('td')
      task.title = t.name; bar.style.setProperty('--c', colorOf(t.project)); bar.style.width = Math.max(4, t.agentMinutes / max * 100) + '%'
      name.append(task, h('div', 'sub', (state.project ? '' : t.project + ' · ') + shortDate(t.started.slice(0, 10)) + ', ' + t.started.slice(11) + (t.model ? ' · ' + modelName(t.model) : '')), bar)
      // An imported session has no test record: a dash, not "not run".
      tests.append(t.tests || t.level !== 'import' ? pill(t.tests) : h('span', 'sub', '–'))
      tr.append(name, h('td', 'r num', time(t.agentMinutes * 60000)), h('td', 'r num', money(t.cost)), h('td', 'r num', tok(t.tokens)), h('td', 'r num', String(t.turns)), tests)
      body.append(tr)
    })
  }

  // Thermal ramp: a quiet indigo for a little agent time, through red to yellow for the most.
  var HEAT = [[0, [58, 48, 120]], [.4, [150, 45, 112]], [.65, [235, 72, 58]], [.85, [255, 140, 60]], [1, [255, 214, 102]]]
  function heatColor(a) {
    for (var i = 1; i < HEAT.length; i++) if (a <= HEAT[i][0]) {
      var lo = HEAT[i - 1], hi = HEAT[i], t = (a - lo[0]) / (hi[0] - lo[0])
      return 'rgb(' + lo[1].map(function (c, j) { return Math.round(c + (hi[1][j] - c) * t) }).join(',') + ')'
    }
    return 'rgb(255,214,102)'
  }
  function hex(cx, cy, r) {
    var d = ''
    for (var k = 0; k < 6; k++) { var a = Math.PI / 3 * k - Math.PI / 2; d += (k ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1) }
    return d + 'Z'
  }

  // The last 12 weeks as a honeycomb: a column per week, a row per weekday, the colour is the day's agent time.
  function heat() {
    var s = byId('heat'), list = scope(), keys = days(84), vals = perDay(list, keys, METRICS.time.pick), max = Math.max.apply(null, vals.concat([0]))
    var r = 17, w = Math.sqrt(3) * r, left = 44, top = r + 2, firstDow = new Date(now - 83 * DAY).getDay(), cols = Math.ceil((84 + firstDow) / 7); s.textContent = ''
    blur(svg('defs', {}, s), 'hglow', 6)
    var cells = keys.map(function (k, i) {
      var pos = i + firstDow, row = pos % 7
      return { k: k, v: vals[i], a: max ? vals[i] / max : 0, cx: left + Math.floor(pos / 7) * w + (row % 2 ? w / 2 : 0), cy: top + row * r * 1.5 }
    })
    cells.forEach(function (c) { if (c.a > .6) svg('path', { d: hex(c.cx, c.cy, r), fill: heatColor(c.a), filter: 'url(#hglow)', 'class': 'glow-cell' }, s) })
    var tip = byId('heat-tip'); tip.hidden = true
    cells.forEach(function (c) {
      var p = svg('path', c.v ? { d: hex(c.cx, c.cy, r - 2), fill: heatColor(c.a) } : { d: hex(c.cx, c.cy, r - 2), 'class': 'cell-empty' }, s)
      p.onmouseenter = function () {
        var day = list.filter(function (t) { return t.started.slice(0, 10) === c.k })
        tip.textContent = ''
        tip.append(h('div', 'tip-date', new Date(c.k + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })), h('div', 'tip-value', day.length ? time(c.v) : 'No sessions'))
        if (day.length) tip.append(h('div', 'tip-date', plural(day.length, 'session') + ' · ' + money(total(day, METRICS.cost.pick)) + ' · ' + tok(total(day, METRICS.tokens.pick)) + ' tokens'))
        tip.hidden = false
      }
      // Kept inside the window: the card sits at the right edge, the tip centres on the cursor.
      p.onmousemove = function (e) { tip.style.left = Math.min(e.clientX, innerWidth - tip.offsetWidth / 2 - 8) + 'px'; tip.style.top = e.clientY + 'px' }
      p.onmouseleave = function () { tip.hidden = true }
    })
    ;['Mon', 'Wed', 'Fri'].forEach(function (d, i) { svg('text', { x: 0, y: top + (1 + 2 * i) * r * 1.5 + 4, 'class': 'day' }, s).textContent = d })
    // Legend: the ramp from less to more, under the right edge.
    var right = left + cols * w + w / 2, ly = top + 6 * r * 1.5 + r + 20
    var end = right - 40
    svg('text', { x: end - 4 * 15 - 14, y: ly + 4, 'text-anchor': 'end', 'class': 'day' }, s).textContent = 'Less'
    ;[.1, .3, .55, .8, 1].forEach(function (a, i) { svg('path', { d: hex(end - (4 - i) * 15, ly, 6.5), fill: heatColor(a) }, s) })
    svg('text', { x: right, y: ly + 4, 'text-anchor': 'end', 'class': 'day' }, s).textContent = 'More'
    s.setAttribute('viewBox', '0 0 ' + Math.ceil(right + 2) + ' ' + Math.ceil(ly + 10))
    // Two heroes from the same twelve weeks: on how many days agents worked, and the run of days up to today.
    var active = vals.filter(function (v) { return v > 0 }).length, run = 0, longest = 0, streak = 0
    vals.forEach(function (v) { run = v > 0 ? run + 1 : 0; longest = Math.max(longest, run) })
    for (var j = vals[83] > 0 ? 83 : 82; j >= 0 && vals[j] > 0; j--) streak++
    byId('h-active').textContent = String(active)
    var share = byId('h-active-sub'); share.textContent = ''; share.append(h('b', '', Math.round(active / 84 * 100) + '%'), document.createTextNode('of the last 84 days'))
    byId('h-streak').textContent = plural(streak, 'day')
    byId('h-streak-sub').textContent = 'longest ' + plural(longest, 'day')
    var cur = inDays(list, days(span())), byDay = {}, best = null
    cur.forEach(function (t) { var k = t.started.slice(0, 10); byDay[k] = (byDay[k] || 0) + t.agentMinutes; if (!best || t.agentMinutes > best.agentMinutes) best = t })
    var busiest = Object.keys(byDay).sort(function (a, b) { return byDay[b] - byDay[a] })[0], facts = byId('facts'); facts.textContent = ''
    ;[['Busiest day', busiest ? shortDate(busiest) + ' · ' + time(byDay[busiest] * 60000) : '–'],
      ['Longest session', best ? time(best.agentMinutes * 60000) : '–'],
      ['Average per session', cur.length ? time(total(cur, METRICS.time.pick) / cur.length) : '–'],
      ['Average cost per session', cur.length ? money(total(cur, METRICS.cost.pick) / cur.length) : '–']].forEach(function (f) {
      var r = h('div', 'fact'); r.append(h('span', '', f[0]), h('span', 'num', f[1])); facts.append(r)
    })
  }

  // The share card: the numbers and the stream of what is on screen.
  function card() {
    var list = scope(), n = span(), keys = days(n), cur = inDays(list, keys).filter(function (t) { return !state.hidden[t.project] })
    var projects = names.filter(function (p) { return cur.some(function (t) { return t.project === p }) })
    byId('c-scope').textContent = (state.project || plural(projects.length, 'project')) + ' · ' + (state.period ? 'last ' + n + ' days' : 'all time')
    byId('c-time').textContent = time(total(cur, METRICS.time.pick))
    byId('c-cost').textContent = money(total(cur, METRICS.cost.pick))
    byId('c-tokens').textContent = tok(total(cur, METRICS.tokens.pick))
    byId('c-sessions').textContent = String(cur.length)
    var g = byId('c-stream'), W = 1200, base = 600, topY = 380; g.textContent = ''
    var layers = projects.map(function (p) { return perDay(cur.filter(function (t) { return t.project === p }), keys, METRICS.time.pick) })
    var totals = keys.map(function (_, i) { return layers.reduce(function (a, r) { return a + r[i] }, 0) }), max = Math.max.apply(null, totals.concat([0]))
    if (max <= 0) return
    var x = function (i) { return n > 1 ? i * W / (n - 1) : W / 2 }, y = function (v) { return base - v / max * (base - topY) }, acc = keys.map(function () { return 0 }), shapes = []
    layers.forEach(function (r, li) {
      var lower = acc, upper = acc.map(function (a, i) { return a + r[i] }); acc = upper
      var up = smooth(upper.map(function (v, i) { return [x(i), y(v)] })), low = smooth(lower.map(function (v, i) { return [x(i), y(v)] }).reverse())
      shapes.push({ d: up + 'L' + low.slice(1) + 'Z', fill: 'url(#cf' + PALETTE.indexOf(colorOf(projects[li])) + ')', top: up })
    })
    svg('path', { d: shapes[shapes.length - 1].top + 'L' + W + ',' + base + 'L0,' + base + 'Z', fill: '#5fe08a', opacity: .18, filter: 'url(#cglow)' }, g)
    shapes.forEach(function (s) { svg('path', { d: s.d, fill: s.fill }, g) })
  }

  function render() { sidebar(); header(); kpis(); chart(); table(); heat(); card() }

  function download(blob, name) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click() }
  // The saved card carries its own copy of the logo, so it stands alone.
  function cardText() { var c = byId('card').cloneNode(true); c.querySelector('defs').append(byId('pt-logo').cloneNode(true)); return new XMLSerializer().serializeToString(c) }
  function saveSvg() { download(new Blob([cardText()], { type: 'image/svg+xml' }), 'ponytail-card.svg') }
  function savePng() {
    var img = new Image()
    img.onload = function () {
      try { var c = document.createElement('canvas'); c.width = 1200; c.height = 630; c.getContext('2d').drawImage(img, 0, 0); c.toBlob(function (b) { b ? download(b, 'ponytail-card.png') : saveSvg() }) } catch (e) { saveSvg() }
    }
    img.onerror = saveSvg
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(cardText())
  }

  byId('q').addEventListener('input', function (e) { state.q = e.target.value; table() })
  document.querySelectorAll('[data-metric]').forEach(function (b) {
    b.addEventListener('click', function () { state.metric = b.getAttribute('data-metric'); document.querySelectorAll('[data-metric]').forEach(function (x) { x.classList.toggle('on', x === b) }); chart() })
  })
  document.querySelectorAll('[data-period]').forEach(function (b) {
    b.addEventListener('click', function () { state.period = +b.getAttribute('data-period'); document.querySelectorAll('[data-period]').forEach(function (x) { x.classList.toggle('on', x === b) }); render() })
  })
  var resizing; window.addEventListener('resize', function () { clearTimeout(resizing); resizing = setTimeout(chart, 120) })
  byId('share').addEventListener('click', function () { byId('share-dialog').showModal() })
  byId('share-close').addEventListener('click', function () { byId('share-dialog').close() })
  byId('save-png').addEventListener('click', savePng)
  byId('save-svg').addEventListener('click', saveSvg)
  var THEMES = ['dark', 'light', 'system']
  function applyTheme(choice) {
    document.documentElement.setAttribute('data-theme', choice)
    var b = byId('theme'), next = THEMES[(THEMES.indexOf(choice) + 1) % THEMES.length]
    b.setAttribute('data-choice', choice)
    b.setAttribute('aria-label', 'Theme: ' + choice + ', switch to ' + next)
    b.title = 'Theme: ' + choice
  }
  var saved = 'dark'
  try { saved = localStorage.getItem('ponytail-board-theme') || 'dark' } catch (e) {}
  applyTheme(THEMES.indexOf(saved) >= 0 ? saved : 'dark')
  byId('theme').addEventListener('click', function () {
    var next = THEMES[(THEMES.indexOf(byId('theme').getAttribute('data-choice')) + 1) % THEMES.length]
    applyTheme(next)
    try { localStorage.setItem('ponytail-board-theme', next) } catch (e) {}
  })

  render()
})()`

// The share card stays dark in both themes: an image for X or LinkedIn, not part of the page's look.
// The page fills its numbers and stream; the logo symbol joins it when the card is saved.
const SANS = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace"
const cardStat = (y: number, label: string, id: string) =>
  `<text x="760" y="${y}" font-size="20" fill="#8d8b84">${label}</text><text id="${id}" x="1128" y="${y}" text-anchor="end" font-family="${MONO}" font-size="30" fill="#f3f2ee"></text>`
const CARD = `<svg id="card" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" font-family="${SANS}">
<defs>${PALETTE.map((c, i) => `<linearGradient id="cf${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".95"/><stop offset="1" stop-color="${c}" stop-opacity=".55"/></linearGradient>`).join('')}<filter id="cglow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="12"/></filter><radialGradient id="chalo" cx=".62" cy=".8" r=".6"><stop offset="0" stop-color="#5fe08a" stop-opacity=".16"/><stop offset="1" stop-color="#5fe08a" stop-opacity="0"/></radialGradient></defs>
<rect width="1200" height="630" fill="#070707"/><rect width="1200" height="630" fill="url(#chalo)"/>
<g id="c-stream"></g><rect y="600" width="1200" height="30" fill="#070707"/>
<use href="#pt-logo" x="72" y="62" width="48" height="55"/>
<text x="134" y="98" font-family="${MONO}" font-size="28" font-weight="600" fill="#f3f2ee">ponytail</text>
<text id="c-scope" x="1128" y="98" text-anchor="end" font-size="20" fill="#8d8b84"></text>
<text x="72" y="196" font-size="22" fill="#8d8b84">Agent time</text><text id="c-time" x="66" y="292" font-family="${MONO}" font-size="104" font-weight="600" letter-spacing="-5" fill="#f3f2ee"></text>
${cardStat(172, 'Cost', 'c-cost')}${cardStat(228, 'Tokens', 'c-tokens')}${cardStat(284, 'Sessions', 'c-sessions')}
<text x="72" y="621" font-family="${MONO}" font-size="15" fill="#5e5c55">measured in Claude Code</text><text x="1128" y="621" text-anchor="end" font-family="${MONO}" font-size="15" fill="#5fe08a">ponytail.dev</text></svg>`

// JSON inside a script block: "<" is escaped so no name can close the block.
const json = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')

// Dark, light, system: CSS shows the icon of the current choice.
const THEME_BUTTON = '<button type="button" class="theme" id="theme" data-choice="dark" aria-label="Theme: dark" title="Theme: dark"><svg class="i-system" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg><svg class="i-light" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><svg class="i-dark" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></button>'

// The tab icon: the same face, centred on a square canvas.
const FAVICON = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-78 0 1241 1241"><g fill="#1d1c1a">${LOGO_PATHS}</g></svg>`)}`

const SEARCH_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'

export function boardHtml(tasks: Task[], now: number): string {
  const seg = (attr: string, items: [string, string][], on: string) =>
    items.map(([value, label]) => `<button type="button" data-${attr}="${value}"${value === on ? ' class="on"' : ''}>${label}</button>`).join('')
  return `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ponytail board</title><link rel="icon" href="${FAVICON}"><style>${CSS}</style></head>
<body><svg class="sprite" aria-hidden="true" focusable="false"><symbol id="pt-logo" viewBox="${LOGO_VIEWBOX}"><g fill="#1d1c1a">${LOGO_PATHS}</g></symbol></svg>
<div class="app">
<aside class="side"><div class="brand"><span class="logo"><svg viewBox="${LOGO_VIEWBOX}" aria-hidden="true"><use href="#pt-logo"/></svg></span>ponytail</div><div class="side-label">Projects</div><nav id="projects"></nav><div class="side-foot"><div class="foot-text">Local board<br>${esc(day(now))}</div><span class="foot-sep"></span>${THEME_BUTTON}</div></aside>
<main>
<div class="top"><div><div class="crumb">Board / <b id="crumb"></b></div><h1 id="title"></h1><p id="subtitle"></p></div>
<div class="actions"><div class="seg" role="group" aria-label="Period">${seg('period', [['7', '7d'], ['30', '30d'], ['90', '90d'], ['0', 'All']], '30')}</div><button type="button" class="btn" id="share">Share card</button></div></div>
<section class="kpis" id="kpis"></section>
<section class="card chart-card"><div class="chart-head"><div><div class="label" id="chart-sub"></div><div class="big num" id="chart-total"></div></div>
<div class="seg" role="group" aria-label="Metric">${seg('metric', [['time', 'Agent time'], ['cost', 'Cost'], ['tokens', 'Tokens']], 'time')}</div></div>
<div class="chart-wrap"><svg id="stream" role="img" aria-label="Per project and day"></svg><div class="tip" id="tip" hidden></div></div><div class="legend" id="legend"></div></section>
<div class="grid2">
<section class="card list"><div class="list-head"><h3>Sessions<span class="n" id="count"></span></h3><label class="search">${SEARCH_ICON}<input id="q" type="search" placeholder="Search sessions" aria-label="Search sessions"></label></div>
<div class="table-wrap"><table><thead><tr><th>Session</th><th class="r">Agent time</th><th class="r">Cost</th><th class="r">Tokens</th><th class="r">Turns</th><th>Tests</th></tr></thead><tbody id="rows"></tbody></table></div></section>
<section class="card heat"><h3>Activity</h3><div class="sub">Agent time per day, last 12 weeks</div><svg id="heat" role="img" aria-label="Agent time per day, last 12 weeks"></svg><div class="tip heat-tip" id="heat-tip" hidden></div>
<div class="heroes"><div><div class="hero-label"><i style="color:#5fe08a">✦</i>Active days</div><div class="hero-value num" id="h-active"></div><div class="hero-sub" id="h-active-sub"></div></div>
<div><div class="hero-label"><i style="color:#ffd166">◆</i>Streak</div><div class="hero-value num" id="h-streak"></div><div class="hero-sub" id="h-streak-sub"></div></div></div><div id="facts"></div></section>
</div>
<footer>Measured by ponytail's band in Claude Code. Cost is the API-priced cost Claude Code reports (/cost), not a bill. Nothing here is estimated.</footer>
</main></div>
<dialog id="share-dialog"><div class="dlg-head"><b>Share card</b><div class="dlg-actions"><button type="button" class="btn" id="save-png">Save PNG</button><button type="button" class="btn" id="save-svg">Save SVG</button><button type="button" class="btn" id="share-close">Close</button></div></div><div class="dlg-body">${CARD}</div></dialog>
<script type="application/json" id="board-data">${json({ now, tasks })}</script>
<script>${APP}</script></body></html>`
}
