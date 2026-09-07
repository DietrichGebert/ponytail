<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.png">
    <img src="assets/logo.png" width="220" alt="Ponytail，懶得恰到好處的資深開發者">
  </picture>
</p>

<h1 align="center">Ponytail</h1>

<p align="center">
  <em>他不說話。寫下一行代碼。搞定一切。</em>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/DietrichGebert/ponytail?style=flat-square&color=111111&label=stars" alt="Stars">
  <img src="https://img.shields.io/github/v/release/DietrichGebert/ponytail?style=flat-square&color=111111&label=release" alt="Release">
  <img src="https://img.shields.io/npm/v/@dietrichgebert/ponytail?style=flat-square&color=111111&label=npm" alt="npm">
  <img src="https://img.shields.io/badge/works%20with-20%20agents-111111?style=flat-square" alt="支援 20 種 Agent 框架">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT 授權條款">
</p>

<p align="center">
  <a href="https://trendshift.io/repositories/50668" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/trendshift/repositories/50668/daily" alt="DietrichGebert/ponytail | Trendshift" width="250" height="55"/></a>
  <a href="https://trendshift.io/repositories/50668" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/trendshift/repositories/50668/weekly" alt="DietrichGebert/ponytail | Trendshift" width="250" height="55"/></a>
</p>

<p align="center">
  <strong>程式碼少約 54%（最高 94%）&middot; 成本降低約 20% &middot; 速度提升約 27% &middot; 100% 安全</strong><br>
  <sub>此數據源於真實的 Claude Code 工作階段，在讓同一個 Agent 編輯真實的開源倉庫（FastAPI + React），分別啟用與不啟用此 skill 後測得。程式碼減少約 54% 是 12 個功能任務的平均值（Haiku 4.5，n=4）；在某些 Agent 很容易過度實現的情境（例如日期選擇器），降幅可達 94%；而當程式碼本來就已足夠精簡時，則幾乎沒有差異。ponytail 保留了每一項安全防護，對比僅要求「用一行程式碼解決」的提示詞時則會漏掉其中一項。（早期單次 benchmark 將 80–94% 寫成統一數字；與公平的 Agent 基線相比，那是每個任務的上限，不是平均值。）<a href="benchmarks/results/2026-06-18-agentic.md">完整報告</a> &middot; <a href="benchmarks/">實驗方法</a>。</sub>
</p>

<p align="center">
  <sub>社群翻譯，最新完整版本請參閱 <a href="README.md">英文 README</a>。</sub>
</p>

---

<p align="center">
  <a href="https://ponytail.dev/soon"><img src="assets/waitlist-banner.png" alt="有新東西要來了，加入候補名單" width="760"></a>
</p>

你一定見過這種人：留著長馬尾、戴著橢圓眼鏡，在公司待得比版本控制系統還久。你給他看五十行程式碼；他瞄了一眼，一句話也沒說，就把它們換成一行。

Ponytail 把他塞進你的 AI Agent 裡。

## 前後對照

請 Agent 做一個日期選擇器。它裝上 flatpickr、寫一個 wrapper component、加一份 stylesheet，然後開始討論時區。

有了 ponytail：

```html
<!-- ponytail: browser has one -->
<input type="date">
```

更多倖存案例見 [examples/](examples/)。

## 數據

最直接也最誠實的測法，就是讓真的 Agent 做真實工作：用 headless Claude Code 編輯 [tiangolo 的 full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template)（一個真實的 FastAPI + React repo），再依它留下的 `git diff` 評分。12 個功能任務、同一個 Agent，分別啟用與不啟用 skill，n=4，模型為 Haiku 4.5。

<p align="center">
  <img src="assets/benchmark-agentic.svg" width="860" alt="各組在 LOC、token、成本與耗時上，相對於 no-skill baseline 的百分比（Haiku 4.5）。ponytail 每項都最低：LOC 46%、token 78%、成本 80%、耗時 73%；caveman 的 token、成本與耗時超過 100%；yagni-oneliner 的 LOC 為 67%。安全性另以對抗測試衡量：baseline、caveman 與 ponytail 均為 100%，yagni-oneliner 為 95%。">
