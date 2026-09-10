<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.png">
    <img src="assets/logo.png" width="220" alt="Ponytail, the lazy senior dev">
  </picture>
</p>

<h1 align="center">Ponytail</h1>

<p align="center">
  <em>वो कुछ नहीं कहता। बस एक लाइन लिखता है। और काम बन जाता है।</em>
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
  <strong>~54% कम कोड (94% तक) &middot; ~20% सस्ता &middot; ~27% तेज़ &middot; 100% सुरक्षित</strong><br>
  <sub>यह नतीजे असली Claude Code सेशन पर मापे गए हैं, जहाँ एक असली ओपन-सोर्स रिपो (FastAPI + React) पर एडिट किया गया, और उसी agent से बिना किसी skill के तुलना की गई। ~54% का औसत 12 फीचर टास्क पर आधारित है (Haiku 4.5, n=4); जहाँ agent ज़रूरत से ज़्यादा बना देता है (जैसे date picker) वहाँ यह 94% तक पहुँच जाता है, और जहाँ कोड पहले से ही न्यूनतम है वहाँ लगभग शून्य रहता है। ponytail हर safety guard को बनाए रखता है, जबकि सिर्फ "एक-लाइन लिखो" वाला prompt एक guard खो देता है। (पहले वाले single-shot बेंचमार्क में 80-94% एक फ्लैट आंकड़े के रूप में बताया गया था; एक फेयर agentic baseline के मुकाबले यह प्रति-टास्क अधिकतम सीमा है, औसत नहीं।) <a href="benchmarks/results/2026-06-18-agentic.md">पूरी जानकारी</a> &middot; <a href="benchmarks/">खुद आज़माएं</a>.</sub>
</p>

<p align="center">
  <sub><a href="README.es.md">Español</a> &middot; <a href="README.ko.md">한국어</a></sub>
</p>

---

<p align="center">
  <a href="https://ponytail.dev/soon"><img src="assets/waitlist-banner.png" alt="Something's coming, join the waitlist" width="760"></a>
</p>

आप उसे जानते हैं। लंबी पोनीटेल। अंडाकार चश्मा। कंपनी में वर्जन कंट्रोल से भी पुराना है। आप उसे पचास लाइनें दिखाते हो, वो देखता है, कुछ नहीं बोलता, और उन्हें एक लाइन से बदल देता है।

Ponytail उसे आपके AI agent के अंदर बिठा देता है।

## पहले / बाद में

आपने date picker मांगा। आपका agent flatpickr install करता है, एक wrapper component लिखता है, एक stylesheet जोड़ता है, और timezone को लेकर बहस शुरू कर देता है।

ponytail के साथ:

```html
<!-- ponytail: browser has one -->
<input type="date">
```

और भी उदाहरण [examples/](examples/) में देखें।

## आंकड़े

सबसे ईमानदार माप यही है कि असली agent असली काम करे: एक headless Claude Code सेशन ने [tiangolo के full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template) (एक असली FastAPI + React रिपो) को एडिट किया, और उसका स्कोर उस `git diff` से मापा गया जो पीछे छूटा। बारह फीचर टिकट, एक ही agent skill के साथ और बिना skill के, n=4, Haiku 4.5.

<p align="center">
  <img src="assets/benchmark-agentic.svg" width="860" alt="Each arm as a percent of the no-skill baseline across LOC, tokens, cost and time (Haiku 4.5). ponytail is lowest on every metric (LOC 46%, tokens 78%, cost 80%, time 73%); caveman rises above 100% on tokens, cost and time; yagni-oneliner LOC 67%. Safety, separate adversarial tier: baseline, caveman and ponytail 100%, yagni-oneliner 95%.">
</p>

| no-skill baseline के मुकाबले | LOC | tokens | cost | time | safe |
|---|--:|--:|--:|--:|--:|
| **ponytail** | **-54%** | **-22%** | **-20%** | **-27%** | **100%** |
| caveman (terse-prose control) | -20% | +7% | +3% | +2% | 100% |
| "YAGNI + one-liners" prompt | -33% | -14% | -21% | -30% | 95% |

