<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/logo-dark.png">
    <img src="../assets/logo.png" width="220" alt="Ponytail, líný senior vývojář">
  </picture>
</p>

<h1 align="center">Ponytail</h1>

<p align="center">
  <em>Nic neříká. Napíše jeden řádek. Funguje to.</em>
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
  <img src="../assets/v5/hero.jpg" width="880" alt="Ponytail 5, přestavěný od základů: -53 % kódu, -41 % času, -26 % nákladů, -45 % tokenů. A přesto 98 % rizikové logiky má test, bez Ponytailu 68 %.">
</p>

<p align="center">
  <strong>Ponytail 5: přestavěný od základů.</strong><br>
  <strong>-53 % kódu &middot; -41 % času &middot; -26 % nákladů &middot; -45 % tokenů</strong><br>
  <strong>A přesto: 98 % rizikové logiky má test.</strong> Bez Ponytailu: 68 %.<br>
  <sub>Měřeno v Claude Code, stejný agent se skillem a bez něj: 39 úloh včetně skutečného repozitáře FastAPI + React, Opus 5.5, každá po 5 bězích. <a href="#numbers">Podrobnosti</a>.</sub>
</p>

<p align="center">
  <sub><a href="../README.md">English</a> &middot; <a href="README.es.md">Español</a> &middot; <a href="README.ko.md">한국어</a> &middot; <a href="README.zh-CN.md">简体中文</a> &middot; <a href="README.ja.md">日本語</a> &middot; <a href="README.pl.md">Polski</a> &middot; Čeština &middot; <a href="README.sk.md">Slovenčina</a></sub><br>
  <sub>Překlad anglického README. V případě rozporu platí <a href="../README.md">anglická verze</a>.</sub>
</p>

---

<p align="center">
  <a href="https://ponytail.dev/soon"><img src="../assets/waitlist-banner.png" alt="Něco se chystá, přidej se na čekací listinu" width="760"></a>
</p>

## Už postaveno s Ponytailem

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

Znáš ho. Dlouhý culík. Oválné brýle. Ve firmě je déle než správa verzí. Ukážeš mu padesát řádků; podívá se na ně, nic neřekne a nahradí je jedním.

Ponytail ho dostane do tvého AI agenta.

<a id="numbers"></a>
## Čísla

<p align="center">
  <img src="../assets/v5/chart.png" width="880" alt="Podíl vůči základu bez skillu. Řádky kódu: Ponytail v4.13 52 %, Ponytail 5 47 %. Výstupní tokeny: 57 % a 55 %. Náklady: 84 % a 74 %. Čas: 62 % a 59 %.">
</p>

<p align="center">
  <img src="../assets/v5/tests.png" width="880" alt="Poloviční kód, a přesto lepší: 98 % rizikové logiky má test (bez skillu 68 %); vlastní testy agenta zachytí 66 % vložených chyb (bez skillu 46 %).">
</p>

Dvě věci, které graf neukazuje: ve slepém srovnání porazily odpovědi Ponytailu 5 odpovědi předchozího Ponytailu 110 ku 67. A v šesti bezpečnostních úlohách (SQL injection, path traversal, padělané tokeny, rate limiting, poškozené řádky CSV, cachování) prošel všemi 30 běhy: méně kódu, bezpečnost stejná. Metoda, tabulky po úlohách a omezení: [benchmarks/results/2026-10-07-agentic.md](../benchmarks/results/2026-10-07-agentic.md).

**Pravidlem nikdy nebylo „co nejméně tokenů“.** Pravidlo zní: piš jen to, co úloha potřebuje, a nikdy neškrtej validaci, ošetření chyb, bezpečnost ani přístupnost. Kód vyjde malý, protože obsahuje jen to nutné, ne proto, že by byl uměle zkracovaný. Nižší náklady a latence jsou vedlejší efekt.

## Před / po

<p align="center">
  <img src="../assets/v5/beforeafter.png" width="880" alt="Přidej do frontendu výběr data. Bez skillu: 335 řádků, kalendář a výběr data postavené ručně. Ponytail 5: jeden soubor o 10 řádcích, který znovu použije Input z repozitáře s type date, takže kalendář dodá prohlížeč.">
</p>

Požádáš o výběr data. Bez Ponytailu agent nainstaluje knihovnu pro výběr data nebo ručně postaví celý kalendář: 335 řádků. Ponytail 5 se nejdřív podívá, co už existuje: repozitář má komponentu `Input` a každý prohlížeč má výběr data. Spojí obojí. 10 řádků.

Další přeživší v [examples/](../examples/).

## Review, přestavěné od základů

<p align="center">
  <img src="../assets/v5/review.png" width="880" alt="Review, přestavěné od základů. Skutečný nález /ponytail-review z benchmarku: změna přejmenovala pole a nedotčený soubor, src/routes/feed.js, teď padá. Nutné opravit: Atom feed teď padá při každém požadavku, s popisem, o co jde, v čem je problém, jak to opravit a co se stane, když to přeskočíme. Nalezeno 100 % nastražených problémů, bez skillu 87 %. Nalezeno 100 % problémů mimo diff, bez skillu 78 %.">
