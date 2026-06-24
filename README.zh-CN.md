<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.png">
    <img src="assets/logo.png" width="220" alt="Ponytail，懒得恰到好处的资深开发者">
  </picture>
</p>

<h1 align="center">Ponytail</h1>

<p align="center">
  <em>不说话。写一行。能跑。</em>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/DietrichGebert/ponytail?style=flat-square&color=111111&label=stars" alt="星标">
  <img src="https://img.shields.io/github/v/release/DietrichGebert/ponytail?style=flat-square&color=111111&label=release" alt="发行版">
  <img src="https://img.shields.io/npm/v/@dietrichgebert/ponytail?style=flat-square&color=111111&label=npm" alt="npm">
  <img src="https://img.shields.io/badge/works%20with-14%20agents-111111?style=flat-square" alt="支持 14 种智能体">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT 许可证">
</p>

<p align="center">
  <a href="https://trendshift.io/repositories/50668" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/trendshift/repositories/50668/daily" alt="DietrichGebert/ponytail | Trendshift" width="250" height="55"/></a>
  <a href="https://trendshift.io/repositories/50668" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/trendshift/repositories/50668/weekly" alt="DietrichGebert/ponytail | Trendshift" width="250" height="55"/></a>
</p>

<p align="center">
  <strong>代码少约 54%（最高 94%）&middot; 成本低约 20% &middot; 速度快约 27% &middot; 100% 安全</strong><br>
  <sub>在真实 Claude Code 会话中，让同一个智能体编辑真实开源仓库（FastAPI + React），分别启用和不启用此 skill 后测得。约 54% 是 12 个功能任务的平均值（Haiku 4.5，n=4）；智能体容易过度构建的场景（如日期选择器）可达 94%，而原本已足够精简的代码则几乎没有差异。ponytail 保留了所有安全保护；单纯要求“写一行代码”的提示词则会漏掉其中一项。（早期单次 benchmark 将 80–94% 写成统一数字；和公平的智能体基线相比，那是每项任务的上限，不是平均值。）<a href="benchmarks/results/2026-06-18-agentic.md">完整报告</a> &middot; <a href="benchmarks/">复现方法</a>。</sub>
</p>

<p align="center">
  <sub>社区译本。<a href="README.md">英文 README</a> 是基准且最新的版本。</sub>
</p>

---

你一定见过这种人：长马尾、椭圆眼镜，比版本控制系统还早进公司。你递给他五十行代码；他扫一眼，不说话，直接换成一行。

Ponytail 把他放进你的 AI 智能体里。

## 前后对比

你要一个日期选择器。智能体装上 flatpickr，写一个包装组件，加一份样式表，然后开始讨论时区。

有了 ponytail：

```html
<!-- ponytail: browser has one -->
<input type="date">
```

更多幸存案例见 [examples/](examples/)。

## 数据

最诚实的衡量方式，是让真实智能体做真实工作：让无头 Claude Code 会话编辑 [tiangolo 的 full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template)（一个真实的 FastAPI + React 仓库），按它留下的 `git diff` 评分。12 个功能任务，同一个智能体分别启用和不启用 skill，n=4，Haiku 4.5。

<p align="center">
  <img src="assets/benchmark-agentic.svg" width="860" alt="各方案相对无 skill 基线的代码行数、token、成本和耗时百分比（Haiku 4.5）。ponytail 在每项指标都最低（LOC 46%、token 78%、成本 80%、耗时 73%）；caveman 的 token、成本和耗时超过 100%；yagni-oneliner 的 LOC 为 67%。安全性为独立的对抗性层级：baseline、caveman 和 ponytail 均为 100%，yagni-oneliner 为 95%。">
</p>

| 相对无 skill 基线 | LOC | token | 成本 | 耗时 | 安全 |
|---|--:|--:|--:|--:|--:|
| **ponytail** | **-54%** | **-22%** | **-20%** | **-27%** | **100%** |
| caveman（简短表述对照组） | -20% | +7% | +3% | +2% | 100% |
| “YAGNI + 单行代码”提示词 | -33% | -14% | -21% | -30% | 95% |

