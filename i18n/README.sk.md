<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/logo-dark.png">
    <img src="../assets/logo.png" width="220" alt="Ponytail, lenivý senior vývojár">
  </picture>
</p>

<h1 align="center">Ponytail</h1>

<p align="center">
  <em>Nič nehovorí. Napíše jeden riadok. Funguje to.</em>
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
  <img src="../assets/v5/hero.jpg" width="880" alt="Ponytail 5, prebudovaný od základov: -53 % kódu, -41 % času, -26 % nákladov, -45 % tokenov. A predsa 98 % rizikovej logiky má test, bez Ponytailu 68 %.">
</p>

<p align="center">
  <strong>Ponytail 5: prebudovaný od základov.</strong><br>
  <strong>-53 % kódu &middot; -41 % času &middot; -26 % nákladov &middot; -45 % tokenov</strong><br>
  <strong>A predsa: 98 % rizikovej logiky má test.</strong> Bez Ponytailu: 68 %.<br>
  <sub>Merané v Claude Code, ten istý agent so skillom a bez neho: 39 úloh vrátane skutočného repozitára FastAPI + React, Opus 5.5, každá po 5 behoch. <a href="#numbers">Podrobnosti</a>.</sub>
</p>

<p align="center">
  <sub><a href="../README.md">English</a> &middot; <a href="README.es.md">Español</a> &middot; <a href="README.ko.md">한국어</a> &middot; <a href="README.zh-CN.md">简体中文</a> &middot; <a href="README.ja.md">日本語</a> &middot; <a href="README.pl.md">Polski</a> &middot; <a href="README.cs.md">Čeština</a> &middot; Slovenčina</sub><br>
  <sub>Preklad anglického README. V prípade rozporu platí <a href="../README.md">anglická verzia</a>.</sub>
</p>

---

<p align="center">
  <a href="https://ponytail.dev/soon"><img src="../assets/waitlist-banner.png" alt="Niečo sa chystá, pridaj sa na čakaciu listinu" width="760"></a>
</p>

## Už postavené s Ponytailom

<a href="https://theretriever.app">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/retriever-logo-dark.svg">
    <img src="../assets/retriever-logo-light.svg" height="128" alt="Retriever">
  </picture>
</a>
<a href="https://photoreunion.app/?ref=ponytail-gh">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/photoreunion-logo-dark.svg">
    <img src="../assets/photoreunion-logo-light.svg" height="128" alt="PhotoReunion">
  </picture>
</a>

---

Poznáš ho. Dlhý konský chvost. Oválne okuliare. Vo firme je dlhšie ako správa verzií. Ukážeš mu päťdesiat riadkov; pozrie sa na ne, nič nepovie a nahradí ich jedným.

Ponytail ho dostane do tvojho AI agenta.

<a id="numbers"></a>
## Čísla

<p align="center">
  <img src="../assets/v5/chart.png" width="880" alt="Podiel voči základu bez skillu. Riadky kódu: Ponytail v4.13 52 %, Ponytail 5 47 %. Výstupné tokeny: 57 % a 55 %. Náklady: 84 % a 74 %. Čas: 62 % a 59 %.">
</p>

<p align="center">
  <img src="../assets/v5/tests.png" width="880" alt="Polovica kódu, a predsa lepšie: 98 % rizikovej logiky má test (bez skillu 68 %); vlastné testy agenta zachytia 66 % vložených chýb (bez skillu 46 %).">
</p>

Dve veci, ktoré graf neukazuje: v slepom porovnaní porazili odpovede Ponytailu 5 odpovede predchádzajúceho Ponytailu 110 ku 67. A v šiestich bezpečnostných úlohách (SQL injection, path traversal, sfalšované tokeny, rate limiting, poškodené riadky CSV, cachovanie) prešiel všetkými 30 behmi: menej kódu, bezpečnosť rovnaká. Metóda, tabuľky po úlohách a obmedzenia: [benchmarks/results/2026-10-07-agentic.md](../benchmarks/results/2026-10-07-agentic.md).