</p>

`/ponytail-review` dřív hledal jen kód k odstranění. Teď dělá review jako senior vývojář, kterého budí pager, když se něco rozbije: čte kód, kterého se tvoje změna dotýká, nejen diff, a kontroluje chyby, bezpečnost, reálnou zátěž, chybějící testy, rychlost a to, co se dá vyhodit. Každý nález říká, co kód dělá, co se pokazí, jak to opravit a co se stane, když to neopravíš.

## Audit, přestavěný od základů

<p align="center">
  <img src="../assets/v5/audit.png" width="880" alt="Celý tvůj repozitář seřazený podle důležitosti. Tohle oprav jako první. Skutečný /ponytail-audit z benchmarku na repozitáři skladových zásob: 1 nutné opravit, kancelářské dávky s 1200 položkami úplně selžou; 2 nutné opravit, import potichu přeskakuje chybné řádky; 3 nutné opravit, překlep v SKU v kancelářské dávce je potichu ignorován; 4 mělo by se opravit, rizikové části kódu nemají testy; 5 bylo by fajn, API spadne na těle požadavku, které není objekt. Verdikt: oprav nejdřív 1.">
</p>

`/ponytail-audit` spouští stejné kontroly na celém repozitáři. Nejdřív zmapuje kód: vstupní body, jak se pohybují data, jakou zátěž projekt očekává. Pak seřadí, co našel, podle důležitosti a řekne ti, co opravit jako první. Starý audit jen vypisoval, co smazat.

## Novinka v 5.3: lišta

<p align="center">
  <img src="../assets/band/band.png" width="880" alt="Lišta ponytail v Claude Code, nad promptem. Podrobný režim: cena $23.80, poslední tah $1.14, průměr $0.72 na tah; 56.7M tokenů, 168k výstupních, 33 tahů; čas agenta 52m 14s; znovupoužití 71 %, 5 použitých, 2 nové; testy prošly po poslední změně. Kompaktní režim ukazuje totéž na jednom řádku.">
</p>

V Claude Code teď ponytail ukazuje lištu nad promptem: kolik stojí aktuální úloha, kolik tokenů a času agenta spotřebovala, jak často znovu použila existující kód místo psaní nového a jestli testy prošly po poslední změně. Její tlačítka přepínají úroveň, spouštějí `/ponytail-review` nebo `/ponytail-audit`, kopírují úlohu jako Markdown a sbalí lištu na jeden řádek. Nechceš ji? `/ponytail band` ji skryje, stejný příkaz ji vrátí zpět. Vyžaduje Claude Code 2.1.290 nebo novější, v terminálu nebo v desktopové aplikaci. Nezobrazuje se v chatovém panelu VS Code, v cloudových relacích ani v `claude -p`.

<p align="center">
  <img src="../assets/band/board.png" width="880" alt="Board ponytail, lokální stránka: 61 relací, 20h 13m času agenta, $285.30 a 492.5M tokenů za posledních 30 dní; čas agenta podle projektu v průběhu času; nejnovější relace s jejich testy; aktivní dny a série.">
</p>

**Board** otevře lokální stránku se všemi úlohami napříč tvými projekty: náklady, čas agenta a tokeny v průběhu času, každá relace s jejími testy a dny, kdy se pracovalo. Ve výchozím nastavení všechno zůstává na tvém počítači, v `~/.config/ponytail/band/`. `/ponytail band import` do něj přidá tvoje dřívější relace Claude Code, s jejich náklady, časem agenta a tokeny.

## Jak to funguje

<p align="center">
  <img src="../assets/v5/ladder.png" width="880" alt="Než začneš psát kód, zastav se na první příčce, která obstojí: 1 musí to vůbec existovat, 2 už je to v tomto kódu, 3 umí to standardní knihovna, 4 nativní funkce platformy, 5 nainstalovaná závislost, 6 dá se to na jeden řádek, 7 teprve pak minimum, které funguje, plus jeden malý test, pokud je v tom logika.">
</p>

Žebřík běží *až poté*, co pochopí problém, ne místo toho: než vybere příčku, přečte kód, kterého se změna dotýká, a sleduje skutečný tok. Líný na řešení, nikdy na čtení.

Líný, ne nedbalý: validace na hranicích důvěry, ochrana před ztrátou dat, bezpečnost a přístupnost nikdy nejdou pod nůž.

Logika s větvením, cyklem, parserem, penězi nebo bezpečností po sobě nechá jeden malý test. Každá odpověď končí tím, co se přeskočilo nebo nezkontrolovalo, a každým rizikem, o kterém je dobré vědět.

## Prompt

Ponytail je jeden prompt: [`skills/ponytail/SKILL.md`](../skills/ponytail/SKILL.md). Kompaktní verze, pro agenty, kteří čtou soubor s pravidly, je [`AGENTS.md`](../AGENTS.md). Všechno ostatní v tomto repozitáři ten prompt načítá do různých agentů.

## Instalace

**Claude Code**, jako dva samostatné prompty:

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