ponytail 是唯一同时降低每项指标、并保持完整安全性的方案。降幅最大的地方，正是容易过度构建的场景：它会优先用原生 `<input>`，而不是组件，所以日期选择器从 404 行缩到 23 行，颜色选择器从 287 行缩到 23 行；对已经足够精简的代码，变化则接近零。完整方法、逐任务表格和限制说明见 [benchmarks/results/2026-06-18-agentic.md](benchmarks/results/2026-06-18-agentic.md)。

<details>
<summary><strong>较早的单次数据（独立生成）</strong></summary>

五个日常任务，三个模型，三个方案（无 skill、[caveman](https://github.com/JuliusBrussee/caveman)、ponytail），每项运行十次，报告中位数。一个提示词，一次回答，统计回答中的代码行数：

<p align="center">
  <img src="assets/benchmark-3model.svg" width="860" alt="Haiku、Sonnet 和 Opus 三个方案的代码行数中位数">
</p>

结果显示**代码减少 80–94%**。但正如 [#126](https://github.com/DietrichGebert/ponytail/issues/126) 合理指出的，无 skill 的基线模型会用说明和选项填充回答，因此其中一部分差距只是对话式基线造成的假象。上面的智能体数据才是修正后、站得住脚的版本。可通过 `npx promptfoo eval -c benchmarks/promptfooconfig.yaml` 复现单次运行。

</details>

**这条规则从来不是“token 越少越好”。** 它是：只写任务真正需要的东西，绝不砍掉验证、错误处理、安全性或无障碍支持。代码之所以变少，是因为只留下必要部分，不是为了炫技。对遵循这套阶梯的模型而言，更低的成本和延迟只是副产品；一个为逐级斟酌而消耗大量思考 token 的简洁推理模型反而可能更慢、更贵（GPT-5.5 就是如此）。

## 它怎么工作

写代码前，智能体会在第一个成立的层级停下：

```
1. 这东西有必要存在吗？       → 没必要：跳过（YAGNI）
2. 代码库里已经有了吗？        → 复用，别重写
3. 标准库能做吗？              → 用标准库
4. 原生平台功能能做吗？        → 用原生功能
5. 已安装的依赖能解决吗？      → 用已有依赖
6. 一行能搞定吗？              → 一行
7. 最后才是：写出能工作的最小实现
```

这套阶梯是在理解问题*之后*才运行，不是拿来替代理解：先读会被改到的代码，追完真实流程，再选层级。方案可以懒，阅读绝不能懒。

懒，不等于疏忽：信任边界的验证、防止数据丢失的处理、安全性和无障碍支持，绝不在删减之列。

## 安装

这是 ponytail 这辈子会要求你付出的最大努力：

Claude Code 和 Codex 插件会运行两个很小的 Node.js 生命周期钩子，因此 `node` 必须在你的 PATH 中（Nix/nvm 用户注意：它必须出现在非交互 shell 的 PATH 中）。如果不在，skills 仍然可用；只是原本始终启用的自动激活会保持安静，而不会每个提示词都报错。

### Claude Code

```
/plugin marketplace add DietrichGebert/ponytail
```
```
/plugin install ponytail@ponytail
```
（必须分两次发送提示词，安装才会成功）

桌面应用没有 `/plugin` 命令，请从 UI 安装：Customize、个人插件旁的 +、Create plugin and add marketplace、Add from repository，然后输入仓库 URL（感谢 @NiklasDHahn，#98）。

### Codex

```bash
codex plugin marketplace add DietrichGebert/ponytail
codex
```

打开 `/plugins`，选择 Ponytail marketplace 并安装 Ponytail。然后打开 `/hooks`，审核并信任它的两个生命周期钩子，再新开一个线程。

这一次安装同样覆盖 Codex 桌面应用：安装后重启应用，它就会识别该插件。

### GitHub Copilot CLI

```bash
copilot plugin marketplace add DietrichGebert/ponytail
copilot plugin install ponytail@ponytail
```

在交互式 Copilot CLI 会话中，可以使用等价的斜杠命令：

```
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

Copilot CLI 会给插件命令加上插件名命名空间。例如：

```text
/ponytail:ponytail ultra
/ponytail:ponytail-review
```

### Pi agent harness

```
pi install git:github.com/DietrichGebert/ponytail
```

### OpenCode

在 `opencode.json` 中加入：

```json
{ "plugin": ["@dietrichgebert/ponytail"] }
```

也可以直接从 checkout 运行（该插件会复用 `hooks/` 和 `skills/`）：

```json
{ "plugin": ["./.opencode/plugins/ponytail.mjs"] }
```

它会在每个回合注入当前强度的规则集，并加入 `/ponytail` 命令（见[命令](#命令)）。OpenCode 还会自动加载此仓库的 `AGENTS.md`，所以即使没有插件，规则仍然生效。插件额外提供 `lite/full/ultra/off` 强度等级。

`./` 路径以项目的 `opencode.json` 为基准解析。若要让多个项目共用同一个 checkout，请改为指向 `.mjs` 的绝对路径（它会相对自身位置查找 `hooks/` 和 `skills/`）。

### Gemini CLI

```bash
gemini extensions install https://github.com/DietrichGebert/ponytail
```

它会在每个会话中把规则集作为常驻上下文载入，并注册 `/ponytail` 命令；`skills/` 也会一并提供，在任务需要时启用。Gemini 适配器刻意不在根目录提供 `hooks/hooks.json`：Gemini 会自动加载该路径，而 Ponytail 的生命周期钩子使用的是 Claude/Codex 事件名称。

### Antigravity CLI

Google 正在把 Gemini CLI 改名为 Antigravity CLI（`agy` 二进制）；同一个扩展也可安装到那里：

```bash
agy plugin install https://github.com/DietrichGebert/ponytail
```

它复用仓库中的 `gemini-extension.json`。有一点不同：Antigravity 会把 `/ponytail` 命令变成 skills，所以不再从斜杠菜单中选择，而是直接在聊天中输入（例如把 `/ponytail-review` 当作消息发送）。在迁移完成前（约 2026 年 6 月 18 日），`gemini extensions install` 仍然可用。若想作为常驻规则运行，请把规则集放入 `.agents/rules/`。

### CodeWhale

它读取项目根目录的 `AGENTS.md`，完全无需配置。把 [`AGENTS.md`](AGENTS.md) 复制到你的项目，或直接在本仓库的 checkout 中运行 `codewhale`。就这么简单。

### Swival

先把集合暂存到你的库中，再添加需要的 skills：

```bash
swival skills add --global https://github.com/DietrichGebert/ponytail  # 暂存到 ~/.config/swival/library
swival skills add ponytail                                             # 将集合安装到此项目
swival skills add --global ponytail                                    # 或在所有项目中启用
```

Swival 同样会读取项目根目录的 `AGENTS.md` 和全局的 `~/.config/swival/AGENTS.md`，作为仅指令模式的后备方案。

在命令行中，用 `$` 前缀显式启用 skill。例如：`$ponytail-review`。

### OpenClaw

```bash
clawhub install ponytail
```

这会从 ClawHub 安装 ponytail 作为 OpenClaw skill；review、audit、debt、gain 和 help skills 也以同样方式安装（`clawhub install ponytail-review` 等）。OpenClaw 会在编程任务中应用它，也会将它作为 `/ponytail` 命令提供。没有 ClawHub 时，请把 [`.openclaw/skills/ponytail`](.openclaw/skills/) 复制到 `~/.openclaw/skills/`。

就这些。他会满意的，但不会说出来。

它会在每个会话中保持启用，并附带少量命令（见[命令](#命令)）。`/ponytail ultra` 留给代码库真正惹毛你的时候。启动和切换强度时会显示当前模式。

使用 `PONYTAIL_DEFAULT_MODE` 环境变量（`lite`/`full`/`ultra`/`off`），或 `~/.config/ponytail/config.json` 中的 `defaultMode` 字段（Windows 为 `%APPDATA%\ponytail\config.json`），设置每个新会话的强度。默认值为 `full`。

Cursor、Windsurf、Cline、GitHub Copilot（编辑器）、Aider、Kiro、Zed、CodeWhale、Swival：从本仓库复制对应的规则文件（[`.cursor/rules/`](.cursor/rules/)、[`.windsurf/rules/`](.windsurf/rules/)、[`.clinerules/`](.clinerules/)、[`.github/copilot-instructions.md`](.github/copilot-instructions.md)、[`AGENTS.md`](AGENTS.md)、[`.kiro/steering/`](.kiro/steering/)）。

Kiro：把 `.kiro/steering/ponytail.md` 复制到 `~/.kiro/steering/`（全局）或项目中的 `.kiro/steering/`。

GitHub Copilot CLI 后备方案（仅指令模式）：它会读取项目中的 `AGENTS.md` 和 `.github/copilot-instructions.md`；若想在所有项目中运行 ponytail，请复制规则到 `~/.copilot/copilot-instructions.md`。此方式保留常驻指导，但不会加入插件的强度切换或钩子。

带 Codex 扩展的 VS Code 会读取 `AGENTS.md`，本仓库已提供该文件，因此在仓库根目录无需设置即可运行（将其置于 `~/.codex/AGENTS.md` 则可全局生效）。

各智能体与文件的映射见：[智能体可移植性](docs/agent-portability.md)。

### 卸载

| 宿主 | 命令 |
|------|---------|
| Claude Code | `/plugin remove ponytail` |
| Codex | `codex plugin remove ponytail` |
| Pi agent | `pi uninstall ponytail` |
| Cursor / Windsurf / Cline / 等 | 删除已复制的规则文件 |

上述命令会删除插件自身的文件，但会保留 ponytail 写入插件目录外的少量状态：模式标记、`~/.config/ponytail/config.json`，以及（若你接受了设置提示）`~/.claude/settings.json` 中的 `statusLine` 条目。运行 `node scripts/uninstall.js` 可以一并清理。**必须在执行上述宿主删除命令之前运行它**——该脚本本身是插件文件，先删除插件就会把它一并删掉（或者从另一个仓库克隆中运行）。它只会删除指向 ponytail 自身脚本的 `statusLine` 条目，因此你自行设置的状态栏不会受影响。

## 命令

| 命令 | 用途 |
|---------|--------------|
| `/ponytail [lite \| full \| ultra \| off]` | 设置强度，或关闭它。没有参数时显示当前强度。 |
| `/ponytail-review` | 从过度工程的角度审查当前 diff，并给出可删除项。 |
| `/ponytail-audit` | 审计整个仓库是否过度工程，而不只看 diff。 |
| `/ponytail-debt` | 收集标为 `ponytail:`、留待以后处理的简化项，免得“以后”变成“永远不”。 |
| `/ponytail-gain` | 显示 benchmark 测得的影响记分板（更少代码、更低成本、更快速度）。 |
| `/ponytail-help` | 上述命令的快速参考。 |

命令需要支持 skills 的宿主（Claude Code、Codex、OpenCode、Gemini、pi、Swival）。在 Codex 中它们是 skills，用 `@` 调用（`@ponytail-review`）。仅指令适配器（Cursor、Windsurf、Cline、Copilot、Kiro、Antigravity）会加载常驻规则集，但没有这些命令。

## 开发

修改精简的规则文本时，保持各智能体副本同步：

```bash
node scripts/check-rule-copies.js
npm test
```

OpenClaw skill 包（`.openclaw/skills/`）由 `skills/` 生成。修改 skill 后，请重新运行 `node scripts/build-openclaw-skills.js`；如果生成内容过期，测试套件会失败。要将 skills 发布到 ClawHub，请先运行一次 `clawhub login`，再运行 `node scripts/publish-openclaw-skills.js`（它会按 `package.json` 中的版本发布全部六个；传入 `--dry-run` 可预览）。

correctness benchmark 会启动 Python 进行电子邮件和 CSV 检查；它会先尝试 `python3`，再尝试 `python`。CSV 检查要求本地安装 `pandas`。

## 常见问题

**需要配置文件吗？**
不需要。可以用可选的 `~/.config/ponytail/config.json` 或 `PONYTAIL_DEFAULT_MODE` 环境变量设置默认强度，但都不是必需的。

**如果我真的需要那个 120 行的缓存类呢？**
你不需要。非要坚持的话，他也会写。慢慢地，正确地，同时盯着你。

**它能扩展吗？**
你从未写下的代码可以无限扩展。零 bug，零 CVE，从此以后 100% 正常运行。

**为什么叫“ponytail”？**
你很清楚原因。

## 许可证

[MIT](LICENSE)。能用的最短许可证。

## Star 历史

<a href="https://www.star-history.com/dietrichgebert/ponytail#history">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date" />
   <img alt="Star 历史图表" src="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date" />
 </picture>
</a>
