<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.png">
    <img src="assets/logo.png" width="220" alt="Ponytail，那个懒惰的资深开发者">
  </picture>
</p>

<h1 align="center">Ponytail</h1>

<p align="center">
  <em>他一言不发。写下一行。搞定。</em>
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
  <strong>代码减少约 54%（最高 94%）&middot; 成本降低约 20% &middot; 速度提升约 27% &middot; 100% 安全</strong><br>
  <sub>数据来自真实的 Claude Code 会话：让同一个 Agent 在启用和未启用该技能的情况下，编辑一个真实的开源仓库（FastAPI + React）。约 54% 是 12 项功能任务的平均值（Haiku 4.5，n=4）；当 Agent 会过度实现时（比如日期选择器），降幅可达 94%；而当代码已经足够精简时，降幅则接近零。ponytail 会保留所有安全防护，而单纯一句“写成单行”的提示会漏掉其中一项。（早期单轮基准测试将 80–94% 作为一个笼统数字；与公平的 Agent 基准相比，这其实是单项任务的上限，而不是平均值。）<a href="benchmarks/results/2026-06-18-agentic.md">完整报告</a> &middot; <a href="benchmarks/">复现实验</a>。</sub>
</p>

<p align="center">
  <sub>社区翻译。最新且作为基准的版本请参阅<a href="README.md">英文 README</a>。</sub>
</p>

---

<p align="center">
  <a href="https://ponytail.dev/soon"><img src="assets/waitlist-banner.png" alt="有新东西要来了，加入候补名单" width="760"></a>
</p>

你认识这种人。留着长马尾，戴着椭圆眼镜，在公司待得比版本控制还久。你给他看五十行代码；他看了一眼，一言不发，然后把它们换成一行。

Ponytail 把他塞进你的 AI Agent 里。

## 前后对比

你让 Agent 做一个日期选择器。它安装 flatpickr，写一个封装组件，加一份样式表，然后开始讨论时区。

用了 ponytail：

```html
<!-- ponytail: 浏览器自带 -->
<input type="date">
```

更多幸存者见 [examples/](examples/)。

## 数据

真正诚实的测量方式，是让真实的 Agent 干真实的活：在无界面的 Claude Code 会话中编辑 [tiangolo 的 full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template)（一个真实的 FastAPI + React 仓库），再根据它留下的 `git diff` 评分。十二张功能工单，同一个 Agent，分别启用和不启用该技能，n=4，Haiku 4.5。

<p align="center">
  <img src="assets/benchmark-agentic.svg" width="860" alt="各实验组在代码行数、Token、成本和耗时上占无技能基准的百分比（Haiku 4.5）。ponytail 的每项指标都最低（代码行数 46%、Token 78%、成本 80%、耗时 73%）；caveman 的 Token、成本和耗时均超过 100%；yagni-oneliner 的代码行数为 67%。安全性采用独立的对抗测试层级：基准组、caveman 和 ponytail 均为 100%，yagni-oneliner 为 95%。">
</p>

| 相比无技能基准 | 代码行数 | Token | 成本 | 耗时 | 安全性 |
|---|--:|--:|--:|--:|--:|
| **ponytail** | **-54%** | **-22%** | **-20%** | **-27%** | **100%** |
| caveman（精简措辞对照组） | -20% | +7% | +3% | +2% | 100% |
| “YAGNI + 单行代码”提示 | -33% | -14% | -21% | -30% | 95% |

ponytail 是唯一让所有指标都下降的实验组，也是唯一在做到这一点的同时仍保持完全安全的实验组。遇到真正的过度实现陷阱时，降幅最大（日期选择器从 404 行降到 23 行，颜色选择器从 287 行降到 23 行，因为它会直接使用原生 `<input>`，而不是再造一个组件）；遇到已经足够精简的代码时，降幅则接近零。完整方法、逐项任务表格和局限性见：[benchmarks/results/2026-06-18-agentic.md](benchmarks/results/2026-06-18-agentic.md)。

<details>
<summary><strong>早期单轮数据（独立生成）</strong></summary>

