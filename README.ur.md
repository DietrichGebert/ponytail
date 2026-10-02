<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.png">
    <img src="assets/logo.png" width="220" alt="Ponytail, the lazy senior dev">
  </picture>
</p>

<h1 align="center">Ponytail</h1>

<p align="center">
  <em>وہ کچھ نہیں کہتا۔ بس ایک لائن لکھتا ہے۔ اور کام ہو جاتا ہے۔</em>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/DietrichGebert/ponytail?style=flat-square&color=111111&label=stars" alt="Stars">
  <img src="https://img.shields.io/github/v/release/DietrichGebert/ponytail?style=flat-square&color=111111&label=release" alt="Release">
  <img src="https://img.shields.io/npm/v/@dietrichgebert/ponytail?style=flat-square&color=111111&label=npm" alt="npm">
  <img src="https://img.shields.io/badge/works%20with-20%20agents-111111?style=flat-square" alt="Works with 20 agents">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT license">
</p>

<p align="center">
  <a href="https://trendshift.io/repositories/50668" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/trendshift/repositories/50668/daily" alt="DietrichGebert/ponytail | Trendshift" width="250" height="55"/></a>
  <a href="https://trendshift.io/repositories/50668" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/trendshift/repositories/50668/weekly" alt="DietrichGebert/ponytail | Trendshift" width="250" height="55"/></a>
</p>

<p align="center">
  <strong>~54% کم کوڈ (94% تک) &middot; ~20% سستا &middot; ~27% تیز &middot; 100% محفوظ</strong><br>
  <sub>یہ نتائج اصلی Claude Code سیشنز پر ماپے گئے ہیں، جہاں ایک حقیقی اوپن سورس ریپو (FastAPI + React) پر ترمیم کی گئی، اور اسی ایجنٹ کا بغیر کسی سکل کے موازنہ کیا گیا۔ ~54% کی اوسط 12 فیچر ٹاسکس پر مبنی ہے (Haiku 4.5, n=4)؛ جہاں ایجنٹ ضرورت سے زیادہ بنا دیتا ہے (جیسے date picker) وہاں یہ 94% تک پہنچ جاتا ہے، اور جہاں کوڈ پہلے ہی کم سے کم ہے وہاں تقریباً صفر رہتا ہے۔ ponytail ہر سیفٹی گارڈ کو برقرار رکھتا ہے، جبکہ صرف "ایک لائن لکھو" والا prompt ایک گارڈ کھو دیتا ہے۔ (پہلے والے single-shot بینچ مارک میں 80-94% ایک فلیٹ عدد کے طور پر بتایا گیا تھا؛ ایک منصفانہ agentic baseline کے مقابلے میں یہ فی ٹاسک زیادہ سے زیادہ حد ہے، اوسط نہیں۔) <a href="benchmarks/results/2026-06-18-agentic.md">مکمل تفصیل</a> &middot; <a href="benchmarks/">خود آزمائیں</a>.</sub>
</p>

<p align="center">
  <sub><a href="README.es.md">Español</a> &middot; <a href="README.ko.md">한국어</a></sub>
</p>

---

<p align="center">
  <a href="https://ponytail.dev/soon"><img src="assets/waitlist-banner.png" alt="Something's coming, join the waitlist" width="760"></a>
</p>

آپ اسے جانتے ہیں۔ لمبی پونی ٹیل۔ بیضوی چشمہ۔ کمپنی میں ورژن کنٹرول سے بھی پرانا ہے۔ آپ اسے پچاس لائنیں دکھاتے ہیں، وہ دیکھتا ہے، کچھ نہیں بولتا، اور انہیں ایک لائن سے بدل دیتا ہے۔

Ponytail اسے آپ کے AI ایجنٹ کے اندر بٹھا دیتا ہے۔

## پہلے / بعد میں

آپ نے date picker مانگا۔ آپ کا ایجنٹ flatpickr انسٹال کرتا ہے، ایک wrapper component لکھتا ہے، ایک stylesheet شامل کرتا ہے، اور timezone کے بارے میں بحث شروع کر دیتا ہے۔

ponytail کے ساتھ:

```html
<!-- ponytail: browser has one -->
<input type="date">
```

مزید مثالیں [examples/](examples/) میں دیکھیں۔

## اعداد و شمار