ponytail अकेला ऐसा arm है जो हर मेट्रिक को कम करता है, और अकेला ऐसा जो पूरी तरह सुरक्षित भी रहता है। सबसे बड़ी कटौती वहाँ होती है जहाँ over-build का असली खतरा हो (date picker 404 से 23 लाइन तक, color picker 287 से 23 तक, क्योंकि यह component की जगह native `<input>` इस्तेमाल करता है), और जहाँ कोड पहले से ही न्यूनतम है वहाँ यह लगभग शून्य रहता है। पूरा तरीका, हर टास्क की टेबल, और सीमाएं यहाँ देखें: [benchmarks/results/2026-06-18-agentic.md](benchmarks/results/2026-06-18-agentic.md).

<details>
<summary><strong>पुराने single-shot आंकड़े (isolated generation)</strong></summary>

पाँच रोज़मर्रा के टास्क, तीन मॉडल, तीन arms (बिना skill, [caveman](https://github.com/JuliusBrussee/caveman), ponytail), दस रन, median रिपोर्ट किया गया। एक prompt, एक completion, जवाब की लाइनें गिनी गईं:

<p align="center">
  <img src="assets/benchmark-3model.svg" width="860" alt="Median lines of code per arm across Haiku, Sonnet and Opus">
</p>

इसमें **80-94% कम कोड** दिखा। [#126](https://github.com/DietrichGebert/ponytail/issues/126) ने सही बात बताई कि bare-model baseline अपने जवाब को prose और options से भर देता है, तो यह अंतर कुछ हद तक conversational-baseline का ही नतीजा है। ऊपर वाले agentic आंकड़े ही सही और भरोसेमंद वर्ज़न हैं। single-shot रन को खुद चलाने के लिए `npx promptfoo eval -c benchmarks/promptfooconfig.yaml` इस्तेमाल करें।

</details>

**नियम कभी भी "सबसे कम tokens" का नहीं था।** नियम यह है: सिर्फ वही लिखो जो टास्क को चाहिए, और validation, error handling, security, या accessibility से कभी समझौता मत करो। कोड छोटा इसलिए होता है क्योंकि वो ज़रूरी है, golf खेलकर नहीं बनाया गया। जो मॉडल इस ladder को फॉलो करते हैं उनमें कम cost और latency एक साइड-इफेक्ट है; लेकिन जो terse reasoning model हर rung पर सोचने में tokens खर्च करता है, वो उल्टा भी हो सकता है (GPT-5.5 पर ऐसा ही होता है)।

## यह काम कैसे करता है

कोड लिखने से पहले, agent पहले उस rung पर रुकता है जो सही बैठे:

```
1. क्या इसकी ज़रूरत है?        → नहीं: छोड़ दो (YAGNI)
2. यह codebase में पहले से है? → उसे दोबारा इस्तेमाल करो, नया मत लिखो
3. stdlib यह करता है?          → उसे इस्तेमाल करो
4. native platform feature?    → उसे इस्तेमाल करो
5. पहले से installed dependency? → उसे इस्तेमाल करो
6. एक लाइन में हो सकता है?     → एक लाइन लिखो
7. तभी: जितना ज़रूरी हो उतना ही
```

यह ladder समस्या को समझने के *बाद* चलता है, समझने की जगह नहीं: यह पहले उस कोड को पढ़ता है जिसे बदलाव छूता है और असली flow को ट्रेस करता है, फिर सही rung चुनता है। solution को लेकर आलसी है, पढ़ने को लेकर कभी नहीं।

आलसी है, लापरवाह नहीं: trust-boundary validation, data-loss handling, security, और accessibility कभी नहीं काटी जातीं।

## Install

ponytail आपसे बस इतनी ही मेहनत मांगेगा:

Claude Code और Codex plugins दो छोटे Node.js lifecycle hooks चलाते हैं, इसलिए `node` आपके PATH में होना चाहिए (Nix/nvm यूज़र्स के लिए नोट: यह non-interactive shell के PATH में भी होना चाहिए)। अगर नहीं है, तो skills फिर भी काम करेंगी, बस always-on activation चुपचाप रहेगा, हर prompt पर error नहीं देगा।

### Claude Code

```
/plugin marketplace add DietrichGebert/ponytail
```
```
/plugin install ponytail@ponytail
```
(install काम करने के लिए दो अलग-अलग prompts भेजने होंगे)

Claude Code Desktop app के Code टैब में भी वही स्टेप्स: ऊपर वाले दोनों `/plugin` कमांड्स prompt box में टाइप करें, या उसके बगल में **+** बटन दबाकर, **Plugins** → **Add plugin** चुनकर अपनी configured marketplaces देखें, और marketplaces को sidebar के **Customize** से मैनेज करें।

### Codex

```bash
codex plugin marketplace add DietrichGebert/ponytail
codex plugin add ponytail@ponytail
```

`codex` चलाएं और `/hooks` खोलें, इसके दोनों lifecycle hooks को रिव्यू करके trust करें, और एक नया thread शुरू करें।

यही install Codex desktop app के लिए भी काम करता है: install करने के बाद app को restart करें, यह plugin अपने आप ले लेगा।

### GitHub Copilot CLI

```bash
copilot plugin marketplace add DietrichGebert/ponytail
copilot plugin install ponytail@ponytail
```

interactive Copilot CLI सेशन में, slash equivalents इस्तेमाल करें:

```
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

Copilot CLI plugin commands को plugin के नाम से namespace करता है। जैसे:

```text
/ponytail:ponytail ultra
/ponytail:ponytail-review
```

### Pi agent harness

```
pi install git:github.com/DietrichGebert/ponytail
```

### OpenCode

`opencode.json` में जोड़ें:

```json
{ "plugin": ["@dietrichgebert/ponytail"] }
```

चेकआउट से सीधे चलाने के लिए (plugin `hooks/` और `skills/` को दोबारा इस्तेमाल करता है):

```json
{ "plugin": ["./.opencode/plugins/ponytail.mjs"] }
```

यह हर turn पर active level पर ruleset डालता है; `/ponytail` commands जोड़ता है (देखें [Commands](#commands))। OpenCode इस रिपो की `AGENTS.md` को भी अपने आप लोड कर लेता है, तो plugin के बिना भी rules काम करते रहते हैं। plugin `lite/full/ultra/off` levels जोड़ता है।

`./` वाला path आपके project की `opencode.json` के हिसाब से resolve होता है; एक ही checkout को कई projects में शेयर करने के लिए `.mjs` का absolute path डालें (यह अपने `hooks/` और `skills/` को अपनी फाइल के हिसाब से ही ढूंढ लेता है)।

### Gemini CLI

```bash
gemini extensions install https://github.com/DietrichGebert/ponytail
```

यह हर सेशन में ruleset को always-on context के तौर पर लोड करता है और `/ponytail` commands रजिस्टर करता है; `skills/` भी साथ आती हैं, जो ज़रूरत पड़ने पर activate होती हैं।
Gemini adapter जानबूझकर root `hooks/hooks.json` नहीं भेजता: Gemini उस path को अपने आप लोड कर लेता है, जबकि Ponytail के lifecycle hooks Claude/Codex के event names इस्तेमाल करते हैं।

### Qoder

Qoder repo root से `AGENTS.md` को always-on context के तौर पर अपने आप लोड कर लेता है, तो checkout से ponytail चलाने के लिए कोई सेटअप नहीं चाहिए। per-project rules के लिए, [`.qoder/rules/ponytail.md`](.qoder/rules/ponytail.md) को अपने project की `.qoder/rules/` में कॉपी करें। छह ponytail skills (`/ponytail`, `/ponytail-review`, `/ponytail-audit`, `/ponytail-debt`, `/ponytail-gain`, `/ponytail-help`) Qoder के Skill system से उपलब्ध हैं; [`.qoder-plugin/plugin.json`](.qoder-plugin/plugin.json) में plugin manifest `skills/` directory की तरफ इशारा करता है।

पूरे plugin-tier support के लिए (automatic mode activation + हर prompt पर ruleset injection), [`hooks/qoder-hooks.json`](hooks/qoder-hooks.json) के hooks को अपनी `.qoder/settings.json` में जोड़ें। `PONYTAIL_DIR` को अपने ponytail checkout के path से बदल दें। Qoder का `UserPromptSubmit` hook पहले prompt पर default mode activate करता है और हर turn पर ruleset डालता है; `PreToolUse` `task|Task` matcher के साथ subagents में ruleset डालता है। Level switches (`/ponytail lite|full|ultra|off`) अपने आप काम करते हैं।

### Antigravity CLI

Google, Gemini CLI का नाम बदलकर Antigravity CLI (`agy` binary) कर रहा है; वही extension वहाँ भी install होता है:

```bash
agy plugin install https://github.com/DietrichGebert/ponytail
```

यह इस रिपो की `gemini-extension.json` को ही इस्तेमाल करता है। एक फर्क है: Antigravity `/ponytail` commands को skills में बदल देता है, तो आप उन्हें slash menu से चुनने की बजाय chat में टाइप करते हैं (जैसे `/ponytail-review` एक मैसेज की तरह)। migration पूरी होने तक (करीब 18 जून, 2026), `gemini extensions install` भी काम करता रहेगा। इसे always-on rule की तरह चलाने के लिए, ruleset को `.agents/rules/` में डाल दें।

### Hermes Agent

```bash
hermes plugins install DietrichGebert/ponytail --enable
```

install करने के बाद Hermes को restart करें। plugin हर LLM turn से पहले active Ponytail mode डालता है, बंडल की गई skills को `ponytail:<skill>` के नाम से रजिस्टर करता है, और `/ponytail`, `/ponytail-review`, `/ponytail-audit`, `/ponytail-debt`, `/ponytail-gain`, और `/ponytail-help` जोड़ता है। shared gateways में, `/ponytail` को Hermes के slash-command access controls से सिर्फ trusted users तक सीमित रखें; runtime mode process-local होता है।

### CodeWhale

project root से `AGENTS.md` पढ़ता है, कोई सेटअप नहीं चाहिए। [`AGENTS.md`](AGENTS.md) को अपने project में कॉपी करें, या इस रिपो के checkout से `codewhale` चलाएं। बस इतना ही।

### Swival

पहले collection को अपनी library में stage करें, फिर जो skills चाहिए वो जोड़ें:

```bash
swival skills add --global https://github.com/DietrichGebert/ponytail  # ~/.config/swival/library में stage करें
swival skills add ponytail                                             # collection को इस project में install करें
swival skills add --global ponytail                                    # या इसे हर project में activate करें
```

Swival project root से `AGENTS.md` और globally `~/.config/swival/AGENTS.md` भी पढ़ता है, यह instruction-only fallback है।

command line पर, किसी skill को सीधे activate करने के लिए `$` prefix इस्तेमाल करें। जैसे: `$ponytail-review`.

### Devin CLI

```bash
devin plugins install DietrichGebert/ponytail
```

ponytail को Devin plugin के तौर पर install करता है; skills `/ponytail:ponytail`, `/ponytail:ponytail-review` वगैरह के तौर पर उपलब्ध होती हैं।

### OpenClaw

```bash
clawhub install ponytail
```

ponytail को ClawHub से OpenClaw skill के तौर पर install करता है; review, audit, debt, gain, और help skills भी उसी तरह install होती हैं (`clawhub install ponytail-review`, वगैरह)। OpenClaw इसे coding tasks पर लागू करता है और `/ponytail` command के तौर पर भी दिखाता है। ClawHub के बिना, [`.openclaw/skills/ponytail`](.openclaw/skills/) को `~/.openclaw/skills/` में कॉपी करें।

बस इतना ही था। उसे गर्व होता। पर वो कहेगा नहीं।

हर सेशन में active रहता है, कुछ commands के साथ (देखें [Commands](#commands))। `/ponytail ultra` उन पलों के लिए है जब codebase ने आपके साथ निजी तौर पर गलत किया हो। Startup और mode-change text में current mode दिखता है।

हर नए सेशन के लिए level सेट करने के लिए `PONYTAIL_DEFAULT_MODE` env var (`lite`/`full`/`ultra`/`off`) इस्तेमाल करें, या `~/.config/ponytail/config.json` (Windows पर `%APPDATA%\ponytail\config.json`) में `defaultMode` फील्ड डालें। default `full` है।

active रहते हुए, ruleset Agent tool से spawn होने वाले हर subagent में भी डाला जाता है। इसे खास agent types तक सीमित रखने के लिए (जैसे read-only search agents पर बंद रखना), `PONYTAIL_SUBAGENT_MATCHER` env var को एक regex पर सेट करें जो subagent के `agent_type` पर टेस्ट होगा। यह unanchored और case-insensitive है: `explore|general` दोनों में से किसी से मैच करेगा, `^general$` exact है, और plugin agent types `plugin:name` जैसे दिखते हैं। अगर सेट नहीं किया तो हर subagent में inject होगा (यही default है); गलत regex, या ऐसा subagent जिसका type platform नहीं बताता, वहाँ भी inject करना ही default रहेगा।

Cursor, Windsurf, Cline, GitHub Copilot Chat (VS Code, JetBrains, और Visual Studio का editor extension, standalone Copilot CLI नहीं जो [Install](#install) में ऊपर बताया गया है), Aider, Kiro, Zed, CodeWhale, Swival, Qoder: इस रिपो से matching rules file कॉपी करें ([`.cursor/rules/`](.cursor/rules/), [`.windsurf/rules/`](.windsurf/rules/), [`.clinerules/`](.clinerules/), [`.github/copilot-instructions.md`](.github/copilot-instructions.md), [`AGENTS.md`](AGENTS.md), [`.kiro/steering/`](.kiro/steering/), [`.qoder/rules/`](.qoder/rules/))।

Kiro: `.kiro/steering/ponytail.md` को `~/.kiro/steering/` (global) या अपने project की `.kiro/steering/` में कॉपी करें।

GitHub Copilot CLI fallback (instruction-only mode): यह किसी project में `AGENTS.md` और `.github/copilot-instructions.md` पढ़ता है, या हर project में ponytail चलाने के लिए rules को `~/.copilot/copilot-instructions.md` में कॉपी करें। इस तरीके से always-on guidance तो मिलती है, पर plugin mode switches या hooks नहीं जुड़ते।

Codex extension वाला VS Code `AGENTS.md` पढ़ता है, जो यह रिपो पहले से भेजती है, तो यह रिपो के root से बिना किसी सेटअप के काम करता है (`~/.codex/AGENTS.md` Codex को global बना देता है)।

JetBrains Junie `AGENTS.md` तभी पढ़ पाता है जब आप उसे Settings → Tools → Junie → Project Settings → Guidelines Path में बताएं (यह अभी automatic नहीं है)। यह रिपो `AGENTS.md` भेजती है; `.junie/guidelines.md` Junie का पुराना path है।

Amp (Sourcegraph) working directory और parent directories से `$HOME` तक `AGENTS.md` पढ़ता है, जो यह रिपो भेजती है, तो यह बिना सेटअप के काम करता है (`~/.config/amp/AGENTS.md` globally काम करता है)।

Jules (Google) repository root से `AGENTS.md` पढ़ता है, जो यह रिपो भेजती है, तो यह बिना किसी सेटअप के ruleset ले लेता है।

कौन सी फाइल किस agent के लिए है: [Agent portability](docs/agent-portability.md).

### Uninstall

| Host | Command |
|------|---------|
| Claude Code | `/plugin remove ponytail` |
| Codex | `codex plugin remove ponytail` |
| Devin CLI | `devin plugins remove ponytail` |
| Pi agent | `pi uninstall ponytail` |
| Cursor / Windsurf / Cline / Qoder / etc. | कॉपी की गई rule file को डिलीट करें |

यह plugin की अपनी फाइलें हटा देते हैं। पर ponytail plugin folder के बाहर थोड़ा सा state छोड़ देता है: mode flag, `~/.config/ponytail/config.json`, और (अगर आपने setup nudge accept किया था) `~/.claude/settings.json` में एक `statusLine` entry। इन्हें भी साफ करने के लिए `node scripts/uninstall.js` चलाएं। **इसे ऊपर वाले host remove command से पहले चलाएं** — यह script खुद भी plugin की फाइल है, तो पहले plugin हटाने से यह भी डिलीट हो जाएगी (या इसे इस रिपो के किसी अलग clone से चलाएं)। यह statusLine entry तभी हटाता है जब वो ponytail के अपने script की तरफ इशारा कर रही हो, तो अगर आपने खुद कोई statusline सेट किया है वो छुआ नहीं जाएगा।

## Commands

| Command | यह क्या करता है |
|---------|--------------|
| `/ponytail [lite \| full \| ultra \| off]` | intensity सेट करें, या बंद करें। बिना argument के current level दिखाता है। |
| `/ponytail-review` | current diff को over-engineering के लिए रिव्यू करता है, एक delete-list वापस देता है। |
| `/ponytail-audit` | पूरे repo को over-engineering के लिए ऑडिट करता है, सिर्फ diff नहीं। |
| `/ponytail-debt` | आपके टाले हुए `ponytail:` shortcuts को इकट्ठा करके एक ledger बनाता है, ताकि "बाद में" कभी "कभी नहीं" न बन जाए। |
| `/ponytail-gain` | benchmark से मापा गया असर (कम कोड, कम cost, ज़्यादा speed) दिखाता है। |
| `/ponytail-help` | ऊपर वाले commands के लिए quick reference। |

Commands के लिए skill-capable host चाहिए (Claude Code, Codex, Devin CLI, OpenCode, Gemini, pi, Swival, Hermes Agent, Qoder)। Codex में यह skills हैं, `@` से invoke करें (`@ponytail-review`)। instruction-only adapters (Cursor, Windsurf, Cline, Copilot, Kiro, Antigravity) commands के बिना, सिर्फ always-on ruleset लोड करते हैं।

## Development

compact rule text बदलते समय, agent copies को साथ में मिलाकर रखें:

```bash
node scripts/check-rule-copies.js
npm test
```

OpenClaw skill package (`.openclaw/skills/`) `skills/` से generate होता है; कोई skill बदलने के बाद `node scripts/build-openclaw-skills.js` दोबारा चलाएं, अगर यह पुराना रह गया तो test suite फेल हो जाएगा। skills को ClawHub पर publish करने के लिए, पहले एक बार `clawhub login` चलाएं, फिर `node scripts/publish-openclaw-skills.js` (यह छहों को `package.json` वाले version पर publish करता है; preview के लिए `--dry-run` पास करें)।

correctness benchmark email और CSV checks के लिए Python spawn करता है; पहले `python3` आज़माया जाता है, फिर `python`। CSV checks के लिए `pandas` लोकली installed होना चाहिए।

## FAQ

**क्या मैं इसे [caveman](https://github.com/JuliusBrussee/caveman) के साथ इस्तेमाल कर सकता हूँ?**
हाँ, और आपको करना भी चाहिए। Caveman कम करता है कि agent क्या कहता है, ponytail कम करता है कि वो क्या बनाता है। दोनों अलग-अलग हिस्से हैं, कोई overlap नहीं: caveman कोड को बिल्कुल वैसा ही रहने देता है, ponytail prose में दखल नहीं देता। छोटी बात, न्यूनतम कोड।

**क्या इसके लिए config file चाहिए?**
नहीं। एक optional `~/.config/ponytail/config.json` या `PONYTAIL_DEFAULT_MODE` env var default level सेट कर सकता है, पर कुछ भी ज़रूरी नहीं है।

**अगर मुझे सच में वो 120-लाइन वाली cache class चाहिए तो?**
आपको नहीं चाहिए। फिर भी ज़िद करें तो वो बना देगा। धीरे-धीरे। सही तरीके से। आपकी तरफ देखते हुए।

**क्या यह scale करता है?**
जो कोड आपने कभी लिखा ही नहीं, वो अनंत तक scale करता है। हमेशा से zero bugs, zero CVEs, 100% uptime।

**नाम "ponytail" क्यों?**
आप वजह अच्छी तरह जानते हैं।

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

[MIT](LICENSE). सबसे छोटा license जो काम करता है।

## Star History

<a href="https://www.star-history.com/dietrichgebert/ponytail#history">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date" />
 </picture>
</a>