**Pravidlom nikdy nebolo „čo najmenej tokenov“.** Pravidlo znie: píš len to, čo úloha potrebuje, a nikdy neškrtaj validáciu, ošetrenie chýb, bezpečnosť ani prístupnosť. Kód vyjde malý, lebo obsahuje len to nevyhnutné, nie preto, že by bol umelo skracovaný. Nižšie náklady a latencia sú vedľajší efekt.

## Pred / po

<p align="center">
  <img src="../assets/v5/beforeafter.png" width="880" alt="Pridaj do frontendu výber dátumu. Bez skillu: 335 riadkov, kalendár a výber dátumu postavené ručne. Ponytail 5: jeden súbor s 10 riadkami, ktorý znovu použije Input z repozitára s type date, takže kalendár dodá prehliadač.">
</p>

Požiadaš o výber dátumu. Bez Ponytailu agent nainštaluje knižnicu na výber dátumu alebo ručne postaví celý kalendár: 335 riadkov. Ponytail 5 sa najprv pozrie, čo už existuje: repozitár má komponent `Input` a každý prehliadač má výber dátumu. Spojí oboje. 10 riadkov.

Ďalší preživší v [examples/](../examples/).

## Review, prebudované od základov

<p align="center">
  <img src="../assets/v5/review.png" width="880" alt="Review, prebudované od základov. Skutočný nález /ponytail-review z benchmarku: zmena premenovala pole a nedotknutý súbor, src/routes/feed.js, teraz padá. Nutné opraviť: Atom feed teraz padá pri každej požiadavke, s popisom, o čo ide, v čom je problém, ako to opraviť a čo sa stane, keď to preskočíme. Nájdených 100 % nastražených problémov, bez skillu 87 %. Nájdených 100 % problémov mimo diffu, bez skillu 78 %.">
</p>

`/ponytail-review` kedysi hľadal len kód na odstránenie. Teraz robí review ako senior vývojár, ktorého budí pager, keď sa niečo pokazí: číta kód, ktorého sa tvoja zmena dotýka, nielen diff, a kontroluje chyby, bezpečnosť, reálnu záťaž, chýbajúce testy, rýchlosť a to, čo sa dá vyhodiť. Každý nález hovorí, čo kód robí, čo sa pokazí, ako to opraviť a čo sa stane, keď to neopravíš.

## Audit, prebudovaný od základov

<p align="center">
  <img src="../assets/v5/audit.png" width="880" alt="Celý tvoj repozitár zoradený podľa dôležitosti. Toto oprav ako prvé. Skutočný /ponytail-audit z benchmarku na repozitári skladových zásob: 1 nutné opraviť, kancelárske dávky s 1200 položkami úplne zlyhajú; 2 nutné opraviť, import potichu preskakuje chybné riadky; 3 nutné opraviť, preklep v SKU v kancelárskej dávke sa potichu ignoruje; 4 malo by sa opraviť, rizikové časti kódu nemajú testy; 5 bolo by fajn, API spadne na tele požiadavky, ktoré nie je objekt. Verdikt: oprav najprv 1.">
</p>

`/ponytail-audit` spúšťa rovnaké kontroly na celom repozitári. Najprv zmapuje kód: vstupné body, ako sa pohybujú dáta, akú záťaž projekt očakáva. Potom zoradí, čo našiel, podľa dôležitosti a povie ti, čo opraviť ako prvé. Starý audit len vypisoval, čo zmazať.

## Novinka v 5.3: lišta

<p align="center">
  <img src="../assets/band/band.png" width="880" alt="Lišta ponytail v Claude Code, nad promptom. Podrobný režim: cena $23.80, posledný ťah $1.14, priemer $0.72 na ťah; 56.7M tokenov, 168k výstupných, 33 ťahov; čas agenta 52m 14s; opätovné použitie 71 %, 5 použitých, 2 nové; testy prešli po poslednej zmene. Kompaktný režim ukazuje to isté na jednom riadku.">
</p>

