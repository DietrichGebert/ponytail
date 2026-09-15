<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.png">
    <img src="assets/logo.png" width="220" alt="Ponytail，懒惰的资深开发者">
  </picture>
</p>

<h1 align="center">Ponytail</h1>

<p align="center">
  <em>他一言不发。他只写一行。它能运行。</em>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/DietrichGebert/ponytail?style=flat-square&color=111111&label=stars" alt="Stars">
  <img src="https://img.shields.io/github/v/release/DietrichGebert/ponytail?style=flat-square&color=111111&label=release" alt="Release">
  <img src="https://img.shields.io/npm/v/@dietrichgebert/ponytail?style=flat-square&color=111111&label=npm" alt="npm">
  <img src="https://img.shields.io/badge/works%20with-20%20agents-111111?style=flat-square" alt="支持 20 种 Agent">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT 许可证">
</p>

<p align="center">
  <a href="https://trendshift.io/repositories/50668" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/trendshift/repositories/50668/daily" alt="DietrichGebert/ponytail | Trendshift" width="250" height="55"/></a>
  <a href="https://trendshift.io/repositories/50668" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/trendshift/repositories/50668/weekly" alt="DietrichGebert/ponytail | Trendshift" width="250" height="55"/></a>
</p>

<p align="center">
  <strong>代码量减少约 54%（最高 94%）&middot; 成本降低约 20% &middot; 速度提升约 27% &middot; 安全性 100%</strong><br>
  <sub>数据来自真实 Claude Code 会话：同一个 Agent 分别在启用和未启用本技能的情况下编辑一个真实的开源仓库（FastAPI + React）。约 54% 是 12 项功能任务的平均值（Haiku 4.5，n=4）；当 Agent 过度构建时（如日期选择器），降幅可达 94%；原本已经足够精简的代码则几乎没有变化。Ponytail 保留了所有安全防护，而单纯要求“写成一行”的提示会漏掉一项防护。（早期单轮基准测试将 80%～94% 作为统一结果；与公平的 Agent 基线相比，它应被视为单项任务的上限，而非平均值。）<a href="benchmarks/results/2026-06-18-agentic.md">完整报告</a> &middot; <a href="benchmarks/">复现测试</a>。</sub>
</p>

<p align="center">
  <sub><a href="README.md">English</a> &middot; <a href="README.es.md">Español</a> &middot; <a href="README.ko.md">한국어</a></sub>
</p>

---

<p align="center">
  <a href="https://ponytail.dev/soon"><img src="assets/waitlist-banner.png" alt="新东西即将到来，加入候补名单" width="760"></a>
</p>

你认识这种人。长马尾，椭圆眼镜，在公司的时间比版本控制系统还长。你给他看五十行代码；他看了一眼，一言不发，然后把它替换成一行。

Ponytail 把他装进你的 AI Agent。

## 前后对比

你让 Agent 做一个日期选择器。它安装 flatpickr、编写包装组件、添加样式表，然后开始讨论时区。

使用 Ponytail：

```html
<!-- ponytail: 浏览器自带 -->
<input type="date">
```

[examples/](examples/) 中还有更多幸存案例。

## 数据

最诚实的测量方式，是让真实 Agent 完成真实工作：使用无界面的 Claude Code 会话编辑 [tiangolo 的 full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template)（一个真实的 FastAPI + React 仓库），并根据最终留下的 `git diff` 评分。共十二个功能工单，同一个 Agent 分别启用和不启用本技能，n=4，Haiku 4.5。

<p align="center">
  <img src="assets/benchmark-agentic.svg" width="860" alt="各实验组相对于未启用技能基线的代码行数、token、成本和时间百分比（Haiku 4.5）。Ponytail 的所有指标最低（代码行数 46%、token 78%、成本 80%、时间 73%）；caveman 的 token、成本和时间超过 100%；yagni-oneliner 的代码行数为 67%。在单独的对抗性安全测试中：基线、caveman 和 Ponytail 均为 100%，yagni-oneliner 为 95%。">
</p>

| 相对于未启用技能的基线 | 代码行数 | token | 成本 | 时间 | 安全性 |
|---|--:|--:|--:|--:|--:|
| **ponytail** | **-54%** | **-22%** | **-20%** | **-27%** | **100%** |
| caveman（精简表达对照组） | -20% | +7% | +3% | +2% | 100% |
| “YAGNI + 单行代码”提示 | -33% | -14% | -21% | -30% | 95% |

