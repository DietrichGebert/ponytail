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
  <img src="../assets/v5/hero.jpg" width="880" alt="Ponytail 5, reconstruit de zéro : -53% de code, -41% de temps, -26% de coût, -45% de tokens. Et pourtant 98% de la logique à risque part avec un test ; sans Ponytail, 68%.">
</p>

<p align="center">
  <strong>Ponytail 5 : reconstruit de zéro.</strong><br>
  <strong>-53% de code &middot; -41% de temps &middot; -26% de coût &middot; -45% de tokens</strong><br>
  <strong>Et pourtant : 98% de la logique à risque part avec un test.</strong> Sans Ponytail : 68%.<br>
  <sub>Mesuré dans Claude Code, le même agent avec et sans le skill : 39 tâches, dont un vrai dépôt FastAPI + React, Opus 5.5, 5 runs chacune. <a href="#numbers">Détails</a>.</sub>
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

Vous le connaissez. Long ponytail. Lunettes ovales. Il est dans la boîte depuis plus longtemps que le gestionnaire de versions. Vous lui montrez cinquante lignes ; il les regarde, ne dit rien, et les remplace par une seule.

Ponytail le met dans votre agent IA.

<a id="numbers"></a>
## Chiffres

<p align="center">
  <img src="../assets/v5/chart.png" width="880" alt="Part de la référence sans skill. Lignes de code : Ponytail v4.13 52%, Ponytail 5 47%. Tokens de sortie : 57% et 55%. Coût : 84% et 74%. Temps : 62% et 59%.">
</p>

<p align="center">
  <img src="../assets/v5/tests.png" width="880" alt="Moitié moins de code, et pourtant mieux : 98% de la logique à risque part avec un test (sans skill 68%) ; les propres tests de l'agent attrapent 66% des bugs injectés (sans skill 46%).">
</p>

Deux choses que le graphique ne montre pas : dans une comparaison à l'aveugle, les réponses de Ponytail 5 battent celles du Ponytail précédent 110 à 67. Et sur les six tâches de sécurité (injection SQL, path traversal, jetons falsifiés, limitation de débit, lignes CSV malformées, cache), il a réussi les 30 runs : moins de code, pas moins sûr. Méthode, tableaux par tâche et limites : [benchmarks/results/2026-10-07-agentic.md](../benchmarks/results/2026-10-07-agentic.md).

**La règle n'a jamais été "le moins de tokens possible".** C'est : écrire seulement ce dont la tâche a besoin, et ne jamais couper la validation, la gestion d'erreurs, la sécurité ou l'accessibilité. Le code finit petit parce qu'il est nécessaire, pas parce qu'il est compressé à l'extrême. Un coût et une latence plus bas sont un effet de bord.

## Avant / après

<p align="center">
  <img src="../assets/v5/beforeafter.png" width="880" alt="Ajouter un sélecteur de date au frontend. Sans skill : 335 lignes, un calendrier et un sélecteur de date écrits à la main. Ponytail 5 : un fichier de 10 lignes qui réutilise l'Input du dépôt avec type date, et le navigateur fournit le calendrier.">
</p>

Vous demandez un sélecteur de date. Sans Ponytail, l'agent installe une bibliothèque de sélecteur de date ou écrit tout un calendrier à la main : 335 lignes. Ponytail 5 regarde d'abord ce qui existe déjà : le dépôt a un composant `Input`, et tous les navigateurs ont un sélecteur de date. Il assemble les deux. 10 lignes.

D'autres rescapés dans [examples/](../examples/).

## La revue, reconstruite

<p align="center">
  <img src="../assets/v5/review.png" width="880" alt="La revue, reconstruite. Un vrai constat de /ponytail-review tiré du benchmark : le changement a renommé un champ, et un fichier non modifié, src/routes/feed.js, plante désormais. À corriger : le flux Atom plante maintenant à chaque requête, avec ce que c'est, le problème, le correctif et ce qui arrive si on laisse passer. 100% des problèmes plantés trouvés, sans skill 87%. 100% des problèmes hors du diff trouvés, sans skill 78%.">
</p>

