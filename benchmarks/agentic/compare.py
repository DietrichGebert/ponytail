#!/usr/bin/env python3
"""Paired arm comparison over tasks, with a sign test. No API calls.

  python compare.py runs/<full> [runs/<quick> ...] --a ponytail --b ponytail2

Every run dir's results.json (and answer.json, if answer.py ran) is merged. Each task is one
pair: the per-task median (or rate) of arm A against arm B. Ties are dropped and the sign test
asks whether B wins on more tasks than chance allows. Pair a candidate's quick run with the
full run's reference arms, so iterating on the ruleset only pays for the candidate's cells.

ponytail: sign test over tasks, not a mixed model. Coarse, but honest with n=2-3 per cell.
"""
import argparse, json, math, statistics
from collections import defaultdict
from pathlib import Path

RUNS_DIR = Path(__file__).resolve().parent / "runs"
# metric -> (how to read one cell, aggregate over a task's cells, True if higher is better)
METRICS = {
    "pass":      (lambda c: int(bool(c["correct"] and c["safe"])) if "correct" in c else None, statistics.mean, True),
    "loc":       (lambda c: c.get("total_loc"), statistics.median, False),
    "gz_code":   (lambda c: c.get("gz_code"), statistics.median, False),
    "density":   (lambda c: c.get("reply_density"), statistics.median, None),
    "cost":      (lambda c: c.get("cost"), statistics.median, False),
    "out_tok":   (lambda c: c.get("out_tokens"), statistics.median, False),
    "time_s":    (lambda c: (c.get("duration_ms") or 0) / 1000 or None, statistics.median, False),
    "turns":     (lambda c: c.get("turns"), statistics.median, False),
    "words":     (lambda c: c.get("reply_words"), statistics.median, None),   # reported, not judged
    "accuracy":  (lambda c: c.get("accuracy"), statistics.mean, True),
    "coverage":  (lambda c: c.get("coverage"), statistics.mean, True),
    "clarity":   (lambda c: c.get("clarity"), statistics.mean, True),
}

def load(dirs):
    """Cells from results.json plus answer-judge rows from answer.json, as one list of dicts.
    Answer rows only carry the judge scores; per-task aggregation skips missing values."""
    rows = []
    for d in dirs:
        d = Path(d) if Path(d).exists() else RUNS_DIR / Path(d).name
        rows += [c for c in json.loads((d / "results.json").read_text(encoding="utf-8"))["results"]
                 if "task" in c and "arm" in c]
        if (d / "answer.json").exists():
            rows += json.loads((d / "answer.json").read_text(encoding="utf-8"))["scores"]
    return rows

def sign_p(wins, losses):
    n = wins + losses
    if n == 0: return 1.0
    k = min(wins, losses)
    return min(1.0, 2 * sum(math.comb(n, i) for i in range(k + 1)) / 2 ** n)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("runs", nargs="+")
    ap.add_argument("--a", default="ponytail")
    ap.add_argument("--b", default="ponytail2")
    ap.add_argument("--tasks", help="comma list; default: every task both arms ran")
    args = ap.parse_args()
    by = defaultdict(list)
    for c in load(args.runs): by[(c["task"], c["arm"])].append(c)
    tasks = sorted({t for t, a in by if a == args.b} & {t for t, a in by if a == args.a})
    if args.tasks: tasks = [t for t in tasks if t in args.tasks.split(",")]

    def agg(task, arm, m):
        get, fn, _ = METRICS[m]
        v = [x for x in (get(c) for c in by[(task, arm)]) if x is not None]
        return fn(v) if v else None

    print(f"{args.a} (A) vs {args.b} (B) on {len(tasks)} tasks")
    print(f"  {'task':22} " + " ".join(f"{m:>15}" for m in ("pass", "loc", "cost", "coverage", "clarity", "words")))
    for t in tasks:
        row = []
        for m in ("pass", "loc", "cost", "coverage", "clarity", "words"):
            a, b = agg(t, args.a, m), agg(t, args.b, m)
            f = lambda x: "-" if x is None else (f"{x:.3g}")
            row.append(f"{f(a):>7}>{f(b):<7}")
        print(f"  {t:22} " + " ".join(row))
    print(f"\n  {'metric':10} {'B wins':>7} {'B loses':>8} {'ties':>5} {'p (sign)':>9} {'median B/A':>11}")
    for m, (_, _, higher) in METRICS.items():
        w = l = ties = 0; ratios = []
        for t in tasks:
            a, b = agg(t, args.a, m), agg(t, args.b, m)
            if a is None or b is None: continue
            if a: ratios.append(b / a)
            if higher is None or a == b: ties += 1; continue
            better = b > a if higher else b < a
            w += better; l += not better
        r = f"{statistics.median(ratios):.2f}" if ratios else "-"
        p = f"{sign_p(w, l):.3f}" if higher is not None else "-"
        print(f"  {m:10} {w:>7} {l:>8} {ties:>5} {p:>9} {r:>11}")

if __name__ == "__main__":
    main()