五项日常任务，三种模型，三个实验组（无技能、[caveman](https://github.com/JuliusBrussee/caveman)、ponytail），运行十次，报告中位数。一次提示，一次补全，统计回答中的代码行数：

<p align="center">
  <img src="assets/benchmark-3model.svg" width="860" alt="Haiku、Sonnet 和 Opus 各实验组的代码行数中位数">
</p>

结果显示，**代码减少了 80–94%**。[#126](https://github.com/DietrichGebert/ponytail/issues/126) 很公允地指出，裸模型基准会用说明和选项把回答撑长，因此这个差距有一部分只是对话式基准带来的假象。上面的 Agent 数据才是修正后、站得住脚的版本。运行 `npx promptfoo eval -c benchmarks/promptfooconfig.yaml` 即可复现单轮测试。

</details>

**规则从来都不是“Token 越少越好”。** 规则是：只写任务真正需要的内容，但绝不删减校验、错误处理、安全性或无障碍支持。代码之所以少，是因为它只保留必要部分，不是因为在玩代码高尔夫。对那些会遵循这套阶梯的模型来说，成本和延迟下降只是副作用；而一个措辞简练、却会花推理 Token 反复权衡各级选项的模型，结果可能恰好相反（GPT-5.5 就是如此）。

## 工作原理

写代码之前，Agent 会沿着阶梯向下，在第一个可行的台阶停下：

```
1. 这东西真的需要存在吗？    → 不需要：跳过（YAGNI）
2. 代码库里已经有了吗？      → 复用，别重写
3. 标准库能做吗？            → 用标准库
4. 平台有原生功能吗？        → 用原生功能
5. 已安装的依赖能做吗？      → 用现有依赖
6. 一行能搞定吗？            → 那就一行
7. 到这一步才写：能工作的最小实现
```

这套阶梯是在它理解问题*之后*才使用的，而不是拿来代替理解：它会先阅读改动涉及的代码，追踪真实流程，然后再选择该停在哪一级。解法可以偷懒，理解绝不偷懒。

懒，但不失职：信任边界校验、数据丢失处理、安全性和无障碍支持，永远不在删减清单上。

## 安装

这是 ponytail 这辈子会要求你付出的最大努力：

Claude Code 和 Codex 插件会运行两个很小的 Node.js 生命周期钩子，所以 `node` 必须在 PATH 中（Nix/nvm 用户请注意：它必须位于非交互式 shell 的 PATH 中）。如果不在，技能仍然可用；只是常驻激活不会生效，也不会在每条提示时反复报错。

### Claude Code

```
/plugin marketplace add DietrichGebert/ponytail
```
```
/plugin install ponytail@ponytail
```
（必须分成两条提示发送，安装才能成功）

在 Claude Code 桌面应用的 Code 标签页中也是同样的步骤：把上面两条 `/plugin` 命令输入提示框，或者点击旁边的 **+** 按钮，依次选择 **Plugins** → **Add plugin** 来浏览已配置的市场；市场可在侧栏的 **Customize** 中管理。

### Codex

```bash
codex plugin marketplace add DietrichGebert/ponytail
codex plugin add ponytail@ponytail
```

运行 `codex`，打开 `/hooks`，检查并信任它的两个生命周期钩子，然后新建一个会话。

同一次安装也适用于 Codex 桌面应用：安装后重启应用，它就会加载插件。

### GitHub Copilot CLI

```bash
copilot plugin marketplace add DietrichGebert/ponytail
copilot plugin install ponytail@ponytail
```

在交互式 Copilot CLI 会话中，请使用对应的斜杠命令：

```
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

Copilot CLI 会用插件名为插件命令划分命名空间。例如：

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

也可以改为从本地检出版本运行（插件会复用 `hooks/` 和 `skills/`）：

```json
{ "plugin": ["./.opencode/plugins/ponytail.mjs"] }
```

它会在每一轮按当前级别注入规则集，并添加 `/ponytail` 命令（见[命令](#命令)）。OpenCode 还会自动加载本仓库的 `AGENTS.md`，因此即使没有插件，规则依然生效。插件额外提供 `lite/full/ultra/off` 级别。

`./` 路径相对于项目的 `opencode.json` 解析；如果想让多个项目共用一份检出版本，请改为填写 `.mjs` 文件的绝对路径（它会相对于自身位置找到 `hooks/` 和 `skills/`）。

### Gemini CLI

```bash
gemini extensions install https://github.com/DietrichGebert/ponytail
```

它会在每个会话中把规则集作为常驻上下文加载，并注册 `/ponytail` 命令；`skills/` 也会一并提供，并在任务需要时启用。
Gemini 适配器有意不提供根目录下的 `hooks/hooks.json`：Gemini 会自动加载该路径，而 Ponytail 的生命周期钩子使用的是 Claude/Codex 的事件名。

### Qoder

Qoder 会把仓库根目录中的 `AGENTS.md` 自动加载为常驻上下文，因此直接从 ponytail 的检出版本运行，无需任何设置。若只想添加项目级规则，请把 [`.qoder/rules/ponytail.md`](.qoder/rules/ponytail.md) 复制到项目的 `.qoder/rules/` 中。六项 ponytail 技能（`/ponytail`、`/ponytail-review`、`/ponytail-audit`、`/ponytail-debt`、`/ponytail-gain`、`/ponytail-help`）可通过 Qoder 的 Skill 系统使用；位于 [`.qoder-plugin/plugin.json`](.qoder-plugin/plugin.json) 的插件清单指向 `skills/` 目录。

若要获得完整的插件级支持（自动激活模式 + 每条提示都注入规则集），请把 [`hooks/qoder-hooks.json`](hooks/qoder-hooks.json) 中的钩子加入 `.qoder/settings.json`。把 `PONYTAIL_DIR` 替换为 ponytail 检出版本所在的路径。Qoder 的 `UserPromptSubmit` 钩子会在第一条提示时激活默认模式，并在每一轮注入规则集；带有 `task|Task` 匹配器的 `PreToolUse` 会把规则集注入子 Agent。级别切换（`/ponytail lite|full|ultra|off`）会自动生效。

### Antigravity CLI

Google 正在把 Gemini CLI 更名为 Antigravity CLI（二进制文件名为 `agy`）；同一个扩展也可以安装到那里：

```bash
agy plugin install https://github.com/DietrichGebert/ponytail
```

它会复用本仓库的 `gemini-extension.json`。有一点不同：Antigravity 会把 `/ponytail` 命令转换成技能，因此你需要在聊天中输入它们（例如把 `/ponytail-review` 作为一条消息发送），而不是从斜杠菜单中选择。在迁移完成前（约为 2026 年 6 月 18 日），`gemini extensions install` 也仍然有效。如果想把它作为常驻规则运行，请把规则集放进 `.agents/rules/`。

### Hermes Agent

```bash
hermes plugins install DietrichGebert/ponytail --enable
```

安装后重启 Hermes。插件会在每次调用 LLM 前注入当前启用的 Ponytail 模式，把随附技能注册为 `ponytail:<skill>`，并添加 `/ponytail`、`/ponytail-review`、`/ponytail-audit`、`/ponytail-debt`、`/ponytail-gain` 和 `/ponytail-help`。在共享网关中，请通过 Hermes 的斜杠命令访问控制，把 `/ponytail` 限制给可信用户；运行时模式仅在当前进程中有效。

### CodeWhale

它会读取项目根目录中的 `AGENTS.md`，无需设置。把 [`AGENTS.md`](AGENTS.md) 复制到你的项目，或者从本仓库的检出版本运行 `codewhale`。就这么简单。

### Swival

先把集合暂存到技能库中，再添加所需的技能：

```bash
swival skills add --global https://github.com/DietrichGebert/ponytail  # 暂存到 ~/.config/swival/library
swival skills add ponytail                                             # 把该集合安装到当前项目
swival skills add --global ponytail                                    # 或在每个项目中启用
```

Swival 也会读取项目根目录中的 `AGENTS.md`，并把全局的 `~/.config/swival/AGENTS.md` 作为仅指令模式的后备方案。

在命令行中，用 `$` 前缀显式激活一项技能。例如：`$ponytail-review`。

### Devin CLI

```bash
devin plugins install DietrichGebert/ponytail
```

将 ponytail 安装为 Devin 插件；技能可通过 `/ponytail:ponytail`、`/ponytail:ponytail-review` 等命令使用。

### OpenClaw

```bash
clawhub install ponytail
```

从 ClawHub 把 ponytail 安装为 OpenClaw 技能；review、audit、debt、gain 和 help 技能的安装方式相同（分别运行 `clawhub install ponytail-review` 等命令）。OpenClaw 会在编码任务中应用它，也会将它公开为 `/ponytail` 命令。如果不使用 ClawHub，请把 [`.openclaw/skills/ponytail`](.openclaw/skills/) 复制到 `~/.openclaw/skills/`。

### Grok Build

```bash
grok plugin install DietrichGebert/ponytail --trust
```

启用插件（默认关闭）：输入 `/plugins`，打开 Plugins，然后在 `ponytail` 上按空格键；或者在 `~/.grok/config.toml` 中加入：

```toml
[plugins]
enabled = ["ponytail"]
```

新建会话（或重新加载插件）。技能将显示为 `/ponytail`、`/ponytail-review`、`/ponytail-audit`、`/ponytail-debt`、`/ponytail-gain`、`/ponytail-help`。使用 `grok inspect` 验证。Grok 可以根据 ponytail 的技能说明，在编码任务中自动调用它；需要明确激活时，请使用 `/ponytail`（或 `/ponytail lite`、`/ponytail full`、`/ponytail ultra`）。Grok 不使用生命周期钩子，因为其 SessionStart 输出无法注入指令。

即使没有插件，从检出版本运行时，`AGENTS.md` 仍可以仅指令模式工作。

就这些。他会感到骄傲。只是不会说出来。

ponytail 会在每个会话中启用，并提供少量命令（见[命令](#命令)）。如果代码库真的伤害过你，`/ponytail ultra` 正是为此而生。启动和切换模式时显示的文本会标明当前模式。

可以用环境变量 `PONYTAIL_DEFAULT_MODE`（`lite`/`full`/`ultra`/`off`），或 `~/.config/ponytail/config.json` 中的 `defaultMode` 字段（Windows 上为 `%APPDATA%\ponytail\config.json`），为所有新会话设置级别。默认为 `full`。

启用时，通过 Agent 工具生成的每个子 Agent 也会收到这套规则集。若只想限定到某些 Agent 类型（例如，不对只读搜索 Agent 启用），请把环境变量 `PONYTAIL_SUBAGENT_MATCHER` 设为一个正则表达式，用它匹配子 Agent 的 `agent_type`。它可匹配字符串中的任意位置，且不区分大小写：`explore|general` 匹配两者之一，`^general$` 为精确匹配，插件 Agent 类型的形式则类似 `plugin:name`。未设置时会注入所有子 Agent（默认行为）；正则表达式无效，或者平台未报告某个子 Agent 的类型时，也会回退为注入。

Cursor、Windsurf、Cline、GitHub Copilot Chat（VS Code、JetBrains 和 Visual Studio 的编辑器扩展，不是[安装](#安装)中介绍的独立 Copilot CLI）、Aider、Kiro、Zed、CodeWhale、Swival、Qoder：从本仓库复制对应的规则文件（[`.cursor/rules/`](.cursor/rules/)、[`.windsurf/rules/`](.windsurf/rules/)、[`.clinerules/`](.clinerules/)、[`.github/copilot-instructions.md`](.github/copilot-instructions.md)、[`AGENTS.md`](AGENTS.md)、[`.kiro/steering/`](.kiro/steering/)、[`.qoder/rules/`](.qoder/rules/)）。

Kiro：把 `.kiro/steering/ponytail.md` 复制到 `~/.kiro/steering/`（全局）或项目中的 `.kiro/steering/`。

GitHub Copilot CLI 后备方案（仅指令模式）：它会读取项目中的 `AGENTS.md` 和 `.github/copilot-instructions.md`；也可以把规则复制到 `~/.copilot/copilot-instructions.md`，让 ponytail 在所有项目中运行。这种方式会保留常驻指引，但不会添加插件的模式切换或钩子。

带有 Codex 扩展的 VS Code 会读取 `AGENTS.md`，而本仓库已经提供该文件，因此从仓库根目录运行时无需设置（`~/.codex/AGENTS.md` 可让 Codex 全局生效）。

JetBrains Junie 可以读取 `AGENTS.md`，但需要先在 Settings → Tools → Junie → Project Settings → Guidelines Path 中指向该文件（目前还不会自动读取）。本仓库已提供 `AGENTS.md`；`.junie/guidelines.md` 是 Junie 的旧版路径。

Amp（Sourcegraph）会从工作目录及其父目录一直读取 `AGENTS.md`，直到 `$HOME`；本仓库已经提供该文件，因此无需设置即可使用（`~/.config/amp/AGENTS.md` 可用于全局设置）。

Jules（Google）会读取仓库根目录中的 `AGENTS.md`；本仓库已经提供该文件，因此它无需设置便会加载规则集。

各文件与各 Agent 的对应关系见：[Agent 可移植性](docs/agent-portability.md)。

### 卸载

| 宿主 | 命令 |
|------|---------|
| Claude Code | `/plugin remove ponytail` |
| Codex | `codex plugin remove ponytail` |
| Devin CLI | `devin plugins remove ponytail` |
| Grok Build | `grok plugin uninstall ponytail` |
| Pi Agent | `pi uninstall ponytail` |
| Cursor / Windsurf / Cline / Qoder / 等 | 删除复制的规则文件 |

这些命令会删除插件自己的文件，但会留下少量由 ponytail 写在插件目录之外的状态：模式标志、`~/.config/ponytail/config.json`，以及（如果你接受了设置提示）`~/.claude/settings.json` 中的一项 `statusLine`。运行 `node scripts/uninstall.js` 也可清理这些内容。**请在执行上面的宿主卸载命令前运行它**——这个脚本本身就是插件文件，先卸载插件也会把脚本删掉（或者从本仓库的另一份克隆中运行）。只有当 statusLine 指向 ponytail 自己的脚本时，它才会删除该条目，因此你自行设置的状态栏不会受影响。

## 命令

| 命令 | 作用 |
|---------|--------------|
| `/ponytail [lite \| full \| ultra \| off]` | 设置强度或将其关闭。不带参数时报告当前级别。 |
| `/ponytail-review` | 检查当前差异中的过度设计，并交回一份删除清单。 |
| `/ponytail-audit` | 审计整个仓库中的过度设计，而不只是当前差异。 |
| `/ponytail-debt` | 把你用 `ponytail:` 延后的捷径收集成债务账本，免得“以后”变成“永远不做”。 |
| `/ponytail-gain` | 显示基准测试测得的效果记分牌（更少代码、更低成本、更快速度）。 |
| `/ponytail-help` | 上述命令的快速参考。 |

命令需要支持技能的宿主（Claude Code、Codex、Devin CLI、OpenCode、Gemini、pi、Swival、Hermes Agent、Qoder、Grok Build）。在 Codex 中，它们是技能，使用 `@` 调用（如 `@ponytail-review`）。仅指令模式的适配器（Cursor、Windsurf、Cline、Copilot、Kiro、Antigravity）会加载常驻规则集，但不提供这些命令。

## 开发

修改精简版规则文本时，请保持所有 Agent 副本同步：

```bash
node scripts/check-rule-copies.js
npm test
```

OpenClaw 技能包（`.openclaw/skills/`）由 `skills/` 生成；修改技能后，请重新运行 `node scripts/build-openclaw-skills.js`，否则测试套件会因内容过期而失败。若要把技能发布到 ClawHub，先运行一次 `clawhub login`，再运行 `node scripts/publish-openclaw-skills.js`（它会按 `package.json` 中的版本发布全部六项技能；传入 `--dry-run` 可先预览）。

正确性基准测试会启动 Python 来检查电子邮件和 CSV；它会先尝试 `python3`，再尝试 `python`。CSV 检查要求本机安装 `pandas`。

## 常见问题

**能和 [caveman](https://github.com/JuliusBrussee/caveman) 一起用吗？**
能，而且你应该这么做。Caveman 精简 Agent 说的话；ponytail 精简 Agent 造的东西。两者各管一半，互不重叠：caveman 对代码逐字节保持原样，ponytail 则不碰措辞。用精简的话，谈精简的代码。

**需要配置文件吗？**
不需要。可以选择用 `~/.config/ponytail/config.json` 或环境变量 `PONYTAIL_DEFAULT_MODE` 设置默认级别，但什么都不配置也能用。

**可我真的需要那个 120 行的缓存类呢？**
你不需要。非要坚持的话，他也会写。慢慢地。正确地。一边盯着你。

**能扩展吗？**
你没写的代码可以无限扩展。零 Bug，零 CVE，自古以来可用率 100%。

**为什么叫“ponytail”？**
你明明知道为什么。

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

[MIT](LICENSE)。够用的最短许可证。

## Star 历史

<a href="https://www.star-history.com/dietrichgebert/ponytail#history">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date" />
   <img alt="Star 历史图" src="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date" />
 </picture>
</a>
