<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.png">
    <img src="assets/logo.png" width="220" alt="Ponytail, the lazy senior dev">
  </picture>
</p>

<h1 align="center">Ponytail</h1>

<p align="center">
  <em>他一声不吭。写一行。能用。</em>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/DietrichGebert/ponytail?style=flat-square&color=111111&label=stars" alt="Stars">
  <img src="https://img.shields.io/github/v/release/DietrichGebert/ponytail?style=flat-square&color=111111&label=release" alt="Release">
  <img src="https://img.shields.io/npm/v/@dietrichgebert/ponytail?style=flat-square&color=111111&label=npm" alt="npm">
  <img src="https://img.shields.io/badge/works%20with-16%20agents-111111?style=flat-square" alt="Works with 16 agents">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT license">
</p>

<p align="center">
  <a href="https://trendshift.io/repositories/50668" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/trendshift/repositories/50668/daily" alt="DietrichGebert/ponytail | Trendshift" width="250" height="55"/></a>
  <a href="https://trendshift.io/repositories/50668" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/trendshift/repositories/50668/weekly" alt="DietrichGebert/ponytail | Trendshift" width="250" height="55"/></a>
</p>

<p align="center">
  <strong>代码少约 54%（最高 94%）&middot; 成本低约 20% &middot; 速度快约 27% &middot; 100% 安全</strong><br>
  <sub>在真实的 Claude Code 会话中、对真实的开源仓库（FastAPI + React）做改动测得，对照组是同一个 agent 关掉 skill。约 54% 是 12 个功能任务的平均值（Haiku 4.5，n=4）；在 agent 容易过度构建的地方（日期选择器）能到 94%，在代码本身已足够精简的地方则接近 0。ponytail 保留了全部安全护栏，而一句光秃秃的"写一行就完事"的 prompt 会丢掉其中一个。（更早的单次基准把 80–94% 当作统一数字报出；放到公平的 agent 基线下，那是每个任务的上限，不是平均值。）<a href="benchmarks/results/2026-06-18-agentic.md">完整报告</a> &middot; <a href="benchmarks/">复现方法</a>。</sub>
</p>

<p align="center">
  <sub>社区翻译，参考版本以最新的 <a href="README.md">英文 README</a> 为准。&middot; <a href="README.es.md">Español</a> &middot; <a href="README.ko.md">한국어</a></sub>
</p>

---

<p align="center">
  <a href="https://ponytail.dev/soon"><img src="assets/waitlist-banner.png" alt="有新东西要来了，加入等候列表" width="760"></a>
</p>

你认识他。长马尾辫。椭圆眼镜。在公司待得比版本控制还久。你递过去五十行代码，他瞥一眼，一声不吭，换成一行。

Ponytail 把他放进你的 AI agent 里。

## 改动前 / 改动后

你让 agent 做一个日期选择器。它装上 flatpickr，写个 wrapper 组件，加个样式表，然后开始跟你讨论时区。

用 ponytail：

```html
<!-- ponytail: browser has one -->
<input type="date">
```

更多幸存案例见 [examples/](examples/)。

## 数字

诚实的测法是让真正的 agent 干真正的活：一个无头 Claude Code 会话编辑 [tiangolo 的 full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template)（真实的 FastAPI + React 仓库），按它留下的 `git diff` 打分。十二个功能 ticket，同一个 agent 开/关 skill 对比，n=4，Haiku 4.5。

<p align="center">
  <img src="assets/benchmark-agentic.svg" width="860" alt="Each arm as a percent of the no-skill baseline across LOC, tokens, cost and time (Haiku 4.5). ponytail is lowest on every metric (LOC 46%, tokens 78%, cost 80%, time 73%); caveman rises above 100% on tokens, cost and time; yagni-oneliner LOC 67%. Safety, separate adversarial tier: baseline, caveman and ponytail 100%, yagni-oneliner 95%.">
</p>

| 对照无 skill 基线 | LOC | tokens | 成本 | 时间 | 安全 |
|---|--:|--:|--:|--:|--:|
| **ponytail** | **-54%** | **-22%** | **-20%** | **-27%** | **100%** |
| caveman（简短散文对照组） | -20% | +7% | +3% | +2% | 100% |
| "YAGNI + one-liners" prompt | -33% | -14% | -21% | -30% | 95% |