`/ponytail-review` ne cherchait que du code à couper. Maintenant il relit comme le senior dev qu'on réveille quand ça casse : il lit le code que votre changement touche, pas seulement le diff, et vérifie les bugs, la sécurité, la charge réelle, les tests manquants, la vitesse et ce qui est en trop. Chaque constat dit ce que fait le code, ce qui ne va pas, comment le corriger et ce qui arrive si on ne le fait pas.

## L'audit, reconstruit

<p align="center">
  <img src="../assets/v5/audit.png" width="880" alt="Tout votre dépôt, classé. À corriger en premier. Un vrai /ponytail-audit tiré du benchmark sur un dépôt de stock d'entrepôt : 1 à corriger, les lots de bureau de 1 200 échouent complètement ; 2 à corriger, l'import ignore en silence les lignes erronées ; 3 à corriger, un SKU mal saisi dans un lot de bureau est ignoré en silence ; 4 à corriger ensuite, les chemins de code à risque n'ont pas de tests ; 5 souhaitable, l'API plante sur un corps qui n'est pas un objet. Verdict : corriger le 1 d'abord.">
</p>

`/ponytail-audit` fait les mêmes vérifications sur tout le dépôt. Il cartographie d'abord le code : points d'entrée, circulation des données, charge attendue par le projet. Puis il classe ce qu'il trouve et vous dit quoi corriger en premier. L'ancien audit se contentait de lister ce qu'il fallait supprimer.

## Comment ça marche

<p align="center">
  <img src="../assets/v5/ladder.png" width="880" alt="Avant d'écrire du code, s'arrêter au premier barreau qui tient : 1 faut-il que ça existe, 2 déjà dans ce code, 3 la bibliothèque standard le fait-elle, 4 une fonction native de la plateforme, 5 une dépendance installée, 6 peut-il tenir en une ligne, 7 seulement alors le minimum qui marche, plus un petit test s'il y a de la logique.">
</p>

L'échelle intervient *après* avoir compris le problème, pas à sa place : l'agent lit le code que le changement touche et suit le vrai flux avant de choisir un barreau. Paresseux sur la solution, jamais sur la lecture.

Paresseux, pas négligent : la validation aux frontières de confiance, la gestion des pertes de données, la sécurité et l'accessibilité ne passent jamais à la trappe.

Une logique avec une condition, une boucle, un parseur, de l'argent ou de la sécurité laisse derrière elle un petit test. Chaque réponse se termine par ce qui a été sauté ou non vérifié et par tout risque à connaître.

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

<a id="commands"></a>
## Commandes

| Commande | Ce qu'elle fait |
|---------|--------------|
| `/ponytail [lite \| full \| ultra \| off]` | Règle l'intensité, ou coupe ponytail. Sans argument, active ponytail au niveau par défaut s'il est coupé, et sinon indique le niveau en cours. |
| `/ponytail-review` | Relit le diff en cours comme le senior dev qu'on réveille quand ça casse : bugs, sécurité, charge réelle, code à risque sans test, chemins lents et ce qui est en trop. Chaque constat dit ce que fait le code, ce qui ne va pas, comment le corriger et ce qui arrive si on ne le fait pas. Nommez une cible en clair pour réduire ou élargir : `uncommitted`, `staged`, `branch`, ou un lien de PR. |
| `/ponytail-audit` | La même vérification pour tout le dépôt, le plus important d'abord. |
| `/ponytail-debt` | Rassemble les raccourcis `ponytail:` que vous avez remis à plus tard dans un registre, pour que "plus tard" ne devienne pas "jamais". |
| `/ponytail-gain` | Affiche le tableau de l'impact mesuré par le benchmark (moins de code, moins de coût, plus de vitesse). |
| `/ponytail-help` | Aide-mémoire des commandes ci-dessus. |

Les commandes demandent un hôte qui gère les skills (Claude Code, Codex, Devin CLI, OpenCode, Gemini, pi, Hermes Agent, Qoder, Grok Build). Dans Codex CLI et l'extension IDE, ce sont des skills dans l'espace de noms du plugin ; on les appelle avec `$ponytail:ponytail-review`. Cursor avec les [hooks](../INSTALL.md#cursor) n'a que le changement de niveau `/ponytail`, tapé comme un message normal. Les adaptateurs à instructions seules (fichier de règles de Cursor, Windsurf, Cline, Copilot, Kiro, Antigravity) chargent les règles toujours actives, sans les commandes.

## FAQ

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