سب سے ایماندار پیمائش یہی ہے کہ ایک اصلی ایجنٹ اصلی کام کرے: ایک headless Claude Code سیشن نے [tiangolo کے full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template) (ایک حقیقی FastAPI + React ریپو) میں ترمیم کی، اور اس کا اسکور اس `git diff` سے ماپا گیا جو پیچھے رہ گیا۔ بارہ فیچر ٹکٹس، ایک ہی ایجنٹ سکل کے ساتھ اور بغیر سکل کے، n=4, Haiku 4.5.

<p align="center">
  <img src="assets/benchmark-agentic.svg" width="860" alt="Each arm as a percent of the no-skill baseline across LOC, tokens, cost and time (Haiku 4.5). ponytail is lowest on every metric (LOC 46%, tokens 78%, cost 80%, time 73%); caveman rises above 100% on tokens, cost and time; yagni-oneliner LOC 67%. Safety, separate adversarial tier: baseline, caveman and ponytail 100%, yagni-oneliner 95%.">
</p>

| no-skill baseline کے مقابلے میں | LOC | tokens | cost | time | safe |
|---|--:|--:|--:|--:|--:|
| **ponytail** | **-54%** | **-22%** | **-20%** | **-27%** | **100%** |
| caveman (terse-prose control) | -20% | +7% | +3% | +2% | 100% |
| "YAGNI + one-liners" prompt | -33% | -14% | -21% | -30% | 95% |

ponytail واحد arm ہے جو ہر میٹرک کو کم کرتا ہے، اور واحد ہے جو مکمل طور پر محفوظ بھی رہتا ہے۔ سب سے بڑی کمی وہاں ہوتی ہے جہاں over-build کا حقیقی خطرہ ہو (date picker 404 سے 23 لائنز تک، color picker 287 سے 23 تک، کیونکہ یہ component کی بجائے native `<input>` استعمال کرتا ہے)، اور جہاں کوڈ پہلے ہی کم سے کم ہے وہاں یہ تقریباً صفر رہتا ہے۔ مکمل طریقہ کار، ہر ٹاسک کی ٹیبل، اور حدود یہاں دیکھیں: [benchmarks/results/2026-06-18-agentic.md](benchmarks/results/2026-06-18-agentic.md).

<details>
<summary><strong>پرانے single-shot اعداد و شمار (isolated generation)</strong></summary>