V Claude Code teraz ponytail ukazuje lištu nad promptom: koľko stojí aktuálna úloha, koľko tokenov a času agenta spotrebovala, ako často znovu použila existujúci kód namiesto písania nového a či testy prešli po poslednej zmene. Jej tlačidlá prepínajú úroveň, spúšťajú `/ponytail-review` alebo `/ponytail-audit`, kopírujú úlohu ako Markdown a zbalia lištu na jeden riadok. Nechceš ju? `/ponytail band` ju skryje, ten istý príkaz ju vráti späť. Vyžaduje Claude Code 2.1.290 alebo novší, v termináli alebo v desktopovej aplikácii. Nezobrazuje sa v chatovom paneli VS Code, v cloudových reláciách ani v `claude -p`.

<p align="center">
  <img src="../assets/band/board.png" width="880" alt="Board ponytail, lokálna stránka: 61 relácií, 20h 13m času agenta, $285.30 a 492.5M tokenov za posledných 30 dní; čas agenta podľa projektu v priebehu času; najnovšie relácie s ich testami; aktívne dni a séria.">
</p>

**Board** otvorí lokálnu stránku so všetkými úlohami naprieč tvojimi projektmi: náklady, čas agenta a tokeny v priebehu času, každá relácia s jej testami a dni, keď sa pracovalo. Predvolene všetko zostáva na tvojom počítači, v `~/.config/ponytail/band/`. `/ponytail band import` doň pridá tvoje staršie relácie Claude Code, s ich nákladmi, časom agenta a tokenmi.

## Ako to funguje

<p align="center">
  <img src="../assets/v5/ladder.png" width="880" alt="Skôr než začneš písať kód, zastav sa na prvej priečke, ktorá obstojí: 1 musí to vôbec existovať, 2 už je to v tomto kóde, 3 dokáže to štandardná knižnica, 4 natívna funkcia platformy, 5 nainštalovaná závislosť, 6 dá sa to na jeden riadok, 7 až potom minimum, ktoré funguje, plus jeden malý test, ak je v tom logika.">
</p>

Rebrík beží *až potom*, čo pochopí problém, nie namiesto toho: skôr než vyberie priečku, prečíta kód, ktorého sa zmena dotýka, a sleduje skutočný tok. Lenivý na riešenie, nikdy na čítanie.

Lenivý, nie nedbalý: validácia na hraniciach dôvery, ochrana pred stratou dát, bezpečnosť a prístupnosť nikdy nejdú pod nôž.

Logika s vetvením, cyklom, parserom, peniazmi alebo bezpečnosťou po sebe nechá jeden malý test. Každá odpoveď končí tým, čo sa preskočilo alebo neskontrolovalo, a každým rizikom, o ktorom je dobré vedieť.

## Prompt

Ponytail je jeden prompt: [`skills/ponytail/SKILL.md`](../skills/ponytail/SKILL.md). Kompaktná verzia, pre agentov, ktorí čítajú súbor s pravidlami, je [`AGENTS.md`](../AGENTS.md). Všetko ostatné v tomto repozitári ten prompt načítava do rôznych agentov.

## Inštalácia

**Claude Code**, ako dva samostatné prompty:

```
/plugin marketplace add DietrichGebert/ponytail
```
```
/plugin install ponytail@ponytail
```

**Codex:**

```bash
codex plugin marketplace add DietrichGebert/ponytail
codex plugin add ponytail@ponytail
```

Potom v Codexe otvor `/hooks`, dôveruj jeho dvom lifecycle hookom a začni nové vlákno.

**Akýkoľvek iný agent:** skopíruj [`AGENTS.md`](../AGENTS.md) do svojho projektu, alebo požiadaj svojho agenta, nech nainštaluje [`skills/ponytail/SKILL.md`](../skills/ponytail/SKILL.md) ako skill. Krok za krokom pre Copilot, Cursor, OpenCode, Gemini a ostatné (po anglicky): **[INSTALL.md](../INSTALL.md)**.

To bolo všetko. Bol by hrdý. Nepovie to.

