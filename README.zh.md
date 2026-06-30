<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.png">
    <img src="assets/logo.png" width="220" alt="Ponytail, 那个懒散的老程序员">
  </picture>
</p>

<h1 align="center">Ponytail</h1>

<p align="center">
  <em>他不说话。他写一行代码。能跑。</em>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/DietrichGebert/Ponytail?style=flat-square&color=111111&label=stars" alt="Stars">
  <img src="https://img.shields.io/github/v/release/DietrichGebert/Ponytail?style=flat-square&color=111111&label=release" alt="Release">
  <img src="https://img.shields.io/npm/v/@dietrichgebert/Ponytail?style=flat-square&color=111111&label=npm" alt="npm">
  <img src="https://img.shields.io/badge/works%20with-16%20agents-111111?style=flat-square" alt="Works with 16 agents">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT license">
</p>

<p align="center">
  <a href="https://trendshift.io/repositories/50668" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/trendshift/repositories/50668/daily" alt="DietrichGebert/Ponytail | Trendshift" width="250" height="55"/></a>
  <a href="https://trendshift.io/repositories/50668" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/trendshift/repositories/50668/weekly" alt="DietrichGebert/Ponytail | Trendshift" width="250" height="55"/></a>
</p>

<p align="center">
  <strong>~54% 更少代码（最高达 94%）&middot; ~20% 更便宜 &middot; ~27% 更快 &middot; 100% 安全</strong><br>
  <sub>在真实的 Claude Code 会话中测量，编辑一个真实的开源仓库（FastAPI + React），与同一 agent 不使用 skill 对比。“~54%” 是 12 个 feature 任务的均值（Haiku 4.5, n=4）；在 agent 过度构建的场景下可达 94%（如日期选择器），在代码已经极简时接近于零。Ponytail 保留了所有安全防护，而普通的"只写一行" prompt 则不够安全。（早期的单次跑分报告了 80-94% 的单一数字；相对于合理的 agent  baseline，那其实是每个任务的上限，而非平均值。）<a href="benchmarks/results/2026-06-18-agentic.md">完整报告</a> &middot; <a href="benchmarks/">复现它</a>。</sub>
</p>

---

你认识他。长马尾辫。椭圆形眼镜。在公司呆得比版本控制系统还久。你给他看五十行代码；他看了看，什么也不说，然后换成了一行。

Ponytail 把他放进了你的 AI agent 里。

## Before / after

你要写一个日期选择器。你的 agent 安装了 flatpickr，写了一个包装组件，加了一个样式表格，然后开始讨论时区问题。

有了 Ponytail：

```html
<!-- Ponytail: browser has one -->
<input type="date">
```

更多案例见 [examples/](examples/)。

## Numbers

诚实的测量方式是让一个真实的 agent 做真实的工作：一个非交互式 Claude Code 会话编辑 [tiangolo 的 full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template)（一个真实的 FastAPI + React repo），用 `git diff` 留下的内容作为评分依据。12 个 feature 工单，同一个 agent 分别带和不带 skill，n=4，Haiku 4.5。

<p align="center">
  <img src="assets/benchmark-agentic.svg" width="860" alt="与无 skill baseline 相比，各对照组在 LOC、token、成本和时间上的百分比 (Haiku 4.5)。Ponytail 在所有指标上最低 (LOC 46%, tokens 78%, cost 80%, time 73%); caveman 在 token、成本和时间上超过 100%; yagni-oneliner LOC 67%。安全性为独立的对抗性层级: baseline、caveman 和 Ponytail 100%, yagni-oneliner 95%。">
</p>

| vs no-skill baseline | LOC | tokens | cost | time | safe |
|---|--:|--:|--:|--:|--:|
| **Ponytail** | **-54%** | **-22%** | **-20%** | **-27%** | **100%** |
| caveman (terse-prose control) | -20% | +7% | +3% | +2% | 100% |
| "YAGNI + one-liners" prompt | -33% | -14% | -21% | -30% | 95% |

Ponytail 是唯一在所有指标上都有削减的对照组，也是唯一在削减代码的同时保持完全安全的对照组。削减幅度最大的地方是真正存在过度构建陷阱的场景（日期选择器从 404 行减到 23 行，颜色选择器从 287 行减到 23 行，因为它用的是原生的 `<input>` 而不是一个组件），在代码已经极简的地方则接近零。完整方法、每个任务的表格和限制见：[benchmarks/results/2026-06-18-agentic.md](benchmarks/results/2026-06-18-agentic.md)。

<details>
<summary><strong>旧的单次数据（孤立生成）</strong></summary>

