<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.png">
    <img src="assets/logo.png" width="220" alt="Ponytail, el senior dev perezoso">
  </picture>
</p>

<h1 align="center">Ponytail</h1>

<p align="center">
  <em>No dice nada. Escribe una línea. Funciona.</em>
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
  <strong>~54% menos código (hasta 94%) &middot; ~20% más barato &middot; ~27% más rápido &middot; 100% seguro</strong><br>
  <sub>Sesiones reales de Claude Code editando un repo real de FastAPI + React, el mismo agente con y sin el skill (12 tareas de funcionalidad, Haiku 4.5, n=4). <a href="#numbers">Detalles</a>.</sub>
</p>

<p align="center">
  <sub><a href="README.md">English</a> &middot; Español &middot; <a href="README.ko.md">한국어</a> &middot; <a href="README.zh-CN.md">简体中文</a> &middot; <a href="README.ja.md">日本語</a></sub><br>
  <sub>Traducción del README en inglés. Si algo no coincide, vale la <a href="README.md">versión en inglés</a>.</sub>
</p>

---

<p align="center">
  <a href="https://ponytail.dev/soon"><img src="assets/waitlist-banner-es.png" alt="Algo se acerca, únete a la lista de espera" width="760"></a>
</p>

## Ya construido con Ponytail

<a href="https://theretriever.app">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/retriever-logo-dark.svg">
    <img src="assets/retriever-logo-light.svg" height="128" alt="Retriever">
  </picture>
</a>

---

Ya lo conoces. Coleta larga. Gafas ovaladas. Lleva en la empresa más tiempo que el control de versiones. Le enseñas cincuenta líneas; las mira, no dice nada y las cambia por una.

Ponytail lo mete dentro de tu agente de IA.

## El prompt

Ponytail es un solo prompt: [`skills/ponytail/SKILL.md`](skills/ponytail/SKILL.md). La versión compacta, para agentes que leen un archivo de reglas, es [`AGENTS.md`](AGENTS.md). Todo lo demás en este repo sirve para cargar ese prompt en distintos agentes.

## Instalación

**Claude Code**, como dos prompts separados:

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

Después abre `/hooks` en Codex, confía en sus dos hooks de ciclo de vida y empieza un hilo nuevo.

**Cualquier otro agente:** copia [`AGENTS.md`](AGENTS.md) en tu proyecto, o pídele a tu agente que instale [`skills/ponytail/SKILL.md`](skills/ponytail/SKILL.md) como skill. Paso a paso para Copilot, Cursor, OpenCode, Gemini y el resto (en inglés): **[INSTALL.md](INSTALL.md)**.

Eso era todo. Estaría orgulloso. No lo va a decir.

