<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.png">
    <img src="assets/logo.png" width="220" alt="Ponytail, el senior dev flojo">
  </picture>
</p>

<h1 align="center">Ponytail</h1>

<p align="center">
  <em>No dice nada. Escribe una línea. Funciona.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/DietrichGebert/ponytail?style=flat-square&color=111111&label=stars" alt="Stars">
  <img src="https://img.shields.io/github/v/release/DietrichGebert/ponytail?style=flat-square&color=111111&label=release" alt="Release">
  <img src="https://img.shields.io/badge/funciona%20con-13%20agentes-111111?style=flat-square" alt="Works with 13 agents">
  <img src="https://img.shields.io/badge/licencia-MIT-111111?style=flat-square" alt="MIT license">
</p>

<p align="center">
  <strong>80-94% menos código &middot; 3-6&times; más rápido &middot; 47-77% más barato</strong><br>
  <sub>Mediana de 10 ejecuciones con Haiku, Sonnet y Opus. <a href="benchmarks/">Reprodúcelo tú mismo.</a></sub>
</p>

---

Lo conoces. Cola de caballo larga. Lentes ovalados. Lleva más tiempo en la empresa que el control de versiones. Le muestras cincuenta líneas; las mira, no dice nada, y las reemplaza por una.

Ponytail lo pone dentro de tu agente de IA.

## Antes / después

Le pides un selector de fechas. Tu agente instala flatpickr, escribe un componente wrapper, agrega un stylesheet, y empieza una discusión sobre zonas horarias.

Con ponytail:

```html
<!-- ponytail: el browser ya tiene uno -->
<input type="date">
```

Más sobrevivientes en [examples/](examples/).

## Números

