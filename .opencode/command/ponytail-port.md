---
description: "Port functions to a target platform with feasibility scoring"
---

Map a function to a target architecture/backend. For each unit: classify direct/adapt/rethink, score feasibility (perf/correctness/deps) with a debug-hypothesis block, and propose the optimised replacement. Default output: `<fn> → <direct|adapt|rethink> | feas: green|yellow|red | verify: rN | risk: low|med|high | doc: ports/ProjectName-YYYYMMDD-HHMM.md`. If the user says "more" or chains with ponytail-diag: full branch validation, state-space coverage, dependency waterfall, risk cascade, and debug-verify rungs. Studies saved to ports/ directory. Does not blindly transliterate; researches internal alternatives even if they need more code. Optimal performance is the goal.