ponytail 是唯一在每一项指标上都做到削减的对照组，也是唯一在削减的同时保持完全安全的一个。削减幅度最大的地方正是真的存在过度构建陷阱的地方（日期选择器从 404 行到 23 行，颜色选择器从 287 行到 23 行，因为手伸向了原生 `<input>` 而非组件），在代码本身已经精简的地方则接近 0。完整方法、逐任务表格和局限：[benchmarks/results/2026-06-18-agentic.md](benchmarks/results/2026-06-18-agentic.md)。

<details>
<summary><strong>更早的单次数值（隔离生成）</strong></summary>

五项日常任务、三个模型、三个对照组（无 skill、[caveman](https://github.com/JuliusBrussee/caveman)、ponytail），跑十次，取中位数。一次 prompt、一次补全，数答案的行数：

<p align="center">
  <img src="assets/benchmark-3model.svg" width="860" alt="Median lines of code per arm across Haiku, Sonnet and Opus">
</p>

那次显示**代码少 80–94%**。[#126](https://github.com/DietrichGebert/ponytail/issues/126) 公允地指出，光秃秃的模型基线会用散文和选项把答案撑长，所以这个差距有一部分是对话型基线造成的假象。上面的 agent 数值是修正后站得住脚的版本。单次复现可跑 `npx promptfoo eval -c benchmarks/promptfooconfig.yaml`。

</details>

**规则从来不是"最少 token"。** 规则是：任务需要多少就写多少，绝不动验证、错误处理、安全和无障碍。代码之所以小，是因为它必要，不是被压码压出来的。更低的成本和延迟是模型老老实实走完阶梯的副产品；一个把思考 token 花在反复掂量每一级阶梯上的简短推理模型反而会反着来（GPT-5.5 就是）。

## 工作原理

写代码之前，agent 会在第一个撑得住的阶梯停下：

```
1. 这东西需要存在吗？        → 不需要：跳过 (YAGNI)
2. 当前代码库已经有了？      → 复用，别重写
3. 标准库能做？              → 用它
4. 平台原生功能能做？        → 用它
5. 已安装的依赖能做？        → 用它
6. 一行能搞定？              → 一行
7. 那才写：能跑起来的最少代码
```

阶梯是在*理解问题之后*走的，不是用来代替理解：它会先读改动会触及的代码、追一遍真实流程，然后才选阶梯。对解法懒，对读代码绝不懒。

懒，不是疏忽：信任边界处的校验、防数据丢失的处理、安全和无障碍，绝不会上断头台。

## 安装

ponytail 能向你索要的最大代价：

Claude Code 和 Codex 插件跑两个极小的 Node.js 生命周期 hook，所以 `node` 必须在 PATH 上（Nix/nvm 用户注意：必须是非交互 shell 的 PATH）。即使不在，skill 照样能跑，只是 always-on 激活会安静地保持关闭，而不是每个 prompt 都报错。

### Claude Code

```
/plugin marketplace add DietrichGebert/ponytail
```
```
/plugin install ponytail@ponytail
```
（必须分两次 prompt 发送，安装才能生效）

桌面版没有 `/plugin` 命令，从 UI 装即可：Customize → 个人插件旁边的 + → Create plugin and add marketplace → Add from repository，输入仓库 URL（谢谢 @NiklasDHahn，#98）。

### CodeBuddy

```bash
codebuddy plugin marketplace add DietrichGebert/ponytail
codebuddy plugin install ponytail@ponytail
```

复用 Claude Code 的 hook（`hooks/claude-codex-hooks.json`），所以生命周期激活、模式跟踪、命令和状态栏行为完全一致。

### Codex

```bash
codex plugin marketplace add DietrichGebert/ponytail
codex
```

打开 `/plugins`，选 Ponytail marketplace，安装 Ponytail。然后打开 `/hooks`，审查并信任它的两个生命周期 hook，开新线程。

同一次安装也覆盖 Codex 桌面版：装完重启 app 即可识别插件。

### GitHub Copilot CLI

```bash
copilot plugin marketplace add DietrichGebert/ponytail
copilot plugin install ponytail@ponytail
```

在交互式 Copilot CLI 会话里，用斜杠等价命令：

```
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

Copilot CLI 会用插件名作为命名空间前缀。例如：

```text
/ponytail:ponytail ultra
/ponytail:ponytail-review
```

### Pi agent harness

```
pi install git:github.com/DietrichGebert/ponytail
```

### OpenCode

加到 `opencode.json`：

```json
{ "plugin": ["@dietrichgebert/ponytail"] }
```

也可以从 checkout 直接跑（插件复用 `hooks/` 和 `skills/`）：

```json
{ "plugin": ["./.opencode/plugins/ponytail.mjs"] }
```

每个 turn 按当前级别注入规则集，并加挂 `/ponytail` 命令（见 [Commands](#commands)）。OpenCode 还会自动加载本仓库的 `AGENTS.md`，所以即使没有插件规则也成立。插件额外提供 `lite/full/ultra/off` 级别。

`./` 路径相对项目的 `opencode.json` 解析；要让多个项目共用一个 checkout，指向 `.mjs` 的绝对路径即可（它会按自身文件位置去寻找 `hooks/` 和 `skills/`）。

### Gemini CLI

```bash
gemini extensions install https://github.com/DietrichGebert/ponytail
```

每次会话把规则集作为常驻上下文加载，并注册 `/ponytail` 命令；`skills/` 也一并打包，需要时激活。
Gemini 适配器故意不提供根 `hooks/hooks.json`：Gemini 会自动加载该路径，而 ponytail 的生命周期 hook 用的是 Claude/Codex 的事件名。

### Antigravity CLI

Google 正把 Gemini CLI 改名成 Antigravity CLI（`agy` 二进制），同一个扩展在那里也能装：

```bash
agy plugin install https://github.com/DietrichGebert/ponytail
```

它复用本仓库的 `gemini-extension.json`。区别在于：Antigravity 把 `/ponytail` 命令转成 skill，所以是直接在聊天里输入（比如把 `/ponytail-review` 当作消息），而不是从斜杠菜单里挑。迁移完成前（约 2026 年 6 月 18 日），`gemini extensions install` 仍然有效。要当常驻规则跑，把规则集放进 `.agents/rules/`。

### Hermes Agent

```bash
hermes plugins install DietrichGebert/ponytail --enable
```

安装后重启 Hermes。插件在每次 LLM turn 之前注入当前 Ponytail 模式，把打包的 skill 注册为 `ponytail:<skill>`，并加挂 `/ponytail`、`/ponytail-review`、`/ponytail-audit`、`/ponytail-debt`、`/ponytail-gain`、`/ponytail-help`。在共享网关里，用 Hermes 的 slash 命令访问控制把 `/ponytail` 限定给可信用户；运行时模式是进程本地的。

### CodeWhale

从项目根读 `AGENTS.md`，零配置。把 [`AGENTS.md`](AGENTS.md) 复制到你的项目，或者在本仓库的 checkout 里跑 `codewhale`。就这样。

### Swival

先把集合 stage 到库，再按需加 skill：

```bash
swival skills add --global https://github.com/DietrichGebert/ponytail  # stage 到 ~/.config/swival/library
swival skills add ponytail                                             # 装进当前项目
swival skills add --global ponytail                                    # 或在所有项目里启用
```

Swival 也会读项目根的 `AGENTS.md` 和全局的 `~/.config/swival/AGENTS.md`，这是纯指令兜底。

命令行里用 `$` 前缀显式激活 skill，例如：`$ponytail-review`。

### Devin CLI

```bash
devin plugins install DietrichGebert/ponytail
```

把 ponytail 装成 Devin 插件；skill 以 `/ponytail:ponytail`、`/ponytail:ponytail-review` 等方式提供。

### OpenClaw

```bash
clawhub install ponytail
```

从 ClawHub 把 ponytail 装成 OpenClaw skill；review、audit、debt、gain、help skill 同样装法（`clawhub install ponytail-review` 等）。OpenClaw 在编码任务里应用它，也以 `/ponytail` 命令暴露。没有 ClawHub 的话，把 [`.openclaw/skills/ponytail`](.openclaw/skills/) 复制到 `~/.openclaw/skills/`。

就这些。他会满意的。但他不会说出来。

每次会话常驻，附带几个命令（见 [Commands](#commands)）。`/ponytail ultra` 留给那种代码库把你得罪透了的时刻。启动和切换模式时会显示当前模式。

每个新会话的级别用 `PONYTAIL_DEFAULT_MODE` 环境变量（`lite`/`full`/`ultra`/`off`）设，或者 `~/.config/ponytail/config.json` 的 `defaultMode` 字段（Windows 上是 `%APPDATA%\ponytail\config.json`）。默认 `full`。

Cursor、Windsurf、Cline、GitHub Copilot（编辑器）、Aider、Kiro、Zed、CodeWhale、Swival：从本仓库复制对应的规则文件（[`.cursor/rules/`](.cursor/rules/)、[`.windsurf/rules/`](.windsurf/rules/)、[`.clinerules/`](.clinerules/)、[`.github/copilot-instructions.md`](.github/copilot-instructions.md)、[`AGENTS.md`](AGENTS.md)、[`.kiro/steering/`](.kiro/steering/)）。

Kiro：把 `.kiro/steering/ponytail.md` 复制到 `~/.kiro/steering/`（全局）或项目里的 `.kiro/steering/`。

GitHub Copilot CLI 兜底（纯指令模式）：它读取项目里的 `AGENTS.md` 和 `.github/copilot-instructions.md`，或者把规则复制到 `~/.copilot/copilot-instructions.md` 在每个项目里跑 ponytail。这条路径保留常驻指引，但不会加插件模式切换和 hook。

带 Codex 扩展的 VS Code 会读 `AGENTS.md`，本仓库已附带，所以从仓库根直接可用无需配置（放到 `~/.codex/AGENTS.md` 可全局生效）。

哪个文件对应哪个 agent：[Agent portability](docs/agent-portability.md)。

### 卸载

| 宿主 | 命令 |
|------|---------|
| Claude Code | `/plugin remove ponytail` |
| CodeBuddy | `/plugin remove ponytail` |
| Codex | `codex plugin remove ponytail` |
| Devin CLI | `devin plugins remove ponytail` |
| Pi agent | `pi uninstall ponytail` |
| Cursor / Windsurf / Cline 等 | 删除复制的规则文件 |

以上只删除插件自身文件。ponytail 在插件目录之外写过少量状态：模式标志、`~/.config/ponytail/config.json`，以及（如果你接受了安装引导）`~/.claude/settings.json` 里的 `statusLine` 条目。运行 `node scripts/uninstall.js` 也能一并清理。**请在上面那个宿主卸载命令之前跑**——这个脚本本身也是插件文件，先卸载插件会把它一起删掉（也可以从本仓库另一个独立 checkout 跑）。脚本只在 statusLine 指向 ponytail 自己的脚本时才移除该条目，你自己设的 statusLine 不会被改动。

## Commands

| 命令 | 作用 |
|---------|--------------|
| `/ponytail [lite \| full \| ultra \| off]` | 设定强度，或关掉。无参数则报告当前级别。 |
| `/ponytail-review` | 审查当前 diff 是否过度构建，返回一份删除清单。 |
| `/ponytail-audit` | 不只看 diff，对整个仓库做过度构建审计。 |
| `/ponytail-debt` | 把你延后处理的 `ponytail:` 简化收进账本，避免"以后"变成"永不"。 |
| `/ponytail-gain` | 展示基准测出的效果记分板（更少代码、更低成本、更快）。 |
| `/ponytail-help` | 上面命令的速查表。 |

命令需要支持 skill 的宿主（Claude Code、CodeBuddy、Codex、Devin CLI、OpenCode、Gemini、pi、Swival、Hermes Agent）。在 Codex 里它们是 skill，用 `@` 调用（`@ponytail-review`）。纯指令适配器（Cursor、Windsurf、Cline、Copilot、Kiro、Antigravity）只加载常驻规则集，不带命令。

## 开发

修改压缩规则文本时，保持各 agent 副本对齐：

```bash
node scripts/check-rule-copies.js
npm test
```

OpenClaw 的 skill 包（`.openclaw/skills/`）从 `skills/` 生成；改完 skill 后重跑 `node scripts/build-openclaw-skills.js`，否则测试套件会因过期而失败。要把 skill 发布到 ClawHub，先 `clawhub login` 一次，再跑 `node scripts/publish-openclaw-skills.js`（按 `package.json` 版本发布全部六个；加 `--dry-run` 预览）。

正确性基准会拉起 Python 跑 email 和 CSV 校验；先试 `python3`，再退回 `python`。CSV 校验需要在本地装 `pandas`。

## FAQ

**需要配置文件吗？**
不需要。可选的 `~/.config/ponytail/config.json` 或 `PONYTAIL_DEFAULT_MODE` 环境变量可以设默认级别，但没有任何必填项。

**万一我真需要那个 120 行的缓存类呢？**
你不需要。但你要是坚持，他也会给你写。慢条斯理。一丝不苟。一边盯着你看。

**能扩展吗？**
你没写的代码扩展性无限。0 bug，0 CVE，自打有史以来 100% uptime。

**为什么叫 "ponytail"？**
你心里有数。

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

[MIT](LICENSE). 能用的最短许可证。

## Star History

<a href="https://www.star-history.com/dietrichgebert/ponytail#history">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date" />
 </picture>
</a>