Cinco tareas del día a día (validador de email, debounce, suma de CSV, temporizador, rate limiter), tres modelos, tres variantes: sin skill, el skill [caveman](https://github.com/JuliusBrussee/caveman), y ponytail. Diez ejecuciones por celda, mediana reportada.

<p align="center">
  <img src="assets/benchmark-3model.svg" width="860" alt="Mediana de líneas de código por variante en Haiku, Sonnet y Opus; ponytail escribe 80-94% menos código que el baseline sin skill">
</p>

**80-94% menos código, 47-77% menos costo, y 3-6× más rápido que un agente sin skill, en todos los modelos.** Cada atajo que toma ponytail queda marcado en el código con un comentario `ponytail:` que nombra la ruta de actualización. Reprodúcelo: `npx promptfoo eval -c benchmarks/promptfooconfig.yaml`. Método y números completos: [benchmarks/](benchmarks/). Tareas de nivel producción, donde un agente sin restricciones se infla mucho más, están documentadas en [benchmarks/results/](benchmarks/results/).

## Cómo funciona

Antes de escribir código, el agente se detiene en el primer peldaño que aguanta:

```
1. ¿Necesita existir esto?        → no: omitirlo (YAGNI)
2. ¿Lo hace la stdlib?            → úsala
3. ¿Es una feature nativa?        → úsala
4. ¿Una dependencia ya instalada? → úsala
5. ¿Cabe en una línea?            → una línea
6. Solo entonces: el mínimo que funciona
```

Flojo, no negligente: la validación en límites de confianza, el manejo de pérdida de datos, la seguridad y la accesibilidad nunca están en riesgo.

## Instalación

El mayor esfuerzo que ponytail te va a pedir:

Los plugins de Claude Code y Codex ejecutan dos pequeños lifecycle hooks de Node.js, así que `node` debe estar en tu PATH (nota para usuarios de Nix/nvm: debe estar en el PATH del shell no-interactivo). Si no lo está, los skills igualmente funcionan — la activación automática simplemente queda en silencio en vez de lanzar un error en cada prompt.

### Claude Code

```
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

### Codex

```bash
codex plugin marketplace add DietrichGebert/ponytail
codex
```

Abre `/plugins`, selecciona el marketplace de Ponytail e instala Ponytail. Luego abre `/hooks`, revisa y autoriza sus dos lifecycle hooks, y empieza un nuevo hilo.

Esta misma instalación cubre también la app de escritorio de Codex: reinicia la app después de instalar y detecta el plugin automáticamente.

### GitHub Copilot CLI

```bash
copilot plugin marketplace add DietrichGebert/ponytail
copilot plugin install ponytail@ponytail
```

En una sesión interactiva de Copilot CLI, usa los equivalentes con slash:

```
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

Copilot CLI agrupa los comandos del plugin bajo el nombre del plugin. Por ejemplo:

```text
/ponytail:ponytail ultra
/ponytail:ponytail-review
```

### Pi agent harness

```
pi install git:github.com/DietrichGebert/ponytail
```

### OpenCode

Ejecuta OpenCode desde un checkout de este repo (el plugin reutiliza sus `hooks/` y `skills/`), y agrega esto a `opencode.json`:

```json
{ "plugin": ["./.opencode/plugins/ponytail.mjs"] }
```

Inyecta el ruleset en cada turno con el nivel activo; agrega los comandos `/ponytail` (ver [Comandos](#comandos)). OpenCode también carga automáticamente el `AGENTS.md` de este repo, así que las reglas aplican incluso sin el plugin. El plugin agrega los niveles `lite/full/ultra/off`.

El path `./` se resuelve contra el `opencode.json` de tu proyecto; para compartir un único checkout entre proyectos, apunta al path absoluto del `.mjs` (encuentra sus `hooks/` y `skills/` relativo a su propio archivo).

### Gemini CLI

```bash
gemini extensions install https://github.com/DietrichGebert/ponytail
```

Carga el ruleset como contexto permanente en cada sesión y registra los comandos `/ponytail`; los `skills/` también se incluyen, activados cuando una tarea los necesita.

### Antigravity CLI

Google está renombrando Gemini CLI a Antigravity CLI (el binario `agy`); la misma extensión se instala ahí:

```bash
agy plugin install https://github.com/DietrichGebert/ponytail
```

Reutiliza el `gemini-extension.json` de este repo. Una diferencia: Antigravity convierte los comandos `/ponytail` en skills, así que los escribes en el chat (por ejemplo `/ponytail-review` como mensaje) en vez de seleccionarlos de un menú slash. Hasta que la migración se complete (alrededor del 18 de junio de 2026), `gemini extensions install` también funciona. Para usarlo como regla permanente, coloca el ruleset en `.agents/rules/`.

### OpenClaw

```bash
clawhub install ponytail
```

Instala ponytail como skill de OpenClaw desde ClawHub; los skills de review, audit, debt y help se instalan igual (`clawhub install ponytail-review`, etc.). OpenClaw lo aplica en tareas de código y también lo expone como comando `/ponytail`. Sin ClawHub, copia [`.openclaw/skills/ponytail`](.openclaw/skills/) a `~/.openclaw/skills/`.

Eso fue todo. Él estaría orgulloso. No lo va a decir.

Activo en cada sesión, con un puñado de comandos (ver [Comandos](#comandos)). `/ponytail ultra` existe para cuando el codebase te hizo algo personal. El texto de inicio y de cambio de modo muestra el nivel activo.

Configura el nivel para cada nueva sesión con la variable de entorno `PONYTAIL_DEFAULT_MODE` (`lite`/`full`/`ultra`/`off`), o con un campo `defaultMode` en `~/.config/ponytail/config.json` (`%APPDATA%\ponytail\config.json` en Windows). El default es `full`.

Cursor, Windsurf, Cline, GitHub Copilot (editor), Aider, Kiro: copia el archivo de reglas correspondiente de este repo ([`.cursor/rules/`](.cursor/rules/), [`.windsurf/rules/`](.windsurf/rules/), [`.clinerules/`](.clinerules/), [`.github/copilot-instructions.md`](.github/copilot-instructions.md), [`AGENTS.md`](AGENTS.md), [`.kiro/steering/`](.kiro/steering/)).

Kiro: copia `.kiro/steering/ponytail.md` a `~/.kiro/steering/` (global) o `.kiro/steering/` en tu proyecto.

Fallback de GitHub Copilot CLI (modo solo instrucciones): lee `AGENTS.md` y `.github/copilot-instructions.md` en un proyecto, o copia las reglas a `~/.copilot/copilot-instructions.md` para ejecutar ponytail en todos tus proyectos. Esta vía mantiene la guía permanente, pero no agrega switches de modo ni hooks.

VS Code con la extensión Codex lee `AGENTS.md`, que este repo incluye, así que funciona desde la raíz del repo sin configuración adicional (`~/.codex/AGENTS.md` hace a Codex global).

Qué archivos corresponden a qué agente: [Portabilidad de agentes](docs/agent-portability.md).

## Comandos

| Comando | Qué hace |
|---------|----------|
| `/ponytail [lite \| full \| ultra \| off]` | Cambia la intensidad, o apágalo. Sin argumento, reporta el nivel actual. |
| `/ponytail-review` | Revisa el diff actual en busca de sobre-ingeniería y devuelve una lista de qué eliminar. |
| `/ponytail-audit` | Audita el repo completo en busca de sobre-ingeniería, no solo el diff. |
| `/ponytail-debt` | Recolecta los atajos marcados con `ponytail:` que dejaste pendientes en un registro, para que "después" no se convierta en "nunca". |
| `/ponytail-help` | Referencia rápida de los comandos anteriores. |

Los comandos requieren un host compatible con skills (Claude Code, Codex, OpenCode, Gemini, pi). En Codex son skills; se invocan con `@` (`@ponytail-review`). Los adaptadores de solo instrucciones (Cursor, Windsurf, Cline, Copilot, Kiro, Antigravity) cargan el ruleset permanente sin los comandos.

## Desarrollo

Al cambiar el texto compacto de las reglas, mantén alineadas las copias en los adaptadores:

```bash
node scripts/check-rule-copies.js
npm test
```

El paquete de skills de OpenClaw (`.openclaw/skills/`) se genera desde `skills/`; ejecuta `node scripts/build-openclaw-skills.js` después de cambiar un skill — la suite de tests falla si está desactualizado.

El benchmark de correctness lanza Python para las verificaciones de email y CSV; se prueba `python3` antes que `python`. Las verificaciones de CSV requieren `pandas` instalado localmente.

## FAQ

**¿Necesita un archivo de configuración?**
No. Un opcional `~/.config/ponytail/config.json` o la variable `PONYTAIL_DEFAULT_MODE` pueden fijar el nivel default, pero nada es obligatorio.

**¿Y si realmente necesito la clase de caché de 120 líneas?**
No la necesitas. Insiste de todas formas y él la va a construir. Despacio. Correctamente. Mirándote.

**¿Escala?**
El código que nunca escribiste escala infinitamente. Cero bugs, cero CVEs, 100% uptime desde siempre.

**¿Por qué "ponytail"?**
Ya sabes exactamente por qué.

## Licencia

[MIT](LICENSE). La licencia más corta que funciona.