Pak v Codexu otevři `/hooks`, důvěřuj jeho dvěma lifecycle hookům a začni nové vlákno.

**Jakýkoli jiný agent:** zkopíruj [`AGENTS.md`](../AGENTS.md) do svého projektu, nebo požádej svého agenta, ať nainstaluje [`skills/ponytail/SKILL.md`](../skills/ponytail/SKILL.md) jako skill. Krok za krokem pro Copilot, Cursor, OpenCode, Gemini a ostatní (anglicky): **[INSTALL.md](../INSTALL.md)**.

To bylo všechno. Byl by pyšný. Neřekne to.

Aktivní v každé relaci, s hrstkou příkazů (viz [Příkazy](#commands)). `/ponytail ultra` existuje pro chvíle, kdy ti kód osobně ublížil. Text při spuštění a při změně režimu ukazuje aktuální režim.

Instaluj ponytail jen z `DietrichGebert/ponytail` na GitHubu nebo `@dietrichgebert/ponytail` na npm. Nikdy neobsahuje soubory `.exe` ani `.dll`; kopie, která je obsahuje, není moje.

<a id="commands"></a>
## Příkazy

| Příkaz | Co dělá |
|--------|---------|
| `/ponytail [lite \| full \| ultra \| off]` | Nastaví intenzitu nebo ho vypne. Bez argumentu zapne ponytail na výchozí úrovni, pokud je vypnutý, jinak oznámí aktuální úroveň. |
| `/ponytail band [on \| off]` | Jen Claude Code: skryje nebo zobrazí lištu nad promptem. Bez argumentu přepne. Úroveň zůstává. |
| `/ponytail band import` | Jen Claude Code: přidá tvoje dřívější relace Claude Code na board, s jejich náklady, časem agenta a tokeny. |
| `/ponytail-review` | Zkontroluje aktuální diff jako senior vývojář, kterého budí pager, když se něco rozbije: chyby, bezpečnost, reálná zátěž, rizikový kód bez testu, pomalé cesty a co se dá vyhodit. Každý nález říká, co kód dělá, co se pokazí, jak to opravit a co se stane, když to neopravíš. Cíl můžeš zúžit nebo rozšířit běžnými slovy: `uncommitted`, `staged`, `branch` nebo odkaz na PR. |
| `/ponytail-audit` | Stejná kontrola pro celý repozitář, nejdůležitější věci jako první. |
| `/ponytail-debt` | Sesbírá odložené komentáře `shortcut:` do evidence, aby se z „později“ nestalo „nikdy“. |
| `/ponytail-gain` | Ukáže tabulku naměřeného dopadu (méně kódu, nižší náklady, vyšší rychlost) z benchmarku. |
| `/ponytail-help` | Rychlý přehled výše uvedených příkazů. |

Příkazy vyžadují hostitele s podporou skillů (Claude Code, Codex, Devin CLI, OpenCode, Gemini, Antigravity CLI, pi, Hermes Agent, Qoder, Grok Build). V Codex CLI a rozšíření pro IDE jsou to skilly ve jmenném prostoru pluginu; volají se přes `$ponytail:ponytail-review`. Cursor s [hooky](../INSTALL.md#cursor) má jen přepínání úrovně přes `/ponytail`, psané jako běžná zpráva. Adaptéry založené jen na instrukcích (soubor pravidel Cursoru, Windsurf, Cline, Copilot, Kiro, záložní `AGENTS.md` v Antigravity) načítají vždy aktivní sadu pravidel bez příkazů.

## Časté otázky

**Potřebuje konfigurační soubor?**
Ne. Výchozí úroveň může nastavit volitelný `~/.config/ponytail/config.json` nebo proměnná prostředí `PONYTAIL_DEFAULT_MODE`, ale nic z toho není nutné.

**Proč píše komentáře `shortcut:`?**
Označují záměrnou zkratku a kdy se k ní vrátit, a `/ponytail-debt` je sesbírá do evidence. Chceš jiné slovo, nebo žádné? Napiš to do `CLAUDE.md` nebo `AGENTS.md` svého projektu a pak spusť `/ponytail-debt <tvoje slovo>`.

**Co když tu 120řádkovou cache třídu opravdu potřebuju?**
Nepotřebuješ. Když budeš trvat na svém, postaví ji. Pomalu. Správně. A bude se přitom na tebe dívat.

**Škáluje to?**
Kód, který nikdy nevznikl, škáluje do nekonečna. Nula chyb, nula CVE, 100% dostupnost odjakživa.

**Proč „ponytail“?**
Moc dobře víš proč.

## Sponzoři

<p align="center">
  <a href="https://greenpt.com/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="../assets/logo-greenpt-dark.svg">
      <img src="../assets/logo-greenpt.svg" width="260" alt="GreenPT">
    </picture>
  </a>
</p>

## Licence

[MIT](../LICENSE). Nejkratší licence, která funguje.

## Historie hvězdiček

<a href="https://www.star-history.com/dietrichgebert/ponytail#history">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date" />
 </picture>
</a>