Activo en cada sesión, con un puñado de comandos (ver [Comandos](#commands)). `/ponytail ultra` existe para cuando el código te ha ofendido personalmente. El texto de inicio y de cambio de modo muestra el modo actual.

Instala ponytail solo desde `DietrichGebert/ponytail` en GitHub o `@dietrichgebert/ponytail` en npm. Nunca incluye archivos `.exe` ni `.dll`; una copia que los incluya no es mía.

## Antes / después

Pides un selector de fechas. Tu agente instala flatpickr, escribe un componente envoltorio, añade una hoja de estilos y abre un debate sobre zonas horarias.

Con ponytail:

```html
<!-- ponytail: browser has one -->
<input type="date">
```

Más supervivientes en [examples/](examples/).

## Cómo funciona

Antes de escribir código, el agente se detiene en el primer peldaño que se sostiene:

```
1. ¿Hace falta que exista?           → no: sáltalo (YAGNI)
2. ¿Ya está en este código?           → reutilízalo, no lo reescribas
3. ¿La librería estándar lo hace?     → úsala
4. ¿Función nativa de la plataforma?  → úsala
5. ¿Dependencia ya instalada?         → úsala
6. ¿Una línea?                        → una línea
7. Solo entonces: lo mínimo que funcione
```

La escalera corre *después* de entender el problema, no en su lugar: lee el código que toca el cambio y sigue el flujo real antes de elegir un peldaño. Perezoso con la solución, nunca con la lectura.

Perezoso, no negligente: la validación en los límites de confianza, el manejo de pérdida de datos, la seguridad y la accesibilidad nunca se recortan.

<a id="commands"></a>
## Comandos

| Comando | Qué hace |
|---------|----------|
| `/ponytail [lite \| full \| ultra \| off]` | Ajusta la intensidad o lo apaga. Sin argumento enciende ponytail en el nivel por defecto si está apagado; si no, muestra el nivel actual. |
| `/ponytail-review` | Revisa el diff actual en busca de sobreingeniería y devuelve una lista de cosas para borrar. Indica un objetivo con palabras normales para acotarlo o ampliarlo: `uncommitted`, `staged`, `branch` o un enlace a un PR. |
| `/ponytail-audit` | Audita todo el repo en busca de sobreingeniería, no solo el diff. |
| `/ponytail-debt` | Reúne los atajos `ponytail:` que dejaste para después en un registro, para que "luego" no se convierta en "nunca". |
| `/ponytail-gain` | Muestra el marcador de impacto medido (menos código, menos coste, más velocidad) del benchmark. |
| `/ponytail-help` | Referencia rápida de los comandos anteriores. |

Los comandos necesitan un host con soporte de skills (Claude Code, Codex, Devin CLI, OpenCode, Gemini, pi, Swival, Hermes Agent, Qoder, Grok Build). En Codex CLI y en la extensión del IDE son skills dentro del espacio de nombres del plugin; se invocan con `$ponytail:ponytail-review`. Cursor con los [hooks](INSTALL.md#cursor) solo tiene el cambio de nivel con `/ponytail`, escrito como mensaje normal. Los adaptadores de solo instrucciones (el archivo de reglas de Cursor, Windsurf, Cline, Copilot, Kiro, Antigravity) cargan las reglas siempre activas, sin los comandos.

<a id="numbers"></a>
## Números

La medición honesta es un agente real haciendo trabajo real: una sesión de Claude Code sin interfaz editando [la full-stack-fastapi-template de tiangolo](https://github.com/fastapi/full-stack-fastapi-template) (un repo real de FastAPI + React), puntuada por el `git diff` que deja. Doce tickets de funcionalidad, el mismo agente con y sin el skill, n=4, Haiku 4.5.

<p align="center">
  <img src="assets/benchmark-agentic.svg" width="860" alt="Cada variante como porcentaje del baseline sin skill en líneas, tokens, coste y tiempo (Haiku 4.5). ponytail es el más bajo en todas las métricas (líneas 46%, tokens 78%, coste 80%, tiempo 73%); caveman supera el 100% en tokens, coste y tiempo; yagni-oneliner líneas 67%. Seguridad, prueba adversarial aparte: baseline, caveman y ponytail 100%, yagni-oneliner 95%.">
</p>

| frente al baseline sin skill | líneas | tokens | coste | tiempo | seguro |
|---|--:|--:|--:|--:|--:|
| **ponytail** | **-54%** | **-22%** | **-20%** | **-27%** | **100%** |
| caveman (control de prosa escueta) | -20% | +7% | +3% | +2% | 100% |
| prompt "YAGNI + one-liners" | -33% | -14% | -21% | -30% | 95% |

ponytail es la única variante que recorta todas las métricas, y la única que sigue siendo totalmente segura mientras lo hace. El recorte es mayor donde hay una trampa real de sobreconstrucción (selector de fechas de 404 a 23 líneas, selector de color de 287 a 23, porque usa un `<input>` nativo en vez de un componente) y casi cero en código que ya es mínimo. Método completo, tablas por tarea y limitaciones: [benchmarks/results/2026-06-18-agentic.md](benchmarks/results/2026-06-18-agentic.md).

<details>
<summary><strong>Números anteriores de un solo disparo (generación aislada)</strong></summary>

Cinco tareas cotidianas, tres modelos, tres variantes (sin skill, [caveman](https://github.com/JuliusBrussee/caveman), ponytail), diez ejecuciones, se reporta la mediana. Un prompt, una respuesta, contando las líneas de la respuesta:

<p align="center">
  <img src="assets/benchmark-3model.svg" width="860" alt="Mediana de líneas de código por variante en Haiku, Sonnet y Opus">
</p>

Esto mostraba **80-94% menos código**. [#126](https://github.com/DietrichGebert/ponytail/issues/126) señaló con razón que el baseline del modelo sin nada rellena su respuesta con prosa y opciones, así que esa diferencia es en parte un artefacto del baseline conversacional. Los números agénticos de arriba son la versión corregida y defendible. Reproduce la ejecución de un solo disparo con `npx promptfoo eval -c benchmarks/promptfooconfig.yaml`.

</details>

**La regla nunca fue "la menor cantidad de tokens".** Es: escribe solo lo que la tarea necesita, y nunca recortes validación, manejo de errores, seguridad ni accesibilidad. El código acaba siendo pequeño porque es lo necesario, no porque esté comprimido a la fuerza. El menor coste y la menor latencia son un efecto secundario en los modelos que siguen la escalera; un modelo de razonamiento escueto que gasta tokens de pensamiento deliberando los peldaños puede ir en la dirección contraria (en GPT-5.5 pasa).

## Preguntas frecuentes

**¿Puedo usarlo con [caveman](https://github.com/JuliusBrussee/caveman)?**
Sí, y deberías. Caveman acorta lo que el agente dice; ponytail acorta lo que construye. Mitades distintas, sin solaparse: caveman deja el código exacto byte a byte, ponytail no se mete en la prosa. Hablar poco sobre código mínimo.

**¿Necesita un archivo de configuración?**
No. Un `~/.config/ponytail/config.json` opcional o la variable de entorno `PONYTAIL_DEFAULT_MODE` pueden fijar el nivel por defecto, pero no hace falta nada.

**¿Y si de verdad necesito la clase de caché de 120 líneas?**
No la necesitas. Insiste de todos modos y te la construye. Despacio. Correctamente. Mirándote.

**¿Escala?**
El código que nunca escribiste escala hasta el infinito. Cero bugs, cero CVEs, 100% de disponibilidad desde siempre.

**¿Por qué "ponytail"?**
Sabes perfectamente por qué.

## Patrocinadores

<p align="center">
  <a href="https://greenpt.com/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="assets/logo-greenpt-dark.svg">
      <img src="assets/logo-greenpt.svg" width="260" alt="GreenPT">
    </picture>
  </a>
</p>

## Licencia

[MIT](LICENSE). La licencia más corta que funciona.

## Historial de estrellas

<a href="https://www.star-history.com/dietrichgebert/ponytail#history">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=DietrichGebert/ponytail&type=Date" />
 </picture>
</a>