پانچ روزمرہ کے ٹاسکس، تین ماڈلز، تین arms (بغیر سکل، [caveman](https://github.com/JuliusBrussee/caveman)، ponytail)، دس runs، median رپورٹ کیا گیا۔ ایک prompt، ایک completion، جواب کی لائنیں گنی گئیں:

<p align="center">
  <img src="assets/benchmark-3model.svg" width="860" alt="Median lines of code per arm across Haiku, Sonnet and Opus">
</p>

اس میں **80-94% کم کوڈ** دکھا۔ [#126](https://github.com/DietrichGebert/ponytail/issues/126) نے درست بات بتائی کہ bare-model baseline اپنے جواب کو prose اور options سے بھر دیتا ہے، تو یہ فرق کسی حد تک conversational-baseline کا ہی نتیجہ ہے۔ اوپر دیے گئے agentic اعداد و شمار ہی درست اور قابلِ اعتماد ورژن ہیں۔ single-shot run خود چلانے کے لیے `npx promptfoo eval -c benchmarks/promptfooconfig.yaml` استعمال کریں۔

</details>

**اصول کبھی بھی "سب سے کم tokens" کا نہیں تھا۔** اصول یہ ہے: صرف وہی لکھو جو ٹاسک کو چاہیے، اور validation، error handling، security، یا accessibility پر کبھی سمجھوتہ مت کرو۔ کوڈ چھوٹا اس لیے ہوتا ہے کیونکہ وہ ضروری ہے، golf کھیل کر نہیں بنایا گیا۔ جو ماڈلز اس ladder کو فالو کرتے ہیں ان میں کم cost اور latency ایک ضمنی اثر ہے؛ لیکن جو terse reasoning model ہر rung پر سوچنے میں tokens خرچ کرتا ہے، وہ الٹا بھی ہو سکتا ہے (GPT-5.5 پر ایسا ہی ہوتا ہے)۔

## یہ کیسے کام کرتا ہے

کوڈ لکھنے سے پہلے، ایجنٹ پہلے اس rung پر رکتا ہے جو صحیح بیٹھے:

```
1. کیا اس کی ضرورت ہے؟          → نہیں: چھوڑ دو (YAGNI)
2. یہ codebase میں پہلے سے ہے؟  → دوبارہ استعمال کرو، نیا مت لکھو
3. stdlib یہ کرتا ہے؟           → اسے استعمال کرو
4. native platform feature؟     → اسے استعمال کرو
5. پہلے سے installed dependency؟ → اسے استعمال کرو
6. ایک لائن میں ہو سکتا ہے؟     → ایک لائن لکھو
7. تب ہی: جتنا ضروری ہو اتنا ہی
```

یہ ladder مسئلے کو سمجھنے کے *بعد* چلتا ہے، سمجھنے کی جگہ نہیں: یہ پہلے وہ کوڈ پڑھتا ہے جسے تبدیلی چھوتی ہے اور اصل flow کو trace کرتا ہے، پھر صحیح rung چنتا ہے۔ حل کے معاملے میں سست ہے، پڑھنے کے معاملے میں کبھی نہیں۔

سست ہے، لاپرواہ نہیں: trust-boundary validation، data-loss handling، security، اور accessibility کبھی نہیں کاٹی جاتیں۔

## Install

ponytail آپ سے بس اتنی ہی محنت مانگے گا:

Claude Code اور Codex plugins دو چھوٹے Node.js lifecycle hooks چلاتے ہیں، اس لیے `node` آپ کے PATH میں ہونا چاہیے (Nix/nvm صارفین کے لیے نوٹ: یہ non-interactive shell کے PATH میں بھی ہونا چاہیے)۔ اگر نہیں ہے، تو skills پھر بھی کام کریں گی، بس always-on activation خاموش رہے گا، ہر prompt پر error نہیں دے گا۔

### Claude Code

```
/plugin marketplace add DietrichGebert/ponytail
```
```
/plugin install ponytail@ponytail
```
(install کام کرنے کے لیے دو الگ الگ prompts بھیجنے ہوں گے)

Claude Code Desktop app کے Code ٹیب میں بھی وہی مراحل: اوپر دیے گئے دونوں `/plugin` کمانڈز prompt box میں ٹائپ کریں، یا اس کے ساتھ والا **+** بٹن دبا کر، **Plugins** → **Add plugin** چن کر اپنی configured marketplaces دیکھیں، اور marketplaces کو sidebar کے **Customize** سے منظم کریں۔

### Codex

```bash
codex plugin marketplace add DietrichGebert/ponytail
codex plugin add ponytail@ponytail
```

`codex` چلائیں اور `/hooks` کھولیں، اس کے دونوں lifecycle hooks کا جائزہ لے کر انہیں trust کریں، اور ایک نیا thread شروع کریں۔

یہی install Codex desktop app کے لیے بھی کام کرتا ہے: انسٹال کرنے کے بعد app کو restart کریں، یہ plugin خود بخود لے لے گا۔

### GitHub Copilot CLI

```bash
copilot plugin marketplace add DietrichGebert/ponytail
copilot plugin install ponytail@ponytail
```

interactive Copilot CLI سیشن میں، slash equivalents استعمال کریں:

```
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

Copilot CLI plugin commands کو plugin کے نام سے namespace کرتا ہے۔ جیسے:

```text
/ponytail:ponytail ultra
/ponytail:ponytail-review
```

### Pi agent harness

```
pi install git:github.com/DietrichGebert/ponytail
```

### OpenCode

`opencode.json` میں شامل کریں:

```json
{ "plugin": ["@dietrichgebert/ponytail"] }
```

چیک آؤٹ سے براہ راست چلانے کے لیے (plugin `hooks/` اور `skills/` کو دوبارہ استعمال کرتا ہے):

```json
{ "plugin": ["./.opencode/plugins/ponytail.mjs"] }
```

یہ ہر turn پر active level پر ruleset ڈالتا ہے؛ `/ponytail` commands شامل کرتا ہے (دیکھیں [Commands](#commands))۔ OpenCode اس ریپو کی `AGENTS.md` کو بھی خود بخود لوڈ کر لیتا ہے، تو plugin کے بغیر بھی rules کام کرتے رہتے ہیں۔ plugin `lite/full/ultra/off` levels شامل کرتا ہے۔

`./` والا path آپ کے project کی `opencode.json` کے حساب سے resolve ہوتا ہے؛ ایک ہی checkout کو کئی projects میں شیئر کرنے کے لیے `.mjs` کا absolute path ڈالیں (یہ اپنے `hooks/` اور `skills/` کو اپنی فائل کے حساب سے ہی ڈھونڈ لیتا ہے)۔

### Gemini CLI

```bash
gemini extensions install https://github.com/DietrichGebert/ponytail
```

یہ ہر سیشن میں ruleset کو always-on context کے طور پر لوڈ کرتا ہے اور `/ponytail` commands رجسٹر کرتا ہے؛ `skills/` بھی ساتھ آتی ہیں، جو ضرورت پڑنے پر activate ہوتی ہیں۔
Gemini adapter جان بوجھ کر root `hooks/hooks.json` نہیں بھیجتا: Gemini اس path کو خود بخود لوڈ کر لیتا ہے، جبکہ Ponytail کے lifecycle hooks Claude/Codex کے event names استعمال کرتے ہیں۔

### Qoder

Qoder repo root سے `AGENTS.md` کو always-on context کے طور پر خود بخود لوڈ کر لیتا ہے، تو checkout سے ponytail چلانے کے لیے کوئی سیٹ اپ نہیں چاہیے۔ per-project rules کے لیے، [`.qoder/rules/ponytail.md`](.qoder/rules/ponytail.md) کو اپنے project کی `.qoder/rules/` میں کاپی کریں۔ چھ ponytail skills (`/ponytail`, `/ponytail-review`, `/ponytail-audit`, `/ponytail-debt`, `/ponytail-gain`, `/ponytail-help`) Qoder کے Skill سسٹم سے دستیاب ہیں؛ [`.qoder-plugin/plugin.json`](.qoder-plugin/plugin.json) میں plugin manifest `skills/` directory کی طرف اشارہ کرتا ہے۔

مکمل plugin-tier سپورٹ کے لیے (automatic mode activation + ہر prompt پر ruleset injection)، [`hooks/qoder-hooks.json`](hooks/qoder-hooks.json) کے hooks کو اپنی `.qoder/settings.json` میں شامل کریں۔ `PONYTAIL_DIR` کو اپنے ponytail checkout کے path سے بدل دیں۔ Qoder کا `UserPromptSubmit` hook پہلے prompt پر default mode activate کرتا ہے اور ہر turn پر ruleset ڈالتا ہے؛ `PreToolUse` `task|Task` matcher کے ساتھ subagents میں ruleset ڈالتا ہے۔ Level switches (`/ponytail lite|full|ultra|off`) خود بخود کام کرتے ہیں۔

### Antigravity CLI

Google، Gemini CLI کا نام بدل کر Antigravity CLI (`agy` binary) کر رہا ہے؛ وہی extension وہاں بھی انسٹال ہوتا ہے:

```bash
agy plugin install https://github.com/DietrichGebert/ponytail
```

یہ اس ریپو کی `gemini-extension.json` کو ہی استعمال کرتا ہے۔ ایک فرق ہے: Antigravity `/ponytail` commands کو skills میں بدل دیتا ہے، تو آپ انہیں slash menu سے چننے کی بجائے chat میں ٹائپ کرتے ہیں (جیسے `/ponytail-review` ایک پیغام کی طرح)۔ migration مکمل ہونے تک (تقریباً 18 جون، 2026)، `gemini extensions install` بھی کام کرتا رہے گا۔ اسے always-on rule کی طرح چلانے کے لیے، ruleset کو `.agents/rules/` میں ڈال دیں۔

### Hermes Agent

```bash
hermes plugins install DietrichGebert/ponytail --enable
```

انسٹال کرنے کے بعد Hermes کو restart کریں۔ plugin ہر LLM turn سے پہلے active Ponytail mode ڈالتا ہے، bundled skills کو `ponytail:<skill>` کے نام سے رجسٹر کرتا ہے، اور `/ponytail`, `/ponytail-review`, `/ponytail-audit`, `/ponytail-debt`, `/ponytail-gain`, اور `/ponytail-help` شامل کرتا ہے۔ shared gateways میں، `/ponytail` کو Hermes کے slash-command access controls سے صرف trusted users تک محدود رکھیں؛ runtime mode process-local ہوتا ہے۔

### CodeWhale

project root سے `AGENTS.md` پڑھتا ہے، کوئی سیٹ اپ نہیں چاہیے۔ [`AGENTS.md`](AGENTS.md) کو اپنے project میں کاپی کریں، یا اس ریپو کے checkout سے `codewhale` چلائیں۔ بس اتنا ہی۔

### Swival

پہلے collection کو اپنی library میں stage کریں، پھر جو skills چاہئیں وہ شامل کریں:

```bash
swival skills add --global https://github.com/DietrichGebert/ponytail  # ~/.config/swival/library میں stage کریں
swival skills add ponytail                                             # collection کو اس project میں install کریں
swival skills add --global ponytail                                    # یا اسے ہر project میں activate کریں
```

Swival project root سے `AGENTS.md` اور globally `~/.config/swival/AGENTS.md` بھی پڑھتا ہے، یہ instruction-only fallback ہے۔

command line پر، کسی skill کو براہ راست activate کرنے کے لیے `$` prefix استعمال کریں۔ جیسے: `$ponytail-review`.

### Devin CLI

```bash
devin plugins install DietrichGebert/ponytail
```

ponytail کو Devin plugin کے طور پر install کرتا ہے؛ skills `/ponytail:ponytail`, `/ponytail:ponytail-review` وغیرہ کے طور پر دستیاب ہوتی ہیں۔

### OpenClaw

```bash
clawhub install ponytail
```

ponytail کو ClawHub سے OpenClaw skill کے طور پر install کرتا ہے؛ review, audit, debt, gain, اور help skills بھی اسی طرح install ہوتی ہیں (`clawhub install ponytail-review`, وغیرہ)۔ OpenClaw اسے coding tasks پر لاگو کرتا ہے اور `/ponytail` command کے طور پر بھی دکھاتا ہے۔ ClawHub کے بغیر، [`.openclaw/skills/ponytail`](.openclaw/skills/) کو `~/.openclaw/skills/` میں کاپی کریں۔

بس اتنا ہی تھا۔ اسے فخر ہوتا۔ پر وہ کہے گا نہیں۔

ہر سیشن میں active رہتا ہے، چند commands کے ساتھ (دیکھیں [Commands](#commands))۔ `/ponytail ultra` ان لمحات کے لیے ہے جب codebase نے آپ کے ساتھ ذاتی طور پر غلط کیا ہو۔ Startup اور mode-change text میں current mode دکھتا ہے۔

ہر نئے سیشن کے لیے level سیٹ کرنے کے لیے `PONYTAIL_DEFAULT_MODE` env var (`lite`/`full`/`ultra`/`off`) استعمال کریں، یا `~/.config/ponytail/config.json` (Windows پر `%APPDATA%\ponytail\config.json`) میں `defaultMode` فیلڈ ڈالیں۔ default `full` ہے۔

active رہتے ہوئے، ruleset Agent tool سے spawn ہونے والے ہر subagent میں بھی ڈالا جاتا ہے۔ اسے مخصوص agent types تک محدود رکھنے کے لیے (جیسے read-only search agents پر بند رکھنا)، `PONYTAIL_SUBAGENT_MATCHER` env var کو ایک regex پر سیٹ کریں جو subagent کے `agent_type` پر ٹیسٹ ہوگا۔ یہ unanchored اور case-insensitive ہے: `explore|general` دونوں میں سے کسی سے میچ کرے گا، `^general$` exact ہے، اور plugin agent types `plugin:name` جیسے دکھتے ہیں۔ اگر سیٹ نہیں کیا تو ہر subagent میں inject ہوگا (یہی default ہے)؛ غلط regex، یا ایسا subagent جس کا type platform نہیں بتاتا، وہاں بھی inject کرنا ہی default رہے گا۔

Cursor, Windsurf, Cline, GitHub Copilot Chat (VS Code, JetBrains, اور Visual Studio کا editor extension, standalone Copilot CLI نہیں جو [Install](#install) میں اوپر بتایا گیا ہے), Aider, Kiro, Zed, CodeWhale, Swival, Qoder: اس ریپو سے matching rules file کاپی کریں ([`.cursor/rules/`](.cursor/rules/), [`.windsurf/rules/`](.windsurf/rules/), [`.clinerules/`](.clinerules/), [`.github/copilot-instructions.md`](.github/copilot-instructions.md), [`AGENTS.md`](AGENTS.md), [`.kiro/steering/`](.kiro/steering/), [`.qoder/rules/`](.qoder/rules/))۔

Kiro: `.kiro/steering/ponytail.md` کو `~/.kiro/steering/` (global) یا اپنے project کی `.kiro/steering/` میں کاپی کریں۔

GitHub Copilot CLI fallback (instruction-only mode): یہ کسی project میں `AGENTS.md` اور `.github/copilot-instructions.md` پڑھتا ہے، یا ہر project میں ponytail چلانے کے لیے rules کو `~/.copilot/copilot-instructions.md` میں کاپی کریں۔ اس طریقے سے always-on guidance تو ملتی ہے، پر plugin mode switches یا hooks شامل نہیں ہوتے۔

Codex extension والا VS Code `AGENTS.md` پڑھتا ہے، جو یہ ریپو پہلے سے بھیجتی ہے، تو یہ ریپو کے root سے بغیر کسی سیٹ اپ کے کام کرتا ہے (`~/.codex/AGENTS.md` Codex کو global بنا دیتا ہے)۔

JetBrains Junie `AGENTS.md` تبھی پڑھ پاتا ہے جب آپ اسے Settings → Tools → Junie → Project Settings → Guidelines Path میں بتائیں (یہ ابھی automatic نہیں ہے)۔ یہ ریپو `AGENTS.md` بھیجتی ہے؛ `.junie/guidelines.md` Junie کا پرانا path ہے۔

Amp (Sourcegraph) working directory اور parent directories سے `$HOME` تک `AGENTS.md` پڑھتا ہے، جو یہ ریپو بھیجتی ہے، تو یہ بغیر سیٹ اپ کے کام کرتا ہے (`~/.config/amp/AGENTS.md` globally کام کرتا ہے)۔

Jules (Google) repository root سے `AGENTS.md` پڑھتا ہے، جو یہ ریپو بھیجتی ہے، تو یہ بغیر کسی سیٹ اپ کے ruleset لے لیتا ہے۔

کون سی فائل کس agent کے لیے ہے: [Agent portability](docs/agent-portability.md).

### Uninstall

| Host | Command |
|------|---------|
| Claude Code | `/plugin remove ponytail` |
| Codex | `codex plugin remove ponytail` |
| Devin CLI | `devin plugins remove ponytail` |
| Pi agent | `pi uninstall ponytail` |
| Cursor / Windsurf / Cline / Qoder / etc. | کاپی کی گئی rule file کو ڈیلیٹ کریں |

یہ plugin کی اپنی فائلیں ہٹا دیتے ہیں۔ پر ponytail plugin folder کے باہر تھوڑا سا state چھوڑ دیتا ہے: mode flag، `~/.config/ponytail/config.json`، اور (اگر آپ نے setup nudge accept کیا تھا) `~/.claude/settings.json` میں ایک `statusLine` entry۔ انہیں بھی صاف کرنے کے لیے `node scripts/uninstall.js` چلائیں۔ **اسے اوپر والے host remove command سے پہلے چلائیں** — یہ script خود بھی plugin کی فائل ہے، تو پہلے plugin ہٹانے سے یہ بھی ڈیلیٹ ہو جائے گی (یا اسے اس ریپو کے کسی الگ clone سے چلائیں)۔ یہ statusLine entry تبھی ہٹاتا ہے جب وہ ponytail کے اپنے script کی طرف اشارہ کر رہی ہو، تو اگر آپ نے خود کوئی statusline سیٹ کیا ہے وہ چھوا نہیں جائے گا۔

## Commands

| Command | یہ کیا کرتا ہے |
|---------|--------------|
| `/ponytail [lite \| full \| ultra \| off]` | intensity سیٹ کریں، یا بند کریں۔ بغیر argument کے current level دکھاتا ہے۔ |
| `/ponytail-review` | current diff کو over-engineering کے لیے review کرتا ہے، ایک delete-list واپس دیتا ہے۔ |
| `/ponytail-audit` | پورے repo کو over-engineering کے لیے audit کرتا ہے، صرف diff نہیں۔ |
| `/ponytail-debt` | آپ کے ٹالے ہوئے `ponytail:` shortcuts کو اکٹھا کر کے ایک ledger بناتا ہے، تاکہ "بعد میں" کبھی "کبھی نہیں" نہ بن جائے۔ |
| `/ponytail-gain` | benchmark سے ماپا گیا اثر (کم کوڈ، کم cost، زیادہ speed) دکھاتا ہے۔ |
| `/ponytail-help` | اوپر والے commands کے لیے quick reference۔ |

Commands کے لیے skill-capable host چاہیے (Claude Code, Codex, Devin CLI, OpenCode, Gemini, pi, Swival, Hermes Agent, Qoder)۔ Codex میں یہ skills ہیں، `@` سے invoke کریں (`@ponytail-review`)۔ instruction-only adapters (Cursor, Windsurf, Cline, Copilot, Kiro, Antigravity) commands کے بغیر، صرف always-on ruleset لوڈ کرتے ہیں۔

## Development

compact rule text بدلتے وقت، agent copies کو ساتھ ملا کر رکھیں:

```bash
node scripts/check-rule-copies.js
npm test
```

OpenClaw skill package (`.openclaw/skills/`) `skills/` سے generate ہوتا ہے؛ کوئی skill بدلنے کے بعد `node scripts/build-openclaw-skills.js` دوبارہ چلائیں، اگر یہ پرانا رہ گیا تو test suite fail ہو جائے گا۔ skills کو ClawHub پر publish کرنے کے لیے، پہلے ایک بار `clawhub login` چلائیں، پھر `node scripts/publish-openclaw-skills.js` (یہ چھ چیزوں کو `package.json` والے version پر publish کرتا ہے؛ preview کے لیے `--dry-run` پاس کریں)۔

correctness benchmark email اور CSV checks کے لیے Python spawn کرتا ہے؛ پہلے `python3` آزمایا جاتا ہے، پھر `python`۔ CSV checks کے لیے `pandas` لوکلی installed ہونا چاہیے۔

## FAQ

**کیا میں اسے [caveman](https://github.com/JuliusBrussee/caveman) کے ساتھ استعمال کر سکتا ہوں؟**
ہاں، اور آپ کو کرنا بھی چاہیے۔ Caveman کم کرتا ہے کہ ایجنٹ کیا کہتا ہے، ponytail کم کرتا ہے کہ وہ کیا بناتا ہے۔ دونوں الگ الگ حصے ہیں، کوئی overlap نہیں: caveman کوڈ کو بالکل ویسا ہی رہنے دیتا ہے، ponytail prose میں دخل نہیں دیتا۔ مختصر بات، کم سے کم کوڈ۔

**کیا اس کے لیے config file چاہیے؟**
نہیں۔ ایک optional `~/.config/ponytail/config.json` یا `PONYTAIL_DEFAULT_MODE` env var default level سیٹ کر سکتا ہے، پر کچھ بھی ضروری نہیں ہے۔

**اگر مجھے واقعی وہ 120-لائن والی cache class چاہیے تو؟**
آپ کو نہیں چاہیے۔ پھر بھی ضد کریں تو وہ بنا دے گا۔ آہستہ آہستہ۔ صحیح طریقے سے۔ آپ کی طرف دیکھتے ہوئے۔

**کیا یہ scale کرتا ہے؟**
جو کوڈ آپ نے کبھی لکھا ہی نہیں، وہ لامحدود تک scale کرتا ہے۔ ہمیشہ سے zero bugs, zero CVEs, 100% uptime۔

**نام "ponytail" کیوں؟**
آپ وجہ اچھی طرح جانتے ہیں۔

## Sponsors

<p align="center">
  <a href="https://greenpt.com/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="assets/logo-greenpt-dark.svg">
      <img src="assets/logo-greenpt.svg" width="260" alt="GreenPT">
    </picture>
  </a>
</p>

## License

[MIT](LICENSE). سب سے مختصر license جو کام کرتا ہے۔

## Star History

<a href="https://www.star-history.com/dietrichgebert/ponytail#history">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date" />
 </picture>
</a>