</p>

| 相對 no-skill baseline | LOC | token | 成本 | 耗時 | 安全性 |
|---|--:|--:|--:|--:|--:|
| **ponytail** | **-54%** | **-22%** | **-20%** | **-27%** | **100%** |
| caveman（精簡措辭對照組） | -20% | +7% | +3% | +2% | 100% |
| 「YAGNI + 單行程式碼」prompt | -33% | -14% | -21% | -30% | 95% |

ponytail 是唯一讓所有指標都下降，還能維持 100% 安全性的方案。最容易過度實作的地方，效果也最明顯：日期選擇器從 404 行縮到 23 行，顏色選擇器從 287 行縮到 23 行，因為它直接用了原生 `<input>`，而不是又做一個 component。遇到原本就夠精簡的程式碼，差異則接近零。完整方法、各任務數據與限制請見 [benchmark 報告](benchmarks/results/2026-06-18-agentic.md)。

<details>
<summary><strong>早期 single-shot 數據（獨立生成）</strong></summary>

5 個日常任務、3 個模型、3 個比較組（無 skill、[caveman](https://github.com/JuliusBrussee/caveman)、ponytail），每組跑 10 次並取中位數。每次只有一個 prompt、一次回答，最後計算回答中的程式碼行數：

<p align="center">
  <img src="assets/benchmark-3model.svg" width="860" alt="Haiku、Sonnet 與 Opus 各組的程式碼行數中位數">
</p>

結果顯示**程式碼減少 80–94%**。不過 [#126](https://github.com/DietrichGebert/ponytail/issues/126) 指出了一個合理的問題：no-skill baseline 會在回答裡塞進額外說明與選項，因此部分差距只是對話方式造成的。上面的 Agent benchmark 才是修正後、比較站得住腳的版本。要重跑 single-shot 測試，可執行 `npx promptfoo eval -c benchmarks/promptfooconfig.yaml`。

</details>

**這條規則從來不是「token 越少越好」。** 重點是只做任務真正需要的事，但驗證、錯誤處理、安全性與 accessibility 一樣都不能少。程式碼變少，是因為只留下必要的部分，不是在玩 code golf。成本與 latency 降低只是副產品；如果模型花很多 reasoning tokens 逐級思考，反而可能更慢、更貴，GPT-5.5 就是如此。

## 運作方式

寫程式碼前，Agent 會從第一層開始看，遇到能解決問題的那一層就停：

```
1. 這東西有必要存在嗎？       → 沒必要：跳過（YAGNI）
2. 現有 codebase 裡已經有了嗎？ → 重用，別重寫
3. standard library 能做嗎？   → 直接用
4. 原生平台功能能做嗎？        → 用原生功能
5. 已安裝的 dependency 能做嗎？ → 用現有的
6. 一行能搞定嗎？              → 一行
7. 最後才是：寫出能運作的最小版本
```

這套模式會在理解問題*之後*才被套用，而非跳過理解階段。Agent 會先讀完會被改到的程式碼、理解真實流程，再決定停在哪一層。解法可以懶，理解不能懶。

懶不等於草率。Trust boundary 的驗證、防止資料遺失的處理、安全性與 accessibility，永遠不能省。

## 安裝

這大概是 ponytail 唯一會要求你花心思的地方：

Claude Code 與 Codex plugin 會跑兩個很小的 Node.js lifecycle hooks，所以 `node` 必須在 PATH 裡（Nix/nvm 使用者要注意：非互動 shell 的 PATH 也要找得到它）。即使找不到，skills 還是能用；只有自動啟用會保持安靜，不會每個 prompt 都跳錯誤。

### Claude Code

```
/plugin marketplace add DietrichGebert/ponytail
```
```
/plugin install ponytail@ponytail
```
（這兩行要分成兩個 prompt 送出，安裝才會成功）

Claude Code Desktop 的 Code 分頁也是同樣做法：在輸入框送出上面兩個 `/plugin` 指令；也可以按旁邊的 **+**，選擇 **Plugins** → **Add plugin** 瀏覽已設定的 marketplaces。要管理 marketplaces，請到側邊欄的 **Customize**。

### Codex

```bash
codex plugin marketplace add DietrichGebert/ponytail
codex plugin add ponytail@ponytail
```

執行 `codex`、開啟 `/hooks`，確認並信任這兩個 lifecycle hooks，然後開始一個新的 thread。

同一份安裝也適用於 Codex Desktop；安裝後重啟 app 就會載入 plugin。

### GitHub Copilot CLI

```bash
copilot plugin marketplace add DietrichGebert/ponytail
copilot plugin install ponytail@ponytail
```

在 Copilot CLI 的互動 session 裡，也可以使用對應的 slash commands：

```
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

Copilot CLI 會用 plugin 名稱替指令加上 namespace。例如：

```text
/ponytail:ponytail ultra
/ponytail:ponytail-review
```

### Pi agent harness

```
pi install git:github.com/DietrichGebert/ponytail
```

### OpenCode

在 `opencode.json` 加入：

```json
{ "plugin": ["@dietrichgebert/ponytail"] }
```

也可以直接從 checkout 執行（plugin 會重用 `hooks/` 與 `skills/`）：

```json
{ "plugin": ["./.opencode/plugins/ponytail.mjs"] }
```

plugin 會在每個回合注入目前 level 的 ruleset，並加入 `/ponytail` 指令（見[指令](#指令)）。OpenCode 本身也會自動載入 repo 裡的 `AGENTS.md`，所以沒有 plugin 時規則仍然有效；plugin 額外提供 `lite/full/ultra/off` 切換。

`./` 會從專案的 `opencode.json` 開始解析。若多個專案要共用同一份 checkout，請改填 `.mjs` 的絕對路徑；它會從自己的位置找到 `hooks/` 與 `skills/`。

### Gemini CLI

```bash
gemini extensions install https://github.com/DietrichGebert/ponytail
```

它會在每個 session 常駐載入 ruleset、註冊 `/ponytail` 指令，並在需要時啟用 `skills/`。Gemini adapter 刻意不提供根目錄的 `hooks/hooks.json`：Gemini 會自動載入那個路徑，但 Ponytail 的 lifecycle hooks 用的是 Claude/Codex event names。

### Qoder

Qoder 會自動把 repo 根目錄的 `AGENTS.md` 當成常駐 context，所以從 ponytail checkout 執行時不需額外設定。若只想加到單一專案，把 [`.qoder/rules/ponytail.md`](.qoder/rules/ponytail.md) 複製到專案的 `.qoder/rules/` 即可。六個 ponytail skills（`/ponytail`、`/ponytail-review`、`/ponytail-audit`、`/ponytail-debt`、`/ponytail-gain`、`/ponytail-help`）都能透過 Qoder 的 Skill 系統使用；[`.qoder-plugin/plugin.json`](.qoder-plugin/plugin.json) 則會把 plugin 指向 `skills/` 目錄。

若要完整的 plugin 支援（自動啟用 mode，並在每個 prompt 注入 ruleset），請把 [`hooks/qoder-hooks.json`](hooks/qoder-hooks.json) 裡的 hooks 加進 `.qoder/settings.json`，再用 ponytail checkout 的路徑取代 `PONYTAIL_DIR`。`UserPromptSubmit` 會在第一個 prompt 啟用預設 mode，之後每回合注入 ruleset；搭配 `task|Task` matcher 的 `PreToolUse` 則會把 ruleset 傳給 subagents。`/ponytail lite|full|ultra|off` 也會自動生效。

### Antigravity CLI

Google 正在把 Gemini CLI 改名為 Antigravity CLI（執行檔是 `agy`）；同一個 extension 也能裝在那裡：

```bash
agy plugin install https://github.com/DietrichGebert/ponytail
```

它沿用 repo 裡的 `gemini-extension.json`。差別是 Antigravity 會把 `/ponytail` commands 轉成 skills，所以要直接在 chat 輸入，例如把 `/ponytail-review` 當成訊息送出，而不是從 slash menu 選取。遷移完成前（約 2026 年 6 月 18 日），`gemini extensions install` 仍然能用。若要改成常駐 rule，請把 ruleset 放進 `.agents/rules/`。

### Hermes Agent

```bash
hermes plugins install DietrichGebert/ponytail --enable
```

安裝後重啟 Hermes。plugin 會在每次呼叫 LLM 前注入目前的 Ponytail mode，把附帶的 skills 註冊成 `ponytail:<skill>`，並加入 `/ponytail`、`/ponytail-review`、`/ponytail-audit`、`/ponytail-debt`、`/ponytail-gain` 與 `/ponytail-help`。如果是共用 gateway，請用 Hermes 的 slash-command 權限控制，把 `/ponytail` 限制給受信任的使用者；runtime mode 只在目前 process 有效。

### CodeWhale

CodeWhale 會讀取專案根目錄的 `AGENTS.md`，完全不用設定。把 [`AGENTS.md`](AGENTS.md) 複製到你的專案，或直接在這個 repo 的 checkout 執行 `codewhale`。就這麼簡單。

### Swival

先把 collection 放進 library，再加入需要的 skills：

```bash
swival skills add --global https://github.com/DietrichGebert/ponytail  # 放進 ~/.config/swival/library
swival skills add ponytail                                             # 安裝到目前專案
swival skills add --global ponytail                                    # 或在所有專案啟用
```

Swival 也會讀取專案根目錄的 `AGENTS.md`，並把全域的 `~/.config/swival/AGENTS.md` 當成 instruction-only fallback。

要在命令列明確啟用 skill，請加上 `$` 前綴，例如 `$ponytail-review`。

### Devin CLI

```bash
devin plugins install DietrichGebert/ponytail
```

這會把 ponytail 裝成 Devin plugin；skills 會出現在 `/ponytail:ponytail`、`/ponytail:ponytail-review` 等指令下。

### OpenClaw

```bash
clawhub install ponytail
```

這會從 ClawHub 安裝 ponytail skill。review、audit、debt、gain 與 help 也用同樣方式安裝，例如 `clawhub install ponytail-review`。OpenClaw 會在程式設計任務中自動套用它，也會提供 `/ponytail` 指令。沒有 ClawHub 的話，把 [`.openclaw/skills/ponytail`](.openclaw/skills/) 複製到 `~/.openclaw/skills/` 即可。

### Grok Build

```bash
grok plugin install DietrichGebert/ponytail --trust
```

plugin 預設是關閉的。輸入 `/plugins` → Plugins，再在 `ponytail` 上按空白鍵；也可以直接在 `~/.grok/config.toml` 加入：

```toml
[plugins]
enabled = ["ponytail"]
```

開始新的 session（或重新載入 plugins）後，skills 會顯示成 `/ponytail`、`/ponytail-review`、`/ponytail-audit`、`/ponytail-debt`、`/ponytail-gain`、`/ponytail-help`，可以用 `grok inspect` 確認。Grok 會依 skill description，在程式設計任務中自動叫用 ponytail；需要明確啟用時，使用 `/ponytail`、`/ponytail lite`、`/ponytail full` 或 `/ponytail ultra`。Grok 不使用 lifecycle hooks，因為它的 SessionStart output 無法注入 instructions。

即使沒有 plugin，從 checkout 執行時仍可透過 `AGENTS.md` 使用 instruction-only mode。

就這樣。他大概會感到驕傲，只是不會說出口。

ponytail 會在每個 session 保持啟用，並提供幾個[指令](#指令)。`/ponytail ultra` 是留給 codebase 真的惹毛你的時候。啟動或切換 level 時，畫面會顯示目前 mode。

要設定每個新 session 的預設 level，可以用 `PONYTAIL_DEFAULT_MODE` 環境變數（`lite`/`full`/`ultra`/`off`），或修改 `~/.config/ponytail/config.json` 裡的 `defaultMode`（Windows 路徑為 `%APPDATA%\ponytail\config.json`）。預設是 `full`。

啟用後，透過 Agent tool 建立的每個 subagent 也會收到這套 ruleset。若只想套用到特定 Agent 類型，例如排除 read-only search agents，可以把 `PONYTAIL_SUBAGENT_MATCHER` 設成比對 `agent_type` 的 regex。比對不限制起訖位置，也不分大小寫：`explore|general` 會比對任一項，`^general$` 則是精確比對；plugin Agent 類型通常長得像 `plugin:name`。預設會注入所有 subagents；regex 無效或平台沒有回報 Agent 類型時，也會退回全部注入。

Cursor、Windsurf、Cline、GitHub Copilot Chat（指 VS Code、JetBrains 與 Visual Studio extensions，不是[安裝](#安裝)裡的獨立 Copilot CLI）、Aider、Kiro、Zed、CodeWhale、Swival、Qoder：從這個 repo 複製對應的 rule file（[`.cursor/rules/`](.cursor/rules/)、[`.windsurf/rules/`](.windsurf/rules/)、[`.clinerules/`](.clinerules/)、[`.github/copilot-instructions.md`](.github/copilot-instructions.md)、[`AGENTS.md`](AGENTS.md)、[`.kiro/steering/`](.kiro/steering/)、[`.qoder/rules/`](.qoder/rules/)）。

Kiro：把 `.kiro/steering/ponytail.md` 複製到全域的 `~/.kiro/steering/`，或專案裡的 `.kiro/steering/`。

GitHub Copilot CLI 的 fallback（instruction-only mode）：它會讀取專案裡的 `AGENTS.md` 與 `.github/copilot-instructions.md`。若希望所有專案都套用 ponytail，把 rules 複製到 `~/.copilot/copilot-instructions.md`。這種方式仍有常駐指引，但沒有 plugin 的 level 切換與 hooks。

VS Code 的 Codex extension 會讀取 `AGENTS.md`。這個 repo 已經附上該檔案，所以從 repo 根目錄執行時不需設定；放到 `~/.codex/AGENTS.md` 則會全域生效。

JetBrains Junie 也能讀取 `AGENTS.md`，但目前不會自動載入。請到 Settings → Tools → Junie → Project Settings → Guidelines Path 指向該檔案。這個 repo 已經附上 `AGENTS.md`；`.junie/guidelines.md` 是 Junie 的舊路徑。

Amp（Sourcegraph）會從目前目錄一路往上讀取 `AGENTS.md`，直到 `$HOME`。這個 repo 已經附上該檔案，所以不需設定；要全域套用則放到 `~/.config/amp/AGENTS.md`。

Jules（Google）會讀取 repo 根目錄的 `AGENTS.md`。這個 repo 已經附上該檔案，因此不需設定就會載入 ruleset。

各 Agent 對應哪些檔案，請見 [Agent portability](docs/agent-portability.md)。

### 解除安裝

| 宿主 | 指令 |
|------|---------|
| Claude Code | `/plugin remove ponytail` |
| Codex | `codex plugin remove ponytail` |
| Devin CLI | `devin plugins remove ponytail` |
| Grok Build | `grok plugin uninstall ponytail` |
| Pi agent | `pi uninstall ponytail` |
| Cursor / Windsurf / Cline / Qoder / 等 | 刪除已複製的規則檔 |

上面的指令只會刪除 plugin 本身，ponytail 寫在 plugin 目錄外的少量 state 仍會保留，包括 mode flag、`~/.config/ponytail/config.json`，以及你若接受過設定提示，`~/.claude/settings.json` 裡的 `statusLine`。要一起清掉，請執行 `node scripts/uninstall.js`。**記得先跑這支 script，再執行上面的 uninstall command**——script 本身就在 plugin 裡，先移除 plugin 就找不到它了；另一個做法是從別份 checkout 執行。它只會刪除指向 ponytail 自己 script 的 `statusLine`，不會碰你手動設定的 status line。

## 指令

| 指令 | 用途 |
|---------|--------------|
| `/ponytail [lite \| full \| ultra \| off]` | 切換 level 或關閉 ponytail；不帶參數時顯示目前 level。 |
| `/ponytail-review` | 檢查目前 diff 有沒有過度設計，並列出能刪掉的東西。 |
| `/ponytail-audit` | 檢查整個 repo，而不只看目前 diff。 |
| `/ponytail-debt` | 收集標有 `ponytail:`、留待以後處理的簡化項，免得「以後」變成「永遠不做」。 |
| `/ponytail-gain` | 顯示 benchmark 測得的效果（更少程式碼、更低成本、更快速度）。 |
| `/ponytail-help` | 上述指令的快速參考。 |

這些指令需要支援 skills 的 host（Claude Code、Codex、Devin CLI、OpenCode、Gemini、pi、Swival、Hermes Agent、Qoder、Grok Build）。在 Codex 裡，它們是以 `@` 呼叫的 skills，例如 `@ponytail-review`。instruction-only adapters（Cursor、Windsurf、Cline、Copilot、Kiro、Antigravity）只會載入常駐 ruleset，不提供這些指令。

## 開發

修改精簡版 rules 時，記得同步各 Agent 版本：

```bash
node scripts/check-rule-copies.js
npm test
```

OpenClaw skill package（`.openclaw/skills/`）是從 `skills/` 產生的。改完 skill 後，請重新執行 `node scripts/build-openclaw-skills.js`，否則 tests 會因內容過期而失敗。要發布到 ClawHub，先執行一次 `clawhub login`，再跑 `node scripts/publish-openclaw-skills.js`；它會用 `package.json` 的版本發布全部六個 skills，也可以加上 `--dry-run` 先預覽。

correctness benchmark 會啟動 Python 檢查 email 與 CSV，先嘗試 `python3`，再嘗試 `python`。要跑 CSV 檢查，本機必須安裝 `pandas`。

## 常見問題

**可以和 [caveman](https://github.com/JuliusBrussee/caveman) 一起使用嗎？**
可以，而且很適合。Caveman 負責讓 Agent 說得更少，ponytail 負責讓 Agent 寫得更少；兩者各管一半，完全不衝突。caveman 不改程式碼，ponytail 不改說話方式。用更少的話，談更少的程式碼。

**需要設定檔嗎？**
不需要。想設定預設 level 時，可以使用 `~/.config/ponytail/config.json` 或 `PONYTAIL_DEFAULT_MODE`；不設定也能直接用。

**如果我真的需要那個 120 行的快取類別呢？**
你其實並不真的需要。但若你堅持，他還是會寫。慢慢地、正確地，順便盯著你。

**它能擴展嗎？**
沒寫出來的程式碼可以無限擴展。零 bug、零 CVE，uptime 永遠是 100%。

**為什麼叫「ponytail」？**
你心知肚明。

## 贊助商

<p align="center">
  <a href="https://greenpt.com/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="assets/logo-greenpt-dark.svg">
      <img src="assets/logo-greenpt.svg" width="260" alt="GreenPT">
    </picture>
  </a>
</p>

## 授權條款

[MIT](LICENSE)。夠用，而且最短。

## Star 歷史

<a href="https://www.star-history.com/dietrichgebert/ponytail#history">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date" />
   <img alt="Star 歷史圖表" src="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date" />
 </picture>
</a>