Aktívny v každej relácii, s hŕstkou príkazov (pozri [Príkazy](#commands)). `/ponytail ultra` existuje pre chvíle, keď ti kód osobne ublížil. Text pri spustení a pri zmene režimu ukazuje aktuálny režim.

Inštaluj ponytail len z `DietrichGebert/ponytail` na GitHube alebo `@dietrichgebert/ponytail` na npm. Nikdy neobsahuje súbory `.exe` ani `.dll`; kópia, ktorá ich obsahuje, nie je moja.

<a id="commands"></a>
## Príkazy

| Príkaz | Čo robí |
|--------|---------|
| `/ponytail [lite \| full \| ultra \| off]` | Nastaví intenzitu alebo ho vypne. Bez argumentu zapne ponytail na predvolenej úrovni, ak je vypnutý, inak oznámi aktuálnu úroveň. |
| `/ponytail band [on \| off]` | Len Claude Code: skryje alebo zobrazí lištu nad promptom. Bez argumentu prepne. Úroveň zostáva. |
| `/ponytail band import` | Len Claude Code: pridá tvoje staršie relácie Claude Code na board, s ich nákladmi, časom agenta a tokenmi. |
| `/ponytail-review` | Skontroluje aktuálny diff ako senior vývojár, ktorého budí pager, keď sa niečo pokazí: chyby, bezpečnosť, reálna záťaž, rizikový kód bez testu, pomalé cesty a čo sa dá vyhodiť. Každý nález hovorí, čo kód robí, čo sa pokazí, ako to opraviť a čo sa stane, keď to neopravíš. Cieľ môžeš zúžiť alebo rozšíriť bežnými slovami: `uncommitted`, `staged`, `branch` alebo odkaz na PR. |
| `/ponytail-audit` | Rovnaká kontrola pre celý repozitár, najdôležitejšie veci ako prvé. |
| `/ponytail-debt` | Zozbiera odložené komentáre `shortcut:` do evidencie, aby sa z „neskôr“ nestalo „nikdy“. |
| `/ponytail-gain` | Ukáže tabuľku nameraného dopadu (menej kódu, nižšie náklady, vyššia rýchlosť) z benchmarku. |
| `/ponytail-help` | Rýchly prehľad vyššie uvedených príkazov. |

Príkazy vyžadujú hostiteľa s podporou skillov (Claude Code, Codex, Devin CLI, OpenCode, Gemini, Antigravity CLI, pi, Hermes Agent, Qoder, Grok Build). V Codex CLI a rozšírení pre IDE sú to skilly v mennom priestore pluginu; volajú sa cez `$ponytail:ponytail-review`. Cursor s [hookmi](../INSTALL.md#cursor) má len prepínanie úrovne cez `/ponytail`, písané ako bežná správa. Adaptéry založené len na inštrukciách (súbor pravidiel Cursora, Windsurf, Cline, Copilot, Kiro, záložný `AGENTS.md` v Antigravity) načítavajú vždy aktívnu sadu pravidiel bez príkazov.

## Časté otázky

**Potrebuje konfiguračný súbor?**
Nie. Predvolenú úroveň môže nastaviť voliteľný `~/.config/ponytail/config.json` alebo premenná prostredia `PONYTAIL_DEFAULT_MODE`, ale nič z toho nie je nutné.

**Prečo píše komentáre `shortcut:`?**
Označujú zámernú skratku a kedy sa k nej vrátiť, a `/ponytail-debt` ich zozbiera do evidencie. Chceš iné slovo, alebo žiadne? Napíš to do `CLAUDE.md` alebo `AGENTS.md` svojho projektu a potom spusti `/ponytail-debt <tvoje slovo>`.

**Čo ak tú 120-riadkovú cache triedu naozaj potrebujem?**
Nepotrebuješ. Keď budeš trvať na svojom, postaví ju. Pomaly. Správne. A bude sa pritom na teba pozerať.

**Škáluje to?**
Kód, ktorý nikdy nevznikol, škáluje do nekonečna. Nula chýb, nula CVE, 100 % dostupnosť odjakživa.

**Prečo „ponytail“?**
Veľmi dobre vieš prečo.

## Sponzori

<p align="center">
  <a href="https://greenpt.com/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="../assets/logo-greenpt-dark.svg">
      <img src="../assets/logo-greenpt.svg" width="260" alt="GreenPT">
    </picture>
  </a>
</p>

## Licencia

[MIT](../LICENSE). Najkratšia licencia, ktorá funguje.

## História hviezdičiek

<a href="https://www.star-history.com/dietrichgebert/ponytail#history">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date" />
 </picture>
</a>
