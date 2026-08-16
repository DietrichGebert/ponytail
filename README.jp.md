<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.png">
    <img src="assets/logo.png" width="220" alt="Ponytail、ものぐさなベテラン開発者">
  </picture>
</p>

<h1 align="center">Ponytail</h1>

<p align="center">
  <em>何も言わない。1行書く。動作する。</em>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/DietrichGebert/ponytail?style=flat-square&color=111111&label=stars" alt="Stars">
  <img src="https://img.shields.io/github/v/release/DietrichGebert/ponytail?style=flat-square&color=111111&label=release" alt="Release">
  <img src="https://img.shields.io/npm/v/@dietrichgebert/ponytail?style=flat-square&color=111111&label=npm" alt="npm">
  <img src="https://img.shields.io/badge/works%20with-20%20agents-111111?style=flat-square" alt="20種類のエージェントに対応">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MITライセンス">
</p>

<p align="center">
  <a href="https://trendshift.io/repositories/50668" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/trendshift/repositories/50668/daily" alt="DietrichGebert/ponytail | Trendshift" width="250" height="55"/></a>
  <a href="https://trendshift.io/repositories/50668" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/trendshift/repositories/50668/weekly" alt="DietrichGebert/ponytail | Trendshift" width="250" height="55"/></a>
</p>

<p align="center">
  <strong>コード約54%削減（最大94%）・コスト約20%削減・速度約27%向上・安全性100%</strong><br>
  <sub>実際のオープンソースリポジトリ（FastAPI + React）を編集する、実際の Claude Code セッションで測定。同じエージェントにスキルを与えない場合と比較しています。約54%は12個の機能タスク（Haiku 4.5、n=4）の平均値で、エージェントが作り込みすぎる場合（日付ピッカー）には94%に達し、コードがすでに最小限の場合はほぼゼロです。ponytail は安全策をすべて維持しますが、単なる「1行で書け」というプロンプトでは1つ失われます。（以前の単発ベンチマークでは一律80〜94%と報告していましたが、公平なエージェント比較ではこれは平均ではなくタスクごとの上限です。）<a href="benchmarks/results/2026-06-18-agentic.md">詳細なレポート</a>・<a href="benchmarks/">再現する</a>。</sub>
</p>

<p align="center">
  <sub>これはコミュニティによる翻訳です。参照すべき最新バージョンは<a href="README.md">英語版 README</a> です。</sub>
</p>

---

彼をご存じでしょう。長いポニーテールに、楕円形の眼鏡。バージョン管理システムよりも長く会社にいる人です。50行のコードを見せると、何も言わず、1行に置き換えます。

Ponytail は、彼をあなたの AI エージェントの中に入れます。

## Before / after

日付ピッカーを頼むと、エージェントは flatpickr をインストールし、ラッパーコンポーネントを書き、スタイルシートを追加し、タイムゾーンについて議論を始めます。

ponytail を使うと：

```html
<!-- ponytail: ブラウザに標準搭載されている -->
<input type="date">
```

生き残った実例は [examples/](examples/) にあります。

## 数字