5 个日常任务，3 个模型，3 个对照组（无 skill、[caveman](https://github.com/JuliusBrussee/caveman)、Ponytail），10 次运行，报告中位数。1 个 prompt，1 次 completion，统计回答的行数：

<p align="center">
  <img src="assets/benchmark-3model.svg" width="860" alt="Haiku、Sonnet 和 Opus 各对照组的中位数代码行数">
</p>

这显示了 **80-94% 更少的代码**。[#126](https://github.com/DietrichGebert/Ponytail/issues/126) 公正地指出，纯模型的 baseline 用散文和选项填充了回答，所以这个 diff 部分是由对话 baseline 产生的人为产物。上述 agent 数据是修正后可辩护的版本。用 `npx promptfoo eval -c benchmarks/promptfooconfig.yaml` 复现单次运行。

</details>

**规则从来不是"最少的 token"**。 规则是：只写任务需要的东西，永远不妨碍校验、错误处理，不降低安全性或可读性。代码之所以少，是因为它是必要的，而不是为了代码压缩竞赛。更低的成本和延迟是遵循这个分级的模型产生的副作用；一个简洁的 reasoning 模型如果花费 thinking token 来斟酌每一级阶梯，结果可能会相反（在 GPT-5.5 上确实如此）。

## 它如何工作

在写代码之前，agent 会停在第一个满足的阶梯上：

```
1. 这个东西需要存在吗？         → 不需要：跳过它（YAGNI）
2. 代码库里已经有了？          → 复用它，不要重写
3. Stdlib 能搞定？             → 用它
4. 原生平台特性能搞定？         → 用它
5. 已安装的依赖能搞定？         → 用它
6. 一行能搞定？                → 就一行
7. 到这才：写最少能跑的代码
```

这个阶梯在它理解了问题*之后*运行，而不是代替理解：在选择使用哪一级阶梯之前，它会阅读变更所涉及的代码并追踪真实的执行流。对解决方案懒，对阅读从不懒。

懒，但不疏忽：信任边界校验、数据丢失处理、安全和可读性永远不在砍掉的选项之列。

## 安装

Ponytail 对你提出的最大要求：

Claude Code 和 Codex 的插件会运行两个很小的 Node.js lifecycle hook，所以 `node` 需要在你的 PATH 上（注意 Nix/nvm 用户：它必须在非交互命令行的 PATH 上）。如果不在，skills 仍然可以工作，只是常驻激活会保持安静，而不会在每次 prompt 时报错。

### Claude Code

```
/plugin marketplace add DietrichGebert/Ponytail
```
```
/plugin install Ponytail@Ponytail
```
（你需要发送两条独立的 prompt 安装才能生效）

桌面应用没有 `/plugin` 命令。改为从 UI 安装：Customize，personal plugins 旁边的 + 号，Create plugin and add marketplace，Add from repository，然后输入 repo URL（感谢 @NiklasDHahn, #98）。

### Codex

```bash
codex plugin marketplace add DietrichGebert/Ponytail
codex
```

打开 `/plugins`，选择 Ponytail marketplace，然后安装 Ponytail。接着打开 `/hooks`，审查并信任它的两个 lifecycle hook，然后开始一个新的 thread。

同样的安装方式也适用于 Codex 桌面应用：安装后重启应用即可生效。

### GitHub Copilot CLI

```bash
copilot plugin marketplace add DietrichGebert/Ponytail
copilot plugin install Ponytail@Ponytail
```

在交互式 Copilot CLI 会话中，使用对应的斜杠命令：

```
/plugin marketplace add DietrichGebert/Ponytail
/plugin install Ponytail@Ponytail
```

Copilot CLI 按插件名称命名空间来组织插件命令。例如：

```text
/Ponytail:Ponytail ultra
/Ponytail:Ponytail-review
```

### Pi agent harness

```
pi install git:github.com/DietrichGebert/Ponytail
```

### OpenCode

添加到 `opencode.json`：

```json
{ "plugin": ["@dietrichgebert/Ponytail"] }
```

也可以从本地 checkout 运行（插件会复用 `hooks/` 和 `skills/`）：

```json
{ "plugin": ["./.opencode/plugins/Ponytail.mjs"] }
```

每轮注入当前级别的规则集；添加 `/Ponytail` 命令（参见 [Commands](#commands)）。OpenCode 也会自动加载这个仓库的 `AGENTS.md`，所以即使没有 plugin，规则也会生效。plugin 添加了 `lite/full/ultra/off` 等级别。

`./` 路径相对于你项目的 `opencode.json` 解析；要在多个项目间共享同一个 checkout，请使用 `.mjs` 的绝对路径（它会相对于自身文件找到 `hooks/` 和 `skills/`）。

### Gemini CLI

```bash
gemini extensions install https://github.com/DietrichGebert/Ponytail
```

每个会话将规则集作为常驻上下文加载，并注册 `/Ponytail` 命令；`skills/` 也会随附，在 task 需要时激活。Gemini adapter 有意不附带根目录的 `hooks/hooks.json`：Gemini 会自动加载那个路径，而 Ponytail 的 lifecycle hooks 使用 Claude/Codex 的事件名称。

### Antigravity CLI

Google 正在将 Gemini CLI 更名为 Antigravity CLI（`agy` 二进制）；相同的扩展也可以安装在上面：

```bash
agy plugin install https://github.com/DietrichGebert/Ponytail
```

它复用了这个仓库的 `gemini-extension.json`。一个区别是：Antigravity 将 `/Ponytail` 命令转换为 skills，所以你要在聊天中直接输入（例如将 `/Ponytail-review` 作为消息发送），而不是从斜杠菜单中选择。在迁移完成之前（大约 2026 年 6 月 18 日），`gemini extensions install` 仍然可用。如果要改为作为常驻规则运行，将规则集放入 `.agents/rules/` 即可。

### Hermes Agent

```bash
hermes plugins install DietrichGebert/Ponytail --enable
```

安装后重启 Hermes。插件会在每次 LLM 更改之前注入当前的 Ponytail 模式，将捆绑的 skills 注册为 `Ponytail:<skill>`，并添加 `/Ponytail`、`/Ponytail-review`、`/Ponytail-audit`、`/Ponytail-debt`、`/Ponytail-gain` 和 `/Ponytail-help`。在共享 gateway 中，使用 Hermes 的斜杠命令访问控制将 `/Ponytail` 限制为受信任用户；运行时模式是进程级别的。

### CodeWhale

从项目根目录读取 `AGENTS.md`，零配置。将 [`AGENTS.md`](AGENTS.md) 复制到你的项目中，或者从这个仓库的 checkout 中运行 `codewhale`。就这样。

### Swival

先在 library 中暂存 collection，然后添加你想要的 skills：

```bash
swival skills add --global https://github.com/DietrichGebert/Ponytail  # stage into ~/.config/swival/library
swival skills add Ponytail                                             # install the collection into this project
swival skills add --global Ponytail                                    # or activate it in every project
```

Swival 也会从项目根目录全局读取 `AGENTS.md`，以及位于 `~/.config/swival/AGENTS.md` 的全局指令回退方案。

在命令行中，使用 `$` 前缀显式激活 skill。例如：`$Ponytail-review`。

### Devin CLI

```bash
devin plugins install DietrichGebert/Ponytail
```

将 Ponytail 作为 Devin 插件安装；skills 可以通过 `/Ponytail:Ponytail`、`/Ponytail:Ponytail-review` 等方式使用。

### OpenClaw

```bash
clawhub install Ponytail
```

从 ClawHub 安装 Ponytail 作为 OpenClaw skill；review、audit、debt、gain 和 help skills 以同样的方式安装（`clawhub install Ponytail-review`，以此类推）。OpenClaw 会在 coding tasks 中应用它，同时将其暴露为 `/Ponytail` 命令。如果没有 ClawHub，将 [`.openclaw/skills/Ponytail`](.openclaw/skills/) 复制到 `~/.openclaw/skills/`。

就这样。他会很自豪。他不会说出来。

每个会话都激活，附带少量命令（参见 [Commands](#commands)）。`/Ponytail ultra` 的存在是为了在代码库深深冒犯到你的时候使用。启动和 mode-change 文本会显示当前的 mode。

通过 `Ponytail_DEFAULT_MODE` 环境变量（`lite`/`full`/`ultra`/`off`）或 `~/.config/Ponytail/config.json`（Windows 上为 `%APPDATA%\Ponytail\config.json`）中的 `defaultMode` 字段，为每个新会话设置级别。默认为 `full`。

Cursor、Windsurf、Cline、GitHub Copilot (editor)、Aider、Kiro、Zed、CodeWhale、Swival：从这个仓库复制对应的 rules 文件（[`.cursor/rules/`](.cursor/rules/)、[`.windsurf/rules/`](.windsurf/rules/)、[`.clinerules/`](.clinerules/)、[`.github/copilot-instructions.md`](.github/copilot-instructions.md)、[`AGENTS.md`](AGENTS.md)、[`.kiro/steering/`](.kiro/steering/)）。

Kiro：将 `.kiro/steering/Ponytail.md` 复制到 `~/.kiro/steering/`（全局）或项目中的 `.kiro/steering/`。

GitHub Copilot CLI 回退方案（仅指令模式）：它会读取项目中的 `AGENTS.md` 和 `.github/copilot-instructions.md`，或者将 rules 复制到 `~/.copilot/copilot-instructions.md` 以在每个项目中运行 Ponytail。这种方式保持常驻向导，但不会添加插件模式切换或 hook。

安装了 Codex 扩展的 VS Code 会读取 `AGENTS.md`（这个仓库自带），所以从仓库根目录即可使用，无需任何设置（`~/.codex/AGENTS.md` 可以让 Codex 全局生效）。

哪些文件对应哪些 agent：[Agent portability](docs/agent-portability.md)。

### 卸载

| Host | Command |
|------|---------|
| Claude Code | `/plugin remove Ponytail` |
| Codex | `codex plugin remove Ponytail` |
| Devin CLI | `devin plugins remove Ponytail` |
| Pi agent | `pi uninstall Ponytail` |
| Cursor / Windsurf / Cline / etc. | Delete the copied rule file |

以上命令会删除插件自身的文件。它们会留下少量 Ponytail 写在插件文件夹之外的状态：mode flag、`~/.config/Ponytail/config.json`，以及（如果你接受了设置提示）`~/.claude/settings.json` 中的 `statusLine` 条目。运行 `node scripts/uninstall.js` 来也清理掉这些。**在运行上述 host remove 命令之前运行它**——该脚本本身是一个插件文件，所以如果先删除了 plugin，脚本也会被删除（或者从该仓库的另一个 clone 中运行）。它只会在 statusLine 条目指向 Ponytail 自己的脚本时才删除它，因此你自己设置的 statusline 不会被触及。

## 命令

| 命令 | 作用 |
|---------|--------------|
| `/Ponytail [lite \| full \| ultra \| off]` | 设置强度，或关闭它。不带参数时报告当前级别。 |
| `/Ponytail-review` | Review 当前的 diff 是否存在 over-engineering，返回一个删除列表。 |
| `/Ponytail-audit` | Audit 整个仓库是否存在 over-engineering，而不仅仅是 diff。 |
| `/Ponytail-debt` | 将你推迟的 `Ponytail:` 快捷方式收集到一份清单中，让"以后"不会变成"永远不"。 |
| `/Ponytail-gain` | 从 benchmark 中展示已测量的影响记分牌（更少的代码、更低的成本、更高的速度）。 |
| `/Ponytail-help` | 上述命令的快速参考。 |

命令需要一个支持 skill 的 host（Claude Code、Codex、Devin CLI、OpenCode、Gemini、pi、Swival、Hermes Agent）。在 Codex 中它们是 skills，使用 `@` 调用（`@Ponytail-review`）。仅指令模式的 adapter（Cursor、Windsurf、Cline、Copilot、Kiro、Antigravity）加载常驻规则集，但不包含命令。

## 开发

在修改精简的规则文本时，保持各 agent 副本同步：

```bash
node scripts/check-rule-copies.js
npm test
```

OpenClaw skill 包（`.openclaw/skills/`）由 `skills/` 生成；修改 skill 后重新运行 `node scripts/build-openclaw-skills.js`，如果过期则测试套件会失败。要将 skills 发布到 ClawHub，先运行 `clawhub login`，然后运行 `node scripts/publish-openclaw-skills.js`（它会在 `package.json` 的版本下发布全部六个 skill；传入 `--dry-run` 可以预览）。

正确性基准测试会启动 Python 进行电子邮件和 CSV 检查；优先尝试 `python3`，然后才是 `python`。CSV 检查需要本地安装 `pandas`。

## FAQ

**它需要配置文件吗？**
不需要。可选的 `~/.config/Ponytail/config.json` 或 `Ponytail_DEFAULT_MODE` 环境变量可以设置默认级别，但没有任何必需项。

**如果我真的很需要那个 120 行的缓存类呢？**
你不需要。坚持要的话，他还是会写。一边慢吞吞地、正确地写，一边看着你。

**它会变大吗？**
你从来没写过的代码当然可以无限扩展。不会有 bug、零 CVE、从始至终 100% uptime。

**为什么叫"Ponytail"？**
你完全知道为什么。

## 赞助者

<p align="center">
  <a href="https://greenpt.com/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="assets/logo-greenpt-dark.svg">
      <img src="assets/logo-greenpt.svg" width="260" alt="GreenPT">
    </picture>
  </a>
</p>

## 开源协议

[MIT](LICENSE)。最短的能用的协议。

## 项目 Star History

<a href="https://www.star-history.com/dietrichgebert/Ponytail#history">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/Ponytail&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/Ponytail&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=DietrichGebert/Ponytail&type=Date" />
 </picture>
</a>