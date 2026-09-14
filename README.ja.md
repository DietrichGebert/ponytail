<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.png">
    <img src="assets/logo.png" width="220" alt="Ponytail, the lazy senior dev">
  </picture>
</p>

<h1 align="center">Ponytail</h1>

<p align="center">
  <em>何も言わない。1行だけ書く。それで動く。</em>
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
  <strong>コード約54%削減（最大94%） &middot; 約20%安い &middot; 約27%速い &middot; 100%安全</strong><br>
  <sub>実在のオープンソースリポジトリ（FastAPI + React）を編集する実際の Claude Code セッションで、スキルなしの同じエージェントと比較して計測した。約54%は機能タスク12件の平均である（Haiku 4.5、n=4）。エージェントが作り込みすぎる場面（日付ピッカー）では94%に達し、コードが既に最小限の場面ではほぼゼロになる。ponytail は安全面のガードを1つも削らないが、単に「1行で書け」と指示するだけのプロンプトはそのうち1つを落としてしまう。（以前の単発ベンチマークは 80-94% を一律の数値として報告していたが、公平なエージェント基準線に対しては、それは平均ではなくタスクごとの上限である。） <a href="benchmarks/results/2026-06-18-agentic.md">詳細なレポート</a> &middot; <a href="benchmarks/">再現方法</a>。</sub>
</p>

<p align="center">
  <sub>コミュニティによる翻訳である。基準となる最新版は<a href="README.md">英語版 README</a>。</sub>
</p>

---

<p align="center">
  <a href="https://ponytail.dev/soon"><img src="assets/waitlist-banner.png" alt="近日公開、ウェイトリストに参加しよう" width="760"></a>
</p>

あなたも知っているはずだ。長いポニーテール。楕円形の眼鏡。バージョン管理システムよりも長くこの会社にいる。50行のコードを見せると、彼はそれを眺め、何も言わず、1行に置き換える。

Ponytail は、その彼をあなたの AI エージェントの中に住まわせる。

## ビフォー / アフター

日付ピッカーを頼む。エージェントは flatpickr をインストールし、ラッパーコンポーネントを書き、スタイルシートを足し、タイムゾーンについて議論を始める。

ponytail があれば:

```html
<!-- ponytail: browser has one -->
<input type="date">
```

他の生き残りは [examples/](examples/) にある。

## 数字

誠実な計測とは、実際のエージェントに実際の仕事をさせることだ。ヘッドレスの Claude Code セッションで [tiangolo の full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template)（実在の FastAPI + React リポジトリ）を編集させ、残った `git diff` で採点した。機能チケット12件、同じエージェントでスキルあり/なし、n=4、Haiku 4.5。

<p align="center">
  <img src="assets/benchmark-agentic.svg" width="860" alt="Each arm as a percent of the no-skill baseline across LOC, tokens, cost and time (Haiku 4.5). ponytail is lowest on every metric (LOC 46%, tokens 78%, cost 80%, time 73%); caveman rises above 100% on tokens, cost and time; yagni-oneliner LOC 67%. Safety, separate adversarial tier: baseline, caveman and ponytail 100%, yagni-oneliner 95%.">
</p>

| スキルなし基準線との比較 | LOC | トークン | コスト | 時間 | 安全性 |
|---|--:|--:|--:|--:|--:|
| **ponytail** | **-54%** | **-22%** | **-20%** | **-27%** | **100%** |
| caveman（簡潔な文体の対照群） | -20% | +7% | +3% | +2% | 100% |
| 「YAGNI + 1行で」プロンプト | -33% | -14% | -21% | -30% | 95% |

すべての指標を削減できたのは ponytail だけであり、そのうえで完全に安全なままでいられるのも ponytail だけである。削減幅が最大になるのは、本当に作り込みすぎる罠があるところ（日付ピッカーは404行から23行、カラーピッカーは287行から23行。コンポーネントではなくネイティブの `<input>` に手を伸ばすからだ）で、既に最小限のコードではほぼゼロになる。手法の全体、タスクごとの表、制約については [benchmarks/results/2026-06-18-agentic.md](benchmarks/results/2026-06-18-agentic.md) を参照。

