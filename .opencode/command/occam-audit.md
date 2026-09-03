---
description: Audit codebase for cyclomatic bloat and Halstead program volume
---
Scan files for:
- Manual linked-lists or custom collections where stdlib exists.
- Redundant try/catch wrapping without invariant recovery.
- Catastrophic floating-point cancellation in numerical routines.