正直な測定方法は、エージェントが実際に仕事をするところを見ることです。ヘッドレスの Claude Code セッションで、[tiangolo のフルスタック FastAPI テンプレート](https://github.com/fastapi/full-stack-fastapi-template)（実際の FastAPI + React リポジトリ）を編集し、残った `git diff` を評価しました。12個の機能チケットについて、同じエージェントをスキルあり・なしで比較し、n=4、Haiku 4.5 を使用しています。

<p align="center">
  <img src="assets/benchmark-agentic.svg" width="860" alt="Haiku 4.5における、コード行数・トークン数・コスト・時間の各指標を、スキルなしの基準値に対する割合で表示。ponytailは全指標で最小（コード行数46%、トークン78%、コスト80%、時間73%）。cavemanはトークン・コスト・時間で100%を超え、YAGNI + 1行プロンプトのコード行数は67%。安全性は別の敵対的テスト層で評価：基準値、caveman、ponytailは100%、YAGNI + 1行プロンプトは95%。">
</p>

| スキルなし基準値との比較 | コード行数 | トークン | コスト | 時間 | 安全性 |
|---|--:|--:|--:|--:|--:|
| **ponytail** | **-54%** | **-22%** | **-20%** | **-27%** | **100%** |
| caveman（簡潔な文章の対照群） | -20% | +7% | +3% | +2% | 100% |
| 「YAGNI + 1行」プロンプト | -33% | -14% | -21% | -30% | 95% |

すべての指標を削減し、その間も完全な安全性を保つのは ponytail だけです。削減幅が最大になるのは、作り込みすぎの罠が実際にある場合（日付ピッカーは404行から23行、カラーピッカーは287行から23行。コンポーネントではなくネイティブの `<input>` を使うため）で、すでに最小限のコードではほぼゼロです。完全な手法、タスクごとの表、制限事項は [benchmarks/results/2026-06-18-agentic.md](benchmarks/results/2026-06-18-agentic.md) を参照してください。

<details>
<summary><strong>以前の単発測定（分離された生成）</strong></summary>

日常的な5つのタスク、3つのモデル、3つの方式（スキルなし、[caveman](https://github.com/JuliusBrussee/caveman)、ponytail）、10回実行し、中央値を報告しています。1つのプロンプト、1回の回答で、回答に含まれる行数を数えました。

<p align="center">
  <img src="assets/benchmark-3model.svg" width="860" alt="Haiku、Sonnet、Opusにおける方式ごとのコード行数の中央値">
</p>

これは**コードを80〜94%削減**できることを示しました。[#126](https://github.com/DietrichGebert/ponytail/issues/126) が公平に指摘したとおり、素のモデルによる基準値は回答を説明文や選択肢で水増ししているため、この差の一部は会話形式の基準値によるものです。上記のエージェント測定値が、修正済みで信頼できるバージョンです。単発実行は `npx promptfoo eval -c benchmarks/promptfooconfig.yaml` で再現できます。

</details>

**ルールは決して「トークン数を最小にする」ことではありません。** タスクに必要なものだけを書き、検証、エラーハンドリング、セキュリティ、アクセシビリティを決して削らないことです。コードが小さくなるのは必要なものだけを書くからであって、コードゴルフをするからではありません。コストとレイテンシの低下は、この梯子に従うモデルにおける副作用です。梯子の各段を検討するために思考トークンを使う簡潔な推論モデルでは、逆の結果になることもあります（GPT-5.5ではそうなります）。

## 仕組み

コードを書く前に、エージェントは次のうち最初に当てはまる段階で止まります。

```
1. これは存在する必要があるか？ → いいえ：省略（YAGNI）
2. このコードベースにすでにあるか？ → 再利用し、書き直さない
3. 標準ライブラリにあるか？ → 使う
4. ネイティブのプラットフォーム機能か？ → 使う
5. インストール済みの依存関係にあるか？ → 使う
6. 1行で書けるか？ → 1行で書く
7. それでも必要なら：動作する最小限のものを書く
```

この梯子は問題を理解した**後に**使います。理解の代わりにはしません。段階を選ぶ前に、変更が触れるコードを読み、実際の処理の流れを追います。解決策には無精でも、読むことには決して無精ではありません。

無精でも怠慢ではありません。信頼境界での検証、データ損失への対処、セキュリティ、アクセシビリティを削ることは決してありません。

## インストール

ponytail があなたに求める作業は、これが最初で最後です。

Claude Code と Codex のプラグインは、2つの小さな Node.js ライフサイクルフックを実行するため、`node` が PATH に入っている必要があります（Nix/nvm ユーザー向けの注意：非対話シェルの PATH にも必要です）。入っていなくてもスキルは動作しますが、常時有効化は各プロンプトでエラーを出す代わりに静かに無効になります。

### Claude Code

```
/plugin marketplace add DietrichGebert/ponytail
```
```
/plugin install ponytail@ponytail
```
（インストールを成功させるには、2つのプロンプトを別々に送る必要があります）

Claude Code Desktop アプリの Code タブでも同じ手順です。上記の `/plugin` コマンドを2つプロンプト欄に入力するか、横の **+** ボタンをクリックして **Plugins** → **Add plugin** を選び、設定済みのマーケットプレイスを参照します。マーケットプレイスはサイドバーの **Customize** から管理できます。

### Codex

```bash
codex plugin marketplace add DietrichGebert/ponytail
codex plugin add ponytail@ponytail
```

`codex` を起動して `/hooks` を開き、2つのライフサイクルフックを確認して信頼し、新しいスレッドを開始します。

このインストール方法は Codex デスクトップアプリにも対応しています。インストール後にアプリを再起動すると、プラグインが読み込まれます。

### GitHub Copilot CLI

```bash
copilot plugin marketplace add DietrichGebert/ponytail
copilot plugin install ponytail@ponytail
```

対話的な Copilot CLI セッションでは、スラッシュコマンド版を使います。

```
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

Copilot CLI はプラグイン名でコマンドを名前空間化します。例：

```text
/ponytail:ponytail ultra
/ponytail:ponytail-review
```

### Pi agent harness

```
pi install git:github.com/DietrichGebert/ponytail
```

### OpenCode

`opencode.json` に追加します。

```json
{ "plugin": ["@dietrichgebert/ponytail"] }
```

代わりにチェックアウトから実行する場合（プラグインは `hooks/` と `skills/` を再利用します）：

```json
{ "plugin": ["./.opencode/plugins/ponytail.mjs"] }
```

アクティブなレベルで毎ターンルールセットを注入し、`/ponytail` コマンドを追加します（[コマンド](#コマンド)を参照）。OpenCode はこのリポジトリの `AGENTS.md` も自動で読み込むため、プラグインなしでもルールが適用されます。プラグインは `lite/full/ultra/off` のレベルを追加します。

`./` パスはプロジェクトの `opencode.json` を基準に解決されます。複数のプロジェクトで1つのチェックアウトを共有するには、代わりに `.mjs` の絶対パスを指定してください（そのファイルを基準に `hooks/` と `skills/` を見つけます）。

### Gemini CLI

```bash
gemini extensions install https://github.com/DietrichGebert/ponytail
```

毎回のセッションでルールセットを常時有効なコンテキストとして読み込み、`/ponytail` コマンドを登録します。`skills/` も同梱され、タスクに必要なときに有効化されます。
Gemini アダプターにルートの `hooks/hooks.json` が意図的に含まれていないのは、Gemini がそのパスを自動読み込みする一方、Ponytail のライフサイクルフックは Claude/Codex のイベント名を使うためです。

### Qoder

Qoder はリポジトリルートの `AGENTS.md` を常時有効なコンテキストとして自動読み込みするため、チェックアウトから ponytail を実行すれば設定不要です。プロジェクト単位のルールには [`.qoder/rules/ponytail.md`](.qoder/rules/ponytail.md) をプロジェクトの `.qoder/rules/` にコピーします。6つの ponytail スキル（`/ponytail`、`/ponytail-review`、`/ponytail-audit`、`/ponytail-debt`、`/ponytail-gain`、`/ponytail-help`）は Qoder の Skill システムから利用できます。プラグインマニフェスト [`.qoder-plugin/plugin.json`](.qoder-plugin/plugin.json) は `skills/` ディレクトリを指しています。

完全なプラグインレベルのサポート（自動モード切り替えと各プロンプトへのルールセット注入）には、[`hooks/qoder-hooks.json`](hooks/qoder-hooks.json) のフックを `.qoder/settings.json` に追加します。`PONYTAIL_DIR` を ponytail のチェックアウトへのパスに置き換えてください。Qoder の `UserPromptSubmit` フックは最初のプロンプトでデフォルトモードを有効化し、毎ターンルールセットを注入します。`task|Task` マッチャー付きの `PreToolUse` はサブエージェントにルールセットを注入します。レベル切り替え（`/ponytail lite|full|ultra|off`）も自動的に動作します。

### Antigravity CLI

Google は Gemini CLI の名称を Antigravity CLI（`agy` バイナリ）に変更中です。同じ拡張機能をインストールできます。

```bash
agy plugin install https://github.com/DietrichGebert/ponytail
```

このリポジトリの `gemini-extension.json` を再利用します。違いは、Antigravity が `/ponytail` コマンドをスキルに変換するため、スラッシュメニューから選ぶのではなく、チャットに（メッセージとして `/ponytail-review` などを）入力する点です。移行が完了する（2026年6月18日頃）までは、`gemini extensions install` も引き続き動作します。常時有効なルールとして実行するには、ルールセットを `.agents/rules/` に置いてください。

### Hermes Agent

```bash
hermes plugins install DietrichGebert/ponytail --enable
```

インストール後に Hermes を再起動します。プラグインは各 LLM ターンの前にアクティブな Ponytail モードを注入し、同梱スキルを `ponytail:<skill>` として登録し、`/ponytail`、`/ponytail-review`、`/ponytail-audit`、`/ponytail-debt`、`/ponytail-gain`、`/ponytail-help` を追加します。共有ゲートウェイでは、Hermes のスラッシュコマンドアクセス制御を使って `/ponytail` を信頼できるユーザーに制限してください。実行時のモードはプロセス単位です。

### CodeWhale

プロジェクトルートの `AGENTS.md` を読み込むため、設定不要です。[`AGENTS.md`](AGENTS.md) をプロジェクトにコピーするか、このリポジトリのチェックアウトから `codewhale` を実行してください。それだけです。

### Swival

まずコレクションをライブラリに登録し、その後必要なスキルを追加します。

```bash
swival skills add --global https://github.com/DietrichGebert/ponytail  # ~/.config/swival/library に登録
swival skills add ponytail                                             # このプロジェクトにコレクションをインストール
swival skills add --global ponytail                                    # またはすべてのプロジェクトで有効化
```

Swival はプロジェクトルートの `AGENTS.md` と、指示だけを行うフォールバックとしてグローバルの `~/.config/swival/AGENTS.md` も読み込みます。

コマンドラインでは、`$` プレフィックスを使ってスキルを明示的に有効化します。例：`$ponytail-review`。

### Devin CLI

```bash
devin plugins install DietrichGebert/ponytail
```

ponytail を Devin プラグインとしてインストールします。スキルは `/ponytail:ponytail`、`/ponytail:ponytail-review` などとして利用できます。

### OpenClaw

```bash
clawhub install ponytail
```

ClawHub から ponytail を OpenClaw スキルとしてインストールします。review、audit、debt、gain、help スキルも同じ方法でインストールできます（`clawhub install ponytail-review` など）。OpenClaw はコーディングタスクでこれを適用し、`/ponytail` コマンドとしても公開します。ClawHub を使わない場合は [`.openclaw/skills/ponytail`](.openclaw/skills/) を `~/.openclaw/skills/` にコピーしてください。

### Grok Build

```bash
grok plugin install DietrichGebert/ponytail --trust
```

プラグインはデフォルトでは無効です。`/plugins` → Plugins → `ponytail` の Space キーで有効化するか、`~/.grok/config.toml` に次を追加します。

```toml
[plugins]
enabled = ["ponytail"]
```

新しいセッションを開始する（またはプラグインを再読み込みする）と、`/ponytail`、`/ponytail-review`、`/ponytail-audit`、`/ponytail-debt`、`/ponytail-gain`、`/ponytail-help` としてスキルが表示されます。`grok inspect` で確認できます。Grok はスキルの説明に基づき、コーディングタスクで ponytail を自動呼び出しできます。明示的に有効化するには `/ponytail`（または `/ponytail lite`、`/ponytail full`、`/ponytail ultra`）を使います。Grok のライフサイクルフックは、SessionStart の出力から指示を注入できないため使用していません。

プラグインなしでも、チェックアウトからの指示専用モードでは `AGENTS.md` が引き続き機能します。

これで終わりです。彼なら満足するでしょう。口には出しません。

毎セッションで有効になり、いくつかのコマンドを使えます（[コマンド](#コマンド)を参照）。コードベースに個人的な恨みがあるときのために `/ponytail ultra` もあります。起動時とモード変更時のテキストには現在のモードが表示されます。

新しいセッションごとのレベルは、`PONYTAIL_DEFAULT_MODE` 環境変数（`lite`/`full`/`ultra`/`off`）または `~/.config/ponytail/config.json`（Windows では `%APPDATA%\ponytail\config.json`）の `defaultMode` フィールドで設定できます。デフォルトは `full` です。

有効な間は、Agent ツールで起動されたすべてのサブエージェントにもルールセットが注入されます。特定のエージェント種別だけに限定する（たとえば読み取り専用の検索エージェントでは無効にする）には、サブエージェントの `agent_type` に対してテストする正規表現を `PONYTAIL_SUBAGENT_MATCHER` 環境変数に設定します。正規表現はアンカーなし・大文字小文字を区別しません。`explore|general` はどちらかに一致し、`^general$` は完全一致、プラグインのエージェント種別は `plugin:name` のようになります。未設定の場合はすべてのサブエージェントに注入します（デフォルト）。無効な正規表現や、プラットフォームが種別を報告しないサブエージェントの場合も、注入にフォールバックします。

Cursor、Windsurf、Cline、GitHub Copilot Chat（VS Code、JetBrains、Visual Studio のエディター拡張機能。`[Install](#install)` に記載の単体 Copilot CLI とは別物）、Aider、Kiro、Zed、CodeWhale、Swival、Qoder：このリポジトリから対応するルールファイル（[`.cursor/rules/`](.cursor/rules/)、[`.windsurf/rules/`](.windsurf/rules/)、[`.clinerules/`](.clinerules/)、[`.github/copilot-instructions.md`](.github/copilot-instructions.md)、[`AGENTS.md`](AGENTS.md)、[`.kiro/steering/`](.kiro/steering/)、[`.qoder/rules/`](.qoder/rules/)）をコピーします。

Kiro：`.kiro/steering/ponytail.md` を `~/.kiro/steering/`（グローバル）またはプロジェクトの `.kiro/steering/` にコピーします。

GitHub Copilot CLI のフォールバック（指示専用モード）：プロジェクト内の `AGENTS.md` と `.github/copilot-instructions.md` を読み込みます。すべてのプロジェクトで ponytail を実行するには、ルールを `~/.copilot/copilot-instructions.md` にコピーします。この方法では常時有効なガイダンスは使えますが、プラグインのモード切り替えやフックは追加されません。

Codex 拡張機能を使う VS Code は、このリポジトリに同梱された `AGENTS.md` を読み込むため、リポジトリルートから設定なしで動作します（Codex をグローバルにするには `~/.codex/AGENTS.md` を使います）。

JetBrains Junie は、Settings → Tools → Junie → Project Settings → Guidelines Path で指定すれば `AGENTS.md` を読み込めます（まだ自動ではありません）。このリポジトリには `AGENTS.md` が含まれており、`.junie/guidelines.md` は Junie の旧パスです。

Amp（Sourcegraph）は作業ディレクトリから `$HOME` までの親ディレクトリにある `AGENTS.md` を読み込みます。このリポジトリには同ファイルが含まれているため、設定なしで動作します（グローバルには `~/.config/amp/AGENTS.md` を使えます）。

Jules（Google）はリポジトリルートの `AGENTS.md` を読み込みます。このリポジトリには同ファイルが含まれているため、設定なしでルールセットを読み込みます。

どのエージェントにどのファイルが対応するかは、[エージェントの移植性](docs/agent-portability.md)を参照してください。

### アンインストール

| ホスト | コマンド |
|------|---------|
| Claude Code | `/plugin remove ponytail` |
| Codex | `codex plugin remove ponytail` |
| Devin CLI | `devin plugins remove ponytail` |
| Grok Build | `grok plugin uninstall ponytail` |
| Pi agent | `pi uninstall ponytail` |
| Cursor / Windsurf / Cline / Qoder など | コピーしたルールファイルを削除 |

これらはプラグイン自身のファイルを削除しますが、ponytail がプラグインフォルダー外に書き込んだ少量の状態（モードフラグ、`~/.config/ponytail/config.json`、およびセットアップの案内を受け入れていた場合は `~/.claude/settings.json` の `statusLine` エントリ）は残ります。それらも削除するには `node scripts/uninstall.js` を実行してください。**上記のホスト削除コマンドより先に実行してください**。このスクリプト自体がプラグインファイルなので、先にプラグインを削除するとスクリプトも消えます（またはこのリポジトリを別のクローンから実行してください）。ponytail 自身のスクリプトを指している場合にだけ `statusLine` エントリを削除するため、自分で設定した statusline はそのまま残ります。

## コマンド

| コマンド | 内容 |
|---------|--------------|
| `/ponytail [lite \| full \| ultra \| off]` | 強度を設定するか、無効にします。引数なしでは現在のレベルを表示します。 |
| `/ponytail-review` | 現在の差分を作り込みすぎの観点でレビューし、削除候補リストを返します。 |
| `/ponytail-audit` | 差分だけでなく、リポジトリ全体を作り込みすぎの観点で監査します。 |
| `/ponytail-debt` | 先送りした `ponytail:` ショートカットを台帳に集め、「後で」が「永遠に」に変わらないようにします。 |
| `/ponytail-gain` | ベンチマークで測定した効果（コード削減、コスト削減、速度向上）のスコアボードを表示します。 |
| `/ponytail-help` | 上記コマンドのクイックリファレンスを表示します。 |

コマンドにはスキル対応ホスト（Claude Code、Codex、Devin CLI、OpenCode、Gemini、pi、Swival、Hermes Agent、Qoder、Grok Build）が必要です。Codex ではスキルなので `@`（`@ponytail-review`）で呼び出します。指示専用のアダプター（Cursor、Windsurf、Cline、Copilot、Kiro、Antigravity）は、コマンドなしで常時有効なルールセットを読み込みます。

## 開発

簡潔なルール本文を変更する場合は、各エージェント向けのコピーを同期させてください。

```bash
node scripts/check-rule-copies.js
npm test
```

OpenClaw のスキルパッケージ（`.openclaw/skills/`）は `skills/` から生成されます。スキルを変更したら `node scripts/build-openclaw-skills.js` を再実行してください。古いままだとテストスイートが失敗します。スキルを ClawHub に公開するには、最初に一度 `clawhub login` を実行し、その後 `node scripts/publish-openclaw-skills.js` を実行します（`package.json` のバージョンで6つすべてを公開します。`--dry-run` でプレビューできます）。

正確性ベンチマークはメールと CSV のチェックに Python を起動します。`python3` を `python` より先に試します。CSV チェックにはローカルに `pandas` がインストールされている必要があります。

## FAQ

**[caveman](https://github.com/JuliusBrussee/caveman) と一緒に使えますか？**
はい、使うべきです。Caveman はエージェントが言うことを短くし、ponytail はエージェントが作るものを小さくします。役割は異なり、重複はありません。caveman はコードをバイト単位で完全に変えず、ponytail は文章に口を出しません。簡潔な会話で、最小限のコードを目指します。

**設定ファイルは必要ですか？**
いいえ。任意の `~/.config/ponytail/config.json` または `PONYTAIL_DEFAULT_MODE` 環境変数でデフォルトレベルを設定できますが、何も設定しなくて構いません。

**本当に120行のキャッシュクラスが必要な場合は？**
必要ありません。それでも insist すれば、彼は作ります。ゆっくりと。正しく。あなたを見つめながら。

**スケールしますか？**
書かなかったコードは無限にスケールします。バグはゼロ、CVE はゼロ、永遠に稼働率100%です。

**なぜ「ponytail」なのですか？**
理由は完全にお分かりでしょう。

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

[MIT](LICENSE)。動作する最短のライセンスです。

## Star History

<a href="https://www.star-history.com/dietrichgebert/ponytail#history">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date" />
   <img alt="スター履歴グラフ" src="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date" />
 </picture>
</a>