<details>
<summary><strong>以前の単発の数値（単独生成）</strong></summary>

日常的なタスク5件、モデル3種、アーム3種（スキルなし、[caveman](https://github.com/JuliusBrussee/caveman)、ponytail）、各10回実行、中央値を報告。プロンプト1回、補完1回、回答の行数を数えたものだ:

<p align="center">
  <img src="assets/benchmark-3model.svg" width="860" alt="Median lines of code per arm across Haiku, Sonnet and Opus">
</p>

ここでは **80-94% のコード削減**が示された。[#126](https://github.com/DietrichGebert/ponytail/issues/126) が正当に指摘したとおり、素のモデルの基準線は散文や選択肢で回答を水増しするため、その差の一部は会話的な基準線に由来する見かけ上のものだ。上のエージェント計測が、その修正済みで擁護可能な版である。単発の実行は `npx promptfoo eval -c benchmarks/promptfooconfig.yaml` で再現できる。

</details>

**ルールは「トークンを最小にすること」ではなかった。** タスクに必要なものだけを書き、検証・エラー処理・セキュリティ・アクセシビリティは決して削らない、ということだ。コードが小さくなるのは、それが必要なものだけだからであって、コードゴルフをしたからではない。コストとレイテンシの低下は、はしごに従うモデルでの副産物である。はしごの段を検討するのに思考トークンを費やす簡潔な推論モデルでは、逆方向に振れることもある（GPT-5.5 では実際にそうなる）。

## 仕組み

コードを書く前に、エージェントは最初に当てはまった段で止まる:

```
1. これは存在する必要があるか？   → ない: 飛ばす (YAGNI)
2. 既にこのコードベースにあるか？ → 再利用する、書き直さない
3. 標準ライブラリでできるか？     → それを使う
4. プラットフォーム標準の機能か？ → それを使う
5. 導入済みの依存にあるか？       → それを使う
6. 1行で書けるか？                → 1行で書く
7. そこで初めて: 動く最小限のもの
```

このはしごは問題を理解した*後*に動くのであって、理解の代わりになるわけではない。変更が触れるコードを読み、実際の流れを追ってから、どの段かを選ぶ。解決策には怠惰でも、読むことには決して怠惰ではない。

怠惰であって、怠慢ではない。信頼境界の検証、データ損失への対処、セキュリティ、アクセシビリティが俎上に載ることはない。

## インストール

ponytail があなたに求める、最大限の労力がこれだ:

Claude Code と Codex のプラグインは小さな Node.js のライフサイクルフックを2つ実行するので、`node` が PATH に必要である（Nix/nvm ユーザーへの注意: 非対話シェルの PATH に入っている必要がある）。なくてもスキル自体は動作し、常時有効化が毎回のプロンプトでエラーを出す代わりに黙るだけだ。

### Claude Code

```
/plugin marketplace add DietrichGebert/ponytail
```
```
/plugin install ponytail@ponytail
```
（インストールを成功させるには、2つを別々のプロンプトとして送る必要がある）

Claude Code デスクトップアプリの Code タブでも手順は同じだ。上記2つの `/plugin` コマンドをプロンプト欄に入力するか、隣の **+** ボタンから **Plugins** → **Add plugin** を選んで設定済みのマーケットプレイスを閲覧する。マーケットプレイスの管理はサイドバーの **Customize** から行う。

### Codex

```bash
codex plugin marketplace add DietrichGebert/ponytail
codex plugin add ponytail@ponytail
```

`codex` を実行して `/hooks` を開き、2つのライフサイクルフックを確認して信頼したうえで、新しいスレッドを開始する。

このインストールは Codex デスクトップアプリにもそのまま適用される。インストール後にアプリを再起動すればプラグインが読み込まれる。

### GitHub Copilot CLI

```bash
copilot plugin marketplace add DietrichGebert/ponytail
copilot plugin install ponytail@ponytail
```

対話型の Copilot CLI セッションでは、スラッシュ版を使う:

```
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

Copilot CLI はプラグインコマンドをプラグイン名で名前空間化する。例:

```text
/ponytail:ponytail ultra
/ponytail:ponytail-review
```

### Pi エージェントハーネス

```
pi install git:github.com/DietrichGebert/ponytail
```

### OpenCode

`opencode.json` に追記する:

```json
{ "plugin": ["@dietrichgebert/ponytail"] }
```

チェックアウトから実行する場合はこうする（プラグインは `hooks/` と `skills/` を再利用する）:

```json
{ "plugin": ["./.opencode/plugins/ponytail.mjs"] }
```

有効なレベルでルールセットを毎ターン注入し、`/ponytail` コマンド群（[コマンド](#コマンド)を参照）を追加する。OpenCode はこのリポジトリの `AGENTS.md` も自動で読み込むため、プラグインなしでもルールは効く。プラグインは `lite/full/ultra/off` のレベルを追加する。

`./` のパスはプロジェクトの `opencode.json` を基準に解決される。1つのチェックアウトを複数プロジェクトで共有したい場合は、`.mjs` の絶対パスを指定する（`hooks/` と `skills/` は自身のファイルからの相対で探す）。

### Gemini CLI

```bash
gemini extensions install https://github.com/DietrichGebert/ponytail
```

毎セッション、ルールセットを常時有効なコンテキストとして読み込み、`/ponytail` コマンドを登録する。`skills/` も同梱され、タスクが必要とすれば有効になる。
Gemini アダプタは意図的にルートの `hooks/hooks.json` を同梱していない。Gemini はそのパスを自動で読み込むが、Ponytail のライフサイクルフックは Claude/Codex のイベント名を使うためだ。

### Qoder

Qoder はリポジトリルートの `AGENTS.md` を常時有効なコンテキストとして自動で読み込むので、チェックアウトから ponytail を実行すれば設定なしで動く。プロジェクトごとのルールにするには、[`.qoder/rules/ponytail.md`](.qoder/rules/ponytail.md) をプロジェクトの `.qoder/rules/` にコピーする。ponytail の6つのスキル（`/ponytail`、`/ponytail-review`、`/ponytail-audit`、`/ponytail-debt`、`/ponytail-gain`、`/ponytail-help`）は Qoder の Skill システム経由で利用できる。[`.qoder-plugin/plugin.json`](.qoder-plugin/plugin.json) のプラグインマニフェストが `skills/` ディレクトリを指している。

プラグイン相当のフル機能（モードの自動有効化 + 毎プロンプトでのルールセット注入）が欲しい場合は、[`hooks/qoder-hooks.json`](hooks/qoder-hooks.json) のフックを `.qoder/settings.json` に追加する。`PONYTAIL_DIR` は ponytail のチェックアウトのパスに置き換える。Qoder の `UserPromptSubmit` フックが最初のプロンプトでデフォルトモードを有効化し、毎ターンルールセットを注入する。`task|Task` マッチャーの `PreToolUse` はサブエージェントにルールセットを注入する。レベル切り替え（`/ponytail lite|full|ultra|off`）も自動で動く。

### Antigravity CLI

Google は Gemini CLI を Antigravity CLI（`agy` バイナリ）へ改称しつつある。同じ拡張機能がそちらにもインストールできる:

```bash
agy plugin install https://github.com/DietrichGebert/ponytail
```

このリポジトリの `gemini-extension.json` を再利用する。違いが1つある。Antigravity は `/ponytail` コマンドをスキルに変換するので、スラッシュメニューから選ぶのではなく、チャットに入力する（例: `/ponytail-review` をメッセージとして送る）。移行が完了するまで（2026年6月18日ごろ）は `gemini extensions install` も引き続き使える。常時有効なルールとして動かすには、ルールセットを `.agents/rules/` に置く。

### Hermes Agent

```bash
hermes plugins install DietrichGebert/ponytail --enable
```

インストール後に Hermes を再起動する。プラグインは各 LLM ターンの前に有効な Ponytail モードを注入し、同梱スキルを `ponytail:<skill>` として登録し、`/ponytail`、`/ponytail-review`、`/ponytail-audit`、`/ponytail-debt`、`/ponytail-gain`、`/ponytail-help` を追加する。共有ゲートウェイでは、Hermes のスラッシュコマンドのアクセス制御で `/ponytail` を信頼できるユーザーに限定すること。実行時のモードはプロセスローカルである。

### CodeWhale

プロジェクトルートの `AGENTS.md` を読むので、設定は不要だ。[`AGENTS.md`](AGENTS.md) をプロジェクトにコピーするか、このリポジトリのチェックアウトで `codewhale` を実行する。それだけである。

### Swival

まずライブラリにコレクションを取り込み、それから必要なスキルを追加する:

```bash
swival skills add --global https://github.com/DietrichGebert/ponytail  # ~/.config/swival/library に取り込む
swival skills add ponytail                                             # このプロジェクトにコレクションを導入
swival skills add --global ponytail                                    # または全プロジェクトで有効化
```

Swival もプロジェクトルートの `AGENTS.md` と、グローバルには `~/.config/swival/AGENTS.md` を読む。これが指示のみのフォールバックとなる。

コマンドラインでは、`$` を前置してスキルを明示的に有効化する。例: `$ponytail-review`。

### Devin CLI

```bash
devin plugins install DietrichGebert/ponytail
```

ponytail を Devin のプラグインとしてインストールする。スキルは `/ponytail:ponytail`、`/ponytail:ponytail-review` のように利用できる。

### OpenClaw

```bash
clawhub install ponytail
```

ClawHub から ponytail を OpenClaw のスキルとしてインストールする。review、audit、debt、gain、help の各スキルも同じ方法で入る（`clawhub install ponytail-review` など）。OpenClaw はコーディングタスクでこれを適用し、`/ponytail` コマンドとしても公開する。ClawHub を使わない場合は、[`.openclaw/skills/ponytail`](.openclaw/skills/) を `~/.openclaw/skills/` にコピーする。

### Grok Build

```bash
grok plugin install DietrichGebert/ponytail --trust
```

プラグインを有効にする（既定では無効）: `/plugins` → Plugins → `ponytail` の上でスペースキー、または `~/.grok/config.toml` に次を記述する:

```toml
[plugins]
enabled = ["ponytail"]
```

新しいセッションを開始する（またはプラグインを再読み込みする）。スキルは `/ponytail`、`/ponytail-review`、`/ponytail-audit`、`/ponytail-debt`、`/ponytail-gain`、`/ponytail-help` として表示される。`grok inspect` で確認できる。Grok はスキルの説明文からコーディングタスクで ponytail を自動的に呼び出せる。明示的に有効化したいときは `/ponytail`（または `/ponytail lite`、`/ponytail full`、`/ponytail ultra`）を使う。Grok のライフサイクルフックは使っていない。SessionStart の出力では指示を注入できないためだ。

プラグインなしでも、チェックアウトからなら `AGENTS.md` が指示のみのモードで機能する。

これで終わりだ。彼も誇りに思うだろう。口には出さないが。

毎セッション有効で、コマンドもいくつかある（[コマンド](#コマンド)を参照）。`/ponytail ultra` は、コードベースに個人的な恨みがあるとき用だ。起動時とモード変更時のテキストに現在のモードが表示される。

新規セッションのレベルは、環境変数 `PONYTAIL_DEFAULT_MODE`（`lite`/`full`/`ultra`/`off`）か、`~/.config/ponytail/config.json`（Windows では `%APPDATA%\ponytail\config.json`）の `defaultMode` フィールドで設定する。既定は `full` である。

有効な間、ルールセットは Agent ツールで生成されたすべてのサブエージェントにも注入される。これを特定のエージェント種別に限定したい場合（たとえば読み取り専用の検索エージェントでは無効にしたい場合）は、環境変数 `PONYTAIL_SUBAGENT_MATCHER` に、サブエージェントの `agent_type` に対して評価される正規表現を設定する。アンカーなし・大文字小文字を区別しないので、`explore|general` はどちらにもマッチし、`^general$` は完全一致、プラグインのエージェント種別は `plugin:name` の形になる。未設定ならすべてのサブエージェントに注入する（既定）。不正な正規表現の場合や、プラットフォームが種別を報告しないサブエージェントの場合も、注入する側にフォールバックする。

Cursor、Windsurf、Cline、GitHub Copilot Chat（VS Code・JetBrains・Visual Studio のエディタ拡張であり、[インストール](#インストール)で扱った単体の Copilot CLI ではない）、Aider、Kiro、Zed、CodeWhale、Swival、Qoder では、このリポジトリから対応するルールファイルをコピーする（[`.cursor/rules/`](.cursor/rules/)、[`.windsurf/rules/`](.windsurf/rules/)、[`.clinerules/`](.clinerules/)、[`.github/copilot-instructions.md`](.github/copilot-instructions.md)、[`AGENTS.md`](AGENTS.md)、[`.kiro/steering/`](.kiro/steering/)、[`.qoder/rules/`](.qoder/rules/)）。

Kiro: `.kiro/steering/ponytail.md` を `~/.kiro/steering/`（グローバル）またはプロジェクトの `.kiro/steering/` にコピーする。

GitHub Copilot CLI のフォールバック（指示のみのモード）: プロジェクト内の `AGENTS.md` と `.github/copilot-instructions.md` を読む。全プロジェクトで ponytail を効かせたい場合は、ルールを `~/.copilot/copilot-instructions.md` にコピーする。この方法でも常時有効なガイダンスは保たれるが、プラグインのモード切り替えやフックは追加されない。

Codex 拡張を入れた VS Code は `AGENTS.md` を読む。このリポジトリは同梱しているので、リポジトリルートから設定なしで動く（`~/.codex/AGENTS.md` にすれば Codex 全体で有効になる）。

JetBrains Junie は、Settings → Tools → Junie → Project Settings → Guidelines Path でパスを指定すれば `AGENTS.md` を読める（まだ自動ではない）。このリポジトリは `AGENTS.md` を同梱している。`.junie/guidelines.md` は Junie の旧来のパスである。

Amp（Sourcegraph）は作業ディレクトリから `$HOME` までの親ディレクトリを辿って `AGENTS.md` を読む。このリポジトリは同梱しているので設定なしで動く（`~/.config/amp/AGENTS.md` はグローバルに効く）。

Jules（Google）はリポジトリルートの `AGENTS.md` を読む。このリポジトリは同梱しているので、設定なしでルールセットを拾う。

どのファイルがどのエージェントに対応するかは [エージェント互換性](docs/agent-portability.md) を参照。

### アンインストール

| ホスト | コマンド |
|------|---------|
| Claude Code | `/plugin remove ponytail` |
| Codex | `codex plugin remove ponytail` |
| Devin CLI | `devin plugins remove ponytail` |
| Grok Build | `grok plugin uninstall ponytail` |
| Pi agent | `pi uninstall ponytail` |
| Cursor / Windsurf / Cline / Qoder など | コピーしたルールファイルを削除する |

これらはプラグイン自身のファイルを削除する。ponytail がプラグインフォルダの外に書き込む少量の状態は残る。モードフラグ、`~/.config/ponytail/config.json`、そして（セットアップの案内を受け入れた場合は）`~/.claude/settings.json` の `statusLine` エントリだ。これらも消すには `node scripts/uninstall.js` を実行する。**上記のホスト側の削除コマンドより先に実行すること** — このスクリプト自体がプラグインのファイルなので、先にプラグインを削除すると消えてしまう（あるいは、このリポジトリの別のクローンから実行する）。statusLine エントリは ponytail 自身のスクリプトを指している場合にのみ削除されるので、自分で設定したステータスラインはそのまま残る。

## コマンド

| コマンド | 何をするか |
|---------|--------------|
| `/ponytail [lite \| full \| ultra \| off]` | 強度を設定する、またはオフにする。引数なしなら現在のレベルを表示する。 |
| `/ponytail-review` | 現在の diff を過剰設計の観点でレビューし、削除リストを返す。 |
| `/ponytail-audit` | diff だけでなくリポジトリ全体を過剰設計の観点で監査する。 |
| `/ponytail-debt` | 先送りにした `ponytail:` のショートカットを台帳に集約し、「あとで」が「永遠にやらない」にならないようにする。 |
| `/ponytail-gain` | ベンチマークから、計測済みの効果（コード削減、コスト削減、速度向上）のスコアボードを表示する。 |
| `/ponytail-help` | 上記コマンドのクイックリファレンス。 |

コマンドにはスキル対応のホストが必要だ（Claude Code、Codex、Devin CLI、OpenCode、Gemini、pi、Swival、Hermes Agent、Qoder、Grok Build）。Codex ではスキル扱いなので `@` で呼び出す（`@ponytail-review`）。指示のみのアダプタ（Cursor、Windsurf、Cline、Copilot、Kiro、Antigravity）は、コマンドなしで常時有効なルールセットだけを読み込む。

## 開発

コンパクトなルール文を変更するときは、各エージェント向けのコピーを揃えておくこと:

```bash
node scripts/check-rule-copies.js
npm test
```

OpenClaw のスキルパッケージ（`.openclaw/skills/`）は `skills/` から生成される。スキルを変更したら `node scripts/build-openclaw-skills.js` を再実行すること。古いままだとテストスイートが失敗する。スキルを ClawHub に公開するには、一度 `clawhub login` を実行してから `node scripts/publish-openclaw-skills.js` を実行する（`package.json` のバージョンで6つすべてを公開する。`--dry-run` を渡すとプレビューできる）。

正当性のベンチマークはメールと CSV のチェックのために Python を起動する。`python3` が先に試され、次に `python` が試される。CSV のチェックにはローカルに `pandas` が必要だ。

## FAQ

**[caveman](https://github.com/JuliusBrussee/caveman) と併用できるか？**
できるし、すべきだ。caveman はエージェントが「話す」量を減らし、ponytail は「作る」量を減らす。役割の半分ずつで、重複はない。caveman はコードを1バイトも変えず、ponytail は散文に手を出さない。最小限のコードについて、簡潔に語ろう。

**設定ファイルは必要か？**
不要だ。任意で `~/.config/ponytail/config.json` や環境変数 `PONYTAIL_DEFAULT_MODE` から既定のレベルを設定できるが、必須のものは何もない。

**どうしても120行のキャッシュクラスが必要な場合は？**
必要ない。それでも言い張れば、彼は作ってくれる。ゆっくりと。正確に。あなたを見ながら。

**スケールするのか？**
書かなかったコードは無限にスケールする。バグゼロ、CVE ゼロ、稼働率は昔から100%だ。

**なぜ「ponytail」なのか？**
理由はあなたが一番よく知っている。

## スポンサー

<p align="center">
  <a href="https://greenpt.com/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="assets/logo-greenpt-dark.svg">
      <img src="assets/logo-greenpt.svg" width="260" alt="GreenPT">
    </picture>
  </a>
</p>

## ライセンス

[MIT](LICENSE)。動くもののなかで一番短いライセンスだ。

## スター履歴

<a href="https://www.star-history.com/dietrichgebert/ponytail#history">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date" />
 </picture>
</a>
