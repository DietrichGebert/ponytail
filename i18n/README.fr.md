<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/logo-dark.png">
    <img src="../assets/logo.png" width="220" alt="Ponytail, le senior dev paresseux">
  </picture>
</p>

<h1 align="center">Ponytail</h1>

<p align="center">
  <em>Il ne dit rien. Il écrit une ligne. Ça marche.</em>
</p>

<p align="center">
  <a href="https://trendshift.io/repositories/50668?utm_source=repository-badge&amp;utm_medium=badge&amp;utm_campaign=badge-repository-50668" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/repositories/50668" alt="DietrichGebert%2Fponytail | Trendshift" width="250" height="55"/></a>
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
  <a href="https://trendshift.io/repositories/50668?utm_source=trendshift-badge&amp;utm_medium=badge&amp;utm_campaign=badge-trendshift-50668" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/trendshift/repositories/50668/monthly?language=JavaScript" alt="DietrichGebert%2Fponytail | Trendshift monthly ranking" width="250" height="55"/></a>
</p>

<p align="center">
  <strong>~54% de code en moins (jusqu'à 94%) &middot; ~20% moins cher &middot; ~27% plus rapide &middot; 100% sûr</strong><br>
  <sub>De vraies sessions Claude Code qui modifient un vrai dépôt FastAPI + React, le même agent avec et sans le skill (12 tickets de fonctionnalité, Haiku 4.5, n=4). <a href="#numbers">Détails</a>.</sub>
</p>

<p align="center">
  <sub><a href="../README.md">English</a> &middot; <a href="README.es.md">Español</a> &middot; Français &middot; <a href="README.ko.md">한국어</a> &middot; <a href="README.zh-CN.md">简体中文</a> &middot; <a href="README.ja.md">日本語</a></sub><br>
  <sub>Traduction du README anglais. En cas de différence, c'est la <a href="../README.md">version anglaise</a> qui fait foi.</sub>
</p>

---

<p align="center">
  <a href="https://ponytail.dev/soon"><img src="../assets/waitlist-banner.png" alt="Quelque chose arrive, rejoignez la liste d'attente" width="760"></a>
</p>

## Déjà construit avec Ponytail

<a href="https://theretriever.app">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/retriever-logo-dark.svg">
    <img src="../assets/retriever-logo-light.svg" height="128" alt="Retriever">
  </picture>
</a>

---

Vous le connaissez. Longue queue de cheval. Lunettes ovales. Il est dans la boîte depuis plus longtemps que le gestionnaire de versions. Vous lui montrez cinquante lignes ; il les regarde, ne dit rien, et les remplace par une seule.

Ponytail le met dans votre agent IA.

## Le prompt

Ponytail tient en un seul prompt : [`skills/ponytail/SKILL.md`](../skills/ponytail/SKILL.md). La version compacte, pour les agents qui lisent un fichier de règles, est [`AGENTS.md`](../AGENTS.md). Tout le reste de ce dépôt sert à charger ce prompt dans différents agents.

## Installation

**Claude Code**, en deux prompts séparés :

```
/plugin marketplace add DietrichGebert/ponytail
```
```
/plugin install ponytail@ponytail
```

**Codex :**

```bash
codex plugin marketplace add DietrichGebert/ponytail
codex plugin add ponytail@ponytail
```

Ouvrez ensuite `/hooks` dans Codex, approuvez ses deux hooks de cycle de vie, et démarrez un nouveau fil.

**Tout autre agent :** copiez [`AGENTS.md`](../AGENTS.md) dans votre projet, ou demandez à votre agent d'installer [`skills/ponytail/SKILL.md`](../skills/ponytail/SKILL.md) comme skill. Pas à pas pour Copilot, Cursor, OpenCode, Gemini et les autres (en anglais) : **[INSTALL.md](../INSTALL.md)**.

C'est tout. Il serait fier. Il ne le dira pas.

Actif à chaque session, avec une poignée de commandes (voir [Commandes](#commands)). `/ponytail ultra` existe pour le jour où le code vous a offensé personnellement. Le texte de démarrage et de changement de mode affiche le mode en cours.

N'installez ponytail que depuis `DietrichGebert/ponytail` sur GitHub ou `@dietrichgebert/ponytail` sur npm. Il ne livre jamais de fichiers `.exe` ou `.dll` ; une copie qui en contient ne vient pas de moi.

## Avant / après

Vous demandez un sélecteur de date. Votre agent installe flatpickr, écrit un composant wrapper, ajoute une feuille de style et lance une discussion sur les fuseaux horaires.

Avec ponytail :

```html
<!-- ponytail: browser has one -->
<input type="date">
```

D'autres rescapés dans [examples/](../examples/).

## Comment ça marche

Avant d'écrire du code, l'agent s'arrête au premier barreau qui tient :

```
1. Faut-il que ça existe ?             → non : on saute (YAGNI)
2. Déjà dans ce code ?                 → réutiliser, ne pas réécrire
3. La bibliothèque standard le fait ?  → l'utiliser
4. Fonction native de la plateforme ?  → l'utiliser
5. Dépendance déjà installée ?         → l'utiliser
6. Une ligne ?                         → une ligne
7. Seulement alors : le minimum qui marche
```

L'échelle intervient *après* avoir compris le problème, pas à sa place : l'agent lit le code que le changement touche et suit le vrai flux avant de choisir un barreau. Paresseux sur la solution, jamais sur la lecture.

Paresseux, pas négligent : la validation aux frontières de confiance, la gestion des pertes de données, la sécurité et l'accessibilité ne passent jamais à la trappe.

<a id="commands"></a>
## Commandes

| Commande | Ce qu'elle fait |
|---------|--------------|
| `/ponytail [lite \| full \| ultra \| off]` | Règle l'intensité, ou coupe ponytail. Sans argument, active ponytail au niveau par défaut s'il est coupé, et sinon indique le niveau en cours. |
| `/ponytail-review` | Passe en revue le diff en cours à la recherche de sur-ingénierie et rend une liste de suppressions. Nommez une cible en clair pour réduire ou élargir : `uncommitted`, `staged`, `branch`, ou un lien de PR. |
| `/ponytail-audit` | Audite tout le dépôt à la recherche de sur-ingénierie, pas seulement le diff. |
| `/ponytail-debt` | Rassemble les raccourcis `ponytail:` que vous avez remis à plus tard dans un registre, pour que "plus tard" ne devienne pas "jamais". |
| `/ponytail-gain` | Affiche le tableau de l'impact mesuré par le benchmark (moins de code, moins de coût, plus de vitesse). |
| `/ponytail-help` | Aide-mémoire des commandes ci-dessus. |

Les commandes demandent un hôte qui gère les skills (Claude Code, Codex, Devin CLI, OpenCode, Gemini, pi, Hermes Agent, Qoder, Grok Build). Dans Codex CLI et l'extension IDE, ce sont des skills dans l'espace de noms du plugin ; on les appelle avec `$ponytail:ponytail-review`. Cursor avec les [hooks](../INSTALL.md#cursor) n'a que le changement de niveau `/ponytail`, tapé comme un message normal. Les adaptateurs à instructions seules (fichier de règles de Cursor, Windsurf, Cline, Copilot, Kiro, Antigravity) chargent les règles toujours actives, sans les commandes.

<a id="numbers"></a>
## Chiffres

La mesure honnête, c'est un vrai agent qui fait un vrai travail : une session Claude Code headless qui modifie le [full-stack-fastapi-template de tiangolo](https://github.com/fastapi/full-stack-fastapi-template) (un vrai dépôt FastAPI + React), notée sur le `git diff` qu'elle laisse. Douze tickets de fonctionnalité, le même agent avec et sans le skill, n=4, Haiku 4.5.

<p align="center">
  <img src="../assets/benchmark-agentic.svg" width="860" alt="Chaque variante en pourcentage de la référence sans skill, en lignes de code, tokens, coût et temps (Haiku 4.5). ponytail est le plus bas sur chaque mesure (lignes 46%, tokens 78%, coût 80%, temps 73%) ; caveman dépasse 100% en tokens, coût et temps ; yagni-oneliner lignes 67%. Sécurité, palier adverse séparé : référence, caveman et ponytail 100%, yagni-oneliner 95%.">
</p>

| vs référence sans skill | lignes | tokens | coût | temps | sûr |
|---|--:|--:|--:|--:|--:|
| **ponytail** | **-54%** | **-22%** | **-20%** | **-27%** | **100%** |
| caveman (contrôle prose concise) | -20% | +7% | +3% | +2% | 100% |
| prompt "YAGNI + one-liners" | -33% | -14% | -21% | -30% | 95% |

ponytail est la seule variante qui réduit toutes les mesures, et la seule qui reste entièrement sûre en le faisant. La réduction est la plus forte là où il y a un vrai piège de sur-construction (sélecteur de date de 404 à 23 lignes, sélecteur de couleur de 287 à 23, parce qu'il choisit un `<input>` natif au lieu d'un composant) et quasi nulle sur du code déjà minimal. Méthode complète, tableaux par ticket et limites : [benchmarks/results/2026-06-18-agentic.md](../benchmarks/results/2026-06-18-agentic.md).

<details>
<summary><strong>Anciens chiffres en un seul passage (génération isolée)</strong></summary>

Cinq tâches courantes, trois modèles, trois variantes (sans skill, [caveman](https://github.com/JuliusBrussee/caveman), ponytail), dix runs, médiane retenue. Un prompt, une réponse, en comptant les lignes de la réponse :

<p align="center">
  <img src="../assets/benchmark-3model.svg" width="860" alt="Médiane des lignes de code par variante sur Haiku, Sonnet et Opus">
</p>

Cela montrait **80-94% de code en moins**. [#126](https://github.com/DietrichGebert/ponytail/issues/126) a fait remarquer, à juste titre, que la référence du modèle nu remplit sa réponse de prose et d'options, donc cet écart vient en partie d'une référence conversationnelle. Les chiffres agentiques ci-dessus en sont la version corrigée et défendable. Pour reproduire le run en un seul passage : `npx promptfoo eval -c benchmarks/promptfooconfig.yaml`.

</details>

**La règle n'a jamais été "le moins de tokens possible".** C'est : écrire seulement ce dont la tâche a besoin, et ne jamais couper la validation, la gestion d'erreurs, la sécurité ou l'accessibilité. Le code finit petit parce qu'il est nécessaire, pas parce qu'il est compressé à l'extrême. Un coût et une latence plus bas sont un effet de bord sur les modèles qui suivent l'échelle ; un modèle de raisonnement laconique qui dépense des tokens de réflexion à peser les barreaux peut aller dans l'autre sens (c'est le cas sur GPT-5.5).

## FAQ

**Puis-je l'utiliser avec [caveman](https://github.com/JuliusBrussee/caveman) ?**
Oui, et vous devriez. Caveman réduit ce que l'agent dit ; ponytail réduit ce qu'il construit. Deux moitiés différentes, aucun chevauchement : caveman laisse le code exact à l'octet près, ponytail ne touche pas à la prose. Un discours concis sur du code minimal.

**Faut-il un fichier de configuration ?**
Non. Un `~/.config/ponytail/config.json` facultatif ou la variable d'environnement `PONYTAIL_DEFAULT_MODE` peut fixer le niveau par défaut, mais rien n'est obligatoire.

**Et si j'ai vraiment besoin de la classe de cache de 120 lignes ?**
Non. Insistez quand même et il la construira. Lentement. Correctement. En vous regardant.

**Est-ce que ça passe à l'échelle ?**
Le code que vous n'avez jamais écrit passe à l'échelle à l'infini. Zéro bug, zéro CVE, 100% de disponibilité depuis toujours.

**Pourquoi "ponytail" ?**
Vous savez très bien pourquoi.

## Sponsors

<p align="center">
  <a href="https://greenpt.com/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="../assets/logo-greenpt-dark.svg">
      <img src="../assets/logo-greenpt.svg" width="260" alt="GreenPT">
    </picture>
  </a>
</p>

## Licence

[MIT](../LICENSE). La licence la plus courte qui marche.

## Historique des étoiles

<a href="https://www.star-history.com/dietrichgebert/ponytail#history">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date" />
 </picture>
</a>