Ponytail 是唯一让所有指标都下降的实验组，也是唯一在精简的同时保持完全安全的实验组。当任务存在明显的过度构建陷阱时，降幅最大（日期选择器从 404 行降至 23 行，颜色选择器从 287 行降至 23 行，因为它选择原生 `<input>` 而不是组件）；对于已经足够精简的代码，降幅接近于零。完整方法、逐项任务数据与局限性请参阅：[benchmarks/results/2026-06-18-agentic.md](benchmarks/results/2026-06-18-agentic.md)。

<details>
<summary><strong>较早的单轮测试数据（独立生成）</strong></summary>

五项日常任务、三个模型、三个实验组（无技能、[caveman](https://github.com/JuliusBrussee/caveman)、Ponytail），运行十次并报告中位数。每次提供一个提示、生成一次回答，并统计回答的代码行数：

<p align="center">
  <img src="assets/benchmark-3model.svg" width="860" alt="Haiku、Sonnet 和 Opus 三个模型在各实验组中的代码行数中位数">
</p>

该测试得到的结果是**代码量减少 80%～94%**。[#126](https://github.com/DietrichGebert/ponytail/issues/126) 合理地指出，裸模型基线会在回答中填充说明和备选方案，因此差距部分来自对话基线的偏差。上面的 Agent 测试数据是修正后更站得住脚的版本。使用 `npx promptfoo eval -c benchmarks/promptfooconfig.yaml` 可以复现单轮测试。

</details>

**规则从来不是“token 越少越好”。**规则是：只编写任务真正需要的内容，绝不删减验证、错误处理、安全措施或可访问性。代码变少，是因为只保留必要内容，而不是刻意炫技式压缩。对于遵循这套阶梯的模型，成本和延迟降低只是副作用；如果一个精简表达的推理模型花费大量思考 token 权衡各层选择，结果也可能相反（GPT-5.5 就是如此）。

## 工作原理

在编写代码前，Agent 会在第一个成立的层级停下：

```
1. 真的需要存在吗？       → 不需要：跳过（YAGNI）
2. 代码库里已经有了吗？   → 复用，不要重写
3. 标准库能做吗？         → 使用标准库
4. 平台原生功能能做吗？   → 使用原生功能
5. 已安装的依赖能做吗？   → 使用现有依赖
6. 能用一行完成吗？       → 写成一行
7. 到这一步才：编写能工作的最小实现
```

这套阶梯在理解问题*之后*运行，而不是代替理解：Agent 会先阅读改动涉及的代码并追踪完整流程，再选择层级。解决方案可以懒，阅读绝不能懒。

懒惰，但不失职：信任边界验证、防止数据丢失的处理、安全性和可访问性永远不能删。

## 安装

这是 Ponytail 会要求你付出的最大努力：

Claude Code 和 Codex 插件会运行两个很小的 Node.js 生命周期钩子，因此 `node` 必须位于 PATH 中（Nix/nvm 用户请注意：它必须位于非交互式 shell 的 PATH 中）。如果没有，技能仍然可用，只是常驻激活功能会保持静默，而不会在每次提示时都报错。

### Claude Code

```
/plugin marketplace add DietrichGebert/ponytail
```
```
/plugin install ponytail@ponytail
```

（需要分别发送这两条提示才能完成安装。）

Claude Code 桌面应用的 Code 标签页步骤相同：在提示框中输入上述两个 `/plugin` 命令，或点击旁边的 **+** 按钮，选择 **Plugins** → **Add plugin** 浏览已配置的市场；市场可在侧边栏的 **Customize** 中管理。

### Codex

```bash
codex plugin marketplace add DietrichGebert/ponytail
codex plugin add ponytail@ponytail
```

运行 `codex` 并打开 `/hooks`，审核并信任它的两个生命周期钩子，然后创建新会话。

同一安装也适用于 Codex 桌面应用：安装后重启应用即可加载插件。

### GitHub Copilot CLI

```bash
copilot plugin marketplace add DietrichGebert/ponytail
copilot plugin install ponytail@ponytail
```

在交互式 Copilot CLI 会话中，可以使用对应的斜杠命令：

```
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

Copilot CLI 会按插件名称给命令添加命名空间。例如：

```text
/ponytail:ponytail ultra
/ponytail:ponytail-review
```

### Pi Agent 框架

```
pi install git:github.com/DietrichGebert/ponytail
```

### OpenCode

添加到 `opencode.json`：

```json
{ "plugin": ["@dietrichgebert/ponytail"] }
```

也可以从检出的仓库运行（插件会复用 `hooks/` 和 `skills/`）：

```json
{ "plugin": ["./.opencode/plugins/ponytail.mjs"] }
```

它会在每轮对话中按当前级别注入规则集，并添加 `/ponytail` 命令（参阅[命令](#命令)）。OpenCode 还会自动加载本仓库的 `AGENTS.md`，因此即使没有插件，规则仍然有效。插件额外提供 `lite/full/ultra/off` 级别。

`./` 路径相对于项目的 `opencode.json` 解析；如果多个项目共用同一个检出目录，请填写 `.mjs` 文件的绝对路径（它会相对于自身位置寻找 `hooks/` 和 `skills/`）。

### Gemini CLI

```bash
gemini extensions install https://github.com/DietrichGebert/ponytail
```

它会在每个会话中将规则集作为常驻上下文加载，并注册 `/ponytail` 命令；`skills/` 也会随扩展提供，在任务需要时激活。
Gemini 适配器有意不在根目录提供 `hooks/hooks.json`：Gemini 会自动加载该路径，而 Ponytail 的生命周期钩子使用 Claude/Codex 的事件名称。

### Qoder

Qoder 会自动从仓库根目录加载 `AGENTS.md` 作为常驻上下文，因此直接在本仓库的检出目录运行即可，无需设置。若要为单个项目启用规则，请将 [`.qoder/rules/ponytail.md`](.qoder/rules/ponytail.md) 复制到项目的 `.qoder/rules/`。六项 Ponytail 技能（`/ponytail`、`/ponytail-review`、`/ponytail-audit`、`/ponytail-debt`、`/ponytail-gain`、`/ponytail-help`）可通过 Qoder 的 Skill 系统使用；[`.qoder-plugin/plugin.json`](.qoder-plugin/plugin.json) 中的插件清单指向 `skills/` 目录。

若需要完整插件级支持（自动激活模式，并在每次提示中注入规则集），请将 [`hooks/qoder-hooks.json`](hooks/qoder-hooks.json) 中的钩子添加到 `.qoder/settings.json`，并把 `PONYTAIL_DIR` 替换为 Ponytail 检出目录的路径。Qoder 的 `UserPromptSubmit` 钩子会在第一次提示时激活默认模式，并在每轮注入规则集；带有 `task|Task` 匹配器的 `PreToolUse` 会向子 Agent 注入规则集。级别切换（`/ponytail lite|full|ultra|off`）会自动生效。

### Antigravity CLI

Google 正在将 Gemini CLI 重命名为 Antigravity CLI（`agy` 可执行文件）；安装方式相同：

```bash
agy plugin install https://github.com/DietrichGebert/ponytail
```

它会复用本仓库的 `gemini-extension.json`。不同之处在于，Antigravity 会把 `/ponytail` 命令转换为技能，因此你需要在聊天中输入它们（例如将 `/ponytail-review` 作为消息发送），而不是从斜杠菜单选择。在迁移完成前（约 2026 年 6 月 18 日），`gemini extensions install` 仍然有效。若要把它作为常驻规则运行，请将规则集放入 `.agents/rules/`。

### Hermes Agent

```bash
hermes plugins install DietrichGebert/ponytail --enable
```

安装后重启 Hermes。插件会在每次 LLM 调用前注入当前 Ponytail 模式，将内置技能注册为 `ponytail:<skill>`，并添加 `/ponytail`、`/ponytail-review`、`/ponytail-audit`、`/ponytail-debt`、`/ponytail-gain` 和 `/ponytail-help`。在共享网关中，请使用 Hermes 的斜杠命令访问控制，将 `/ponytail` 限制给可信用户；运行时模式仅在当前进程内生效。

### CodeWhale

CodeWhale 会读取仓库根目录的 `AGENTS.md`，无需设置。将 [`AGENTS.md`](AGENTS.md) 复制到你的项目，或在本仓库的检出目录运行 `codewhale`，仅此而已。

### Swival

先将集合暂存到技能库，再添加所需技能：

```bash
swival skills add --global https://github.com/DietrichGebert/ponytail  # 暂存到 ~/.config/swival/library
swival skills add ponytail                                             # 将集合安装到当前项目
swival skills add --global ponytail                                    # 或在所有项目中启用
```

Swival 还会读取仓库根目录的 `AGENTS.md`，并从 `~/.config/swival/AGENTS.md` 读取全局规则；这是仅使用指令的备用方式。

在命令行中，使用 `$` 前缀显式激活技能。例如：`$ponytail-review`。

### Devin CLI

```bash
devin plugins install DietrichGebert/ponytail
```

这会将 Ponytail 安装为 Devin 插件；技能将以 `/ponytail:ponytail`、`/ponytail:ponytail-review` 等名称提供。

### OpenClaw

```bash
clawhub install ponytail
```

这会从 ClawHub 安装 Ponytail 的 OpenClaw 技能；review、audit、debt、gain 和 help 技能的安装方式相同（例如 `clawhub install ponytail-review`）。OpenClaw 会在编码任务中应用该技能，并将其公开为 `/ponytail` 命令。如果不使用 ClawHub，请将 [`.openclaw/skills/ponytail`](.openclaw/skills/) 复制到 `~/.openclaw/skills/`。

### Grok Build

```bash
grok plugin install DietrichGebert/ponytail --trust
```

启用插件（默认关闭）：进入 `/plugins` → Plugins → 在 `ponytail` 上按空格键，或在 `~/.grok/config.toml` 中添加：

```toml
[plugins]
enabled = ["ponytail"]
```

启动新会话（或重新加载插件）。技能会显示为 `/ponytail`、`/ponytail-review`、`/ponytail-audit`、`/ponytail-debt`、`/ponytail-gain`、`/ponytail-help`。使用 `grok inspect` 验证。Grok 可以根据技能描述，在编码任务中自动调用 Ponytail；需要显式激活时，请使用 `/ponytail`（或 `/ponytail lite`、`/ponytail full`、`/ponytail ultra`）。Ponytail 不使用 Grok 生命周期钩子，因为其 `SessionStart` 输出无法注入指令。

不使用插件时，仍可从检出目录通过 `AGENTS.md` 使用纯指令模式。

就是这样。他会感到骄傲，但不会说出来。

Ponytail 会在每个会话中保持激活，并提供少量命令（参阅[命令](#命令)）。当代码库惹到你时，可以使用 `/ponytail ultra`。启动和模式切换提示会显示当前模式。

可通过 `PONYTAIL_DEFAULT_MODE` 环境变量（`lite`/`full`/`ultra`/`off`），或 `~/.config/ponytail/config.json`（Windows 上为 `%APPDATA%\ponytail\config.json`）中的 `defaultMode` 字段，为每个新会话设置级别。默认为 `full`。

激活后，规则集还会注入通过 Agent 工具创建的每个子 Agent。若只想对特定 Agent 类型启用它（例如对只读搜索 Agent 关闭），请将 `PONYTAIL_SUBAGENT_MATCHER` 环境变量设为针对子 Agent `agent_type` 的正则表达式。匹配不区分大小写且无需覆盖完整字符串：`explore|general` 可匹配任意一种，`^general$` 表示精确匹配，插件 Agent 类型形如 `plugin:name`。未设置时会注入所有子 Agent（默认行为）；正则表达式无效，或平台没有报告子 Agent 类型时，也会回退到全部注入。

Cursor、Windsurf、Cline、GitHub Copilot Chat（VS Code、JetBrains 和 Visual Studio 编辑器扩展，不是上面[安装](#安装)中介绍的独立 Copilot CLI）、Aider、Kiro、Zed、CodeWhale、Swival、Qoder：从本仓库复制对应的规则文件（[`.cursor/rules/`](.cursor/rules/)、[`.windsurf/rules/`](.windsurf/rules/)、[`.clinerules/`](.clinerules/)、[`.github/copilot-instructions.md`](.github/copilot-instructions.md)、[`AGENTS.md`](AGENTS.md)、[`.kiro/steering/`](.kiro/steering/)、[`.qoder/rules/`](.qoder/rules/)）。

Kiro：将 `.kiro/steering/ponytail.md` 复制到 `~/.kiro/steering/`（全局）或项目的 `.kiro/steering/` 中。

GitHub Copilot CLI 备用方式（纯指令模式）：它会读取项目中的 `AGENTS.md` 和 `.github/copilot-instructions.md`；也可以将规则复制到 `~/.copilot/copilot-instructions.md`，以便在所有项目中运行 Ponytail。这种方式会保留常驻指导，但不会添加插件模式切换或钩子。

带 Codex 扩展的 VS Code 会读取本仓库提供的 `AGENTS.md`，因此从仓库根目录运行即可，无需设置（将它放在 `~/.codex/AGENTS.md` 可让 Codex 全局使用）。

在 JetBrains Junie 中，可前往 Settings → Tools → Junie → Project Settings → Guidelines Path 指向 `AGENTS.md`（目前尚不会自动读取）。本仓库提供 `AGENTS.md`；`.junie/guidelines.md` 是 Junie 的旧版路径。

Amp（Sourcegraph）会读取工作目录及其父目录直到 `$HOME` 中的 `AGENTS.md`；本仓库已提供该文件，因此无需设置（`~/.config/amp/AGENTS.md` 可用于全局配置）。

Jules（Google）会读取仓库根目录的 `AGENTS.md`；本仓库已提供该文件，因此无需设置即可使用规则集。

各文件与 Agent 的对应关系请参阅：[Agent 可移植性](docs/agent-portability.md)。

### 卸载

| 宿主 | 命令 |
|------|------|
| Claude Code | `/plugin remove ponytail` |
| Codex | `codex plugin remove ponytail` |
| Devin CLI | `devin plugins remove ponytail` |
| Grok Build | `grok plugin uninstall ponytail` |
| Pi Agent | `pi uninstall ponytail` |
| Cursor / Windsurf / Cline / Qoder 等 | 删除复制的规则文件 |

这些命令会删除插件自身的文件，但会保留 Ponytail 写入插件目录之外的少量状态：模式标记、`~/.config/ponytail/config.json`，以及（如果接受了设置提示）`~/.claude/settings.json` 中的 `statusLine` 项。运行 `node scripts/uninstall.js` 可以一并清理。**请在执行上面的宿主卸载命令前运行该脚本**——脚本本身也是插件文件，先卸载插件会把它删除（也可从另一个仓库副本运行）。只有当 `statusLine` 指向 Ponytail 自己的脚本时，清理程序才会删除它，因此你自行设置的状态栏不会受影响。

## 命令

| 命令 | 作用 |
|------|------|
| `/ponytail [lite \| full \| ultra \| off]` | 设置强度或关闭 Ponytail。不带参数时报告当前级别。 |
| `/ponytail-review` | 检查当前 diff 中的过度设计，并给出删除清单。 |
| `/ponytail-audit` | 审计整个仓库的过度设计，而不仅是当前 diff。 |
| `/ponytail-debt` | 将暂缓处理的 `ponytail:` 简化项收集到账本中，避免“以后”变成“永远不做”。 |
| `/ponytail-gain` | 显示基准测试得出的影响数据（更少代码、更低成本、更快速度）。 |
| `/ponytail-help` | 显示上述命令的快速参考。 |

这些命令需要支持技能的宿主（Claude Code、Codex、Devin CLI、OpenCode、Gemini、Pi、Swival、Hermes Agent、Qoder、Grok Build）。在 Codex 中，它们是技能，请使用 `@` 调用（例如 `@ponytail-review`）。仅使用指令的适配器（Cursor、Windsurf、Cline、Copilot、Kiro、Antigravity）会加载常驻规则集，但不提供命令。

## 开发

修改精简规则文本时，请保持各 Agent 副本同步：

```bash
node scripts/check-rule-copies.js
npm test
```

OpenClaw 技能包（`.openclaw/skills/`）由 `skills/` 生成；修改技能后，请重新运行 `node scripts/build-openclaw-skills.js`，若内容过期，测试套件会失败。若要将技能发布到 ClawHub，请先运行一次 `clawhub login`，再运行 `node scripts/publish-openclaw-skills.js`（它会以 `package.json` 中的版本发布全部六项技能；传入 `--dry-run` 可预览）。

正确性基准测试会调用 Python 检查电子邮件和 CSV；它会先尝试 `python3`，再尝试 `python`。CSV 检查需要本地安装 `pandas`。

## 常见问题

**可以和 [caveman](https://github.com/JuliusBrussee/caveman) 一起使用吗？**
可以，而且建议这样做。Caveman 精简 Agent 的表达，Ponytail 精简 Agent 构建的内容。两者负责不同部分，互不重叠：Caveman 不改动代码，Ponytail 不干涉表达。简短地说话，最小化地编码。

**需要配置文件吗？**
不需要。可以通过可选的 `~/.config/ponytail/config.json` 或 `PONYTAIL_DEFAULT_MODE` 环境变量设置默认级别，但它们都不是必需项。

**如果我真的需要那个 120 行的缓存类呢？**
你不需要。你要是坚持，他还是会写。慢慢地。正确地。一边看着你。

**它能扩展吗？**
你没写的代码可以无限扩展。零 Bug、零 CVE，自古以来可用率 100%。

**为什么叫“Ponytail”？**
你完全知道为什么。

## 赞助商

<p align="center">
  <a href="https://greenpt.com/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="assets/logo-greenpt-dark.svg">
      <img src="assets/logo-greenpt.svg" width="260" alt="GreenPT">
    </picture>
  </a>
</p>

## 许可证

[MIT](LICENSE)。能用的最短许可证。

## Star 历史

<a href="https://www.star-history.com/dietrichgebert/ponytail#history">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date" />
   <img alt="Star 历史图" src="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date" />
 </picture>
</a>
