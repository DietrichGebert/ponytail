#!/usr/bin/env python3
"""LLM-judge COMPLETENESS pass for the agentic benchmark.

Fewer lines is only a win if the code still does the job. The open feature tasks (vibe-*,
tmpl-fe-*, open-*) are scored on LOC alone -- there is no deterministic check that the asked
feature was actually implemented, so an arm could "win" the LOC metric by shipping a stub.
That is the inverse of the safety hole and the most credible attack on the headline number:
"you wrote less because you did less."

This pass closes it. An LLM judge rates how FULLY each submission implements its task, on the
same auditable footing as the over-engineering judge in judge.py: a published rubric, a fixed
model at temperature 0, and a --selftest that must rank a complete reference strictly above a
stub before any real scoring is trusted. Pair the output with run.py's LOC: a low-LOC arm whose
completeness also drops is doing less, not less-bloated -- and now the bench shows it.

  python complete.py --selftest          # validate the judge ranks complete > stub (small API spend)
  python complete.py --selftest-offline  # validate the GATE LOGIC only, no API, no key
  python complete.py --run runs/<stamp>  # completeness-judge every workspace in a matrix run

Judge: claude-sonnet-4-6, key from ../../.env (shared with judge.py). ~$0.003/cell.

ponytail: reuses judge.py's HTTP/key/source plumbing instead of duplicating it -- one rubric
param is the only delta between the two passes.
"""
import argparse, json, sys
from collections import defaultdict
from pathlib import Path

from tasks import TASKS
from judge import load_key, source_text, judge_call, parse_score, RUNS_DIR, JUDGE_MODEL

SCORE_KEY = "completeness"
FLAG_AT = 1                 # cells scoring <= this are under-delivery (stub/partial) and get listed
ARMS_ORDER = ["baseline", "caveman", "ponytail", "yagni", "yagni-oneliner"]

RUBRIC = (
    "You are a senior engineer checking whether a code submission ACTUALLY IMPLEMENTS the task it "
    "was given. Judge COMPLETENESS ONLY -- ignore over-engineering, style, performance, and security. "
    "A stub, a placeholder, a bare `pass`/`TODO`/`NotImplementedError`, or code that silently omits "
    "the core behavior asked for is INCOMPLETE. Score 0-3:\n"
    "0 = stub/empty/placeholder, does essentially nothing the task asked\n"
    "1 = partial: the core behavior is missing or broken\n"
    "2 = mostly complete: it works but a stated requirement is missing\n"
    "3 = fully implements what the task asked\n"
    "Name the single most important missing piece, or \"none\". "
    "Respond with ONLY this JSON: {\"completeness\": <0-3 int>, \"why\": \"<one line>\", \"missing\": \"<piece or none>\"}"
)

def parse_complete(text):
    d = parse_score(text)
    if d and SCORE_KEY in d:
        try: d[SCORE_KEY] = int(d[SCORE_KEY])
        except Exception: d[SCORE_KEY] = None
    return d

# --- the gate: a complete impl must out-score a stub for the same task ---
def _rank_ok(scores):
    """scores: {(task_id, label): {SCORE_KEY: int}}. For each task the 'complete' label must
    strictly out-score the 'stub' label, else the judge (or the gate) is not trustworthy."""
    ok = True
    for task_id in sorted({t for (t, _) in scores}):
        hi = scores.get((task_id, "complete")) or {}
        lo = scores.get((task_id, "stub")) or {}
        if not (isinstance(hi.get(SCORE_KEY), int) and isinstance(lo.get(SCORE_KEY), int)
                and hi[SCORE_KEY] > lo[SCORE_KEY]):
            print(f"XX {task_id}: did not rank complete above stub"); ok = False
        else:
            print(f"ok {task_id}: complete({hi[SCORE_KEY]}) > stub({lo[SCORE_KEY]})")
    return ok

# Complete refs are the deterministic tasks' known-good answers; stubs do nothing.
STUBS = {
    "cache":     "def compute(n):\n    pass\n",
    "safe-path": "def safe_upload_path(base_dir, filename):\n    pass\n",
}
PAIRS = [(t, lbl, code) for t in STUBS for lbl, code in
         (("complete", TASKS[t]["good"]), ("stub", STUBS[t]))]

def selftest(key):
    """Live: the judge model must rank each complete ref above its stub."""
    scores = {}
    for task_id, label, code in PAIRS:
        s = parse_complete(judge_call(TASKS[task_id]["prompt"], code, key, system=RUBRIC))
        scores[(task_id, label)] = s or {}
        print(f"  {task_id:10} {label:8} -> {s}")
    ok = _rank_ok(scores)
    print(f"\ncompleteness judge selftest: {'valid' if ok else 'NOT TRUSTWORTHY'}")
    return 0 if ok else 1

def selftest_offline():
    """No API, no key: prove the GATE catches under-delivery. A well-ordered matrix must pass
    and a matrix where a stub out-scores the complete impl must be flagged. Fails loudly if the
    gate is ever weakened into a no-op."""
    good = {("cache", "complete"): {SCORE_KEY: 3}, ("cache", "stub"): {SCORE_KEY: 0}}
    bad  = {("cache", "complete"): {SCORE_KEY: 1}, ("cache", "stub"): {SCORE_KEY: 3}}
    print("offline gate -- well-ordered (expect ok):")
    p_good = _rank_ok(good)
    print("offline gate -- stub out-scores complete (expect XX):")
    p_bad = _rank_ok(bad)
    passed = p_good and not p_bad
    print(f"\ncompleteness gate selftest (offline): {'valid' if passed else 'BROKEN'}")
    return 0 if passed else 1

def run(run_dir, key):
    run_dir = Path(run_dir)
    if not run_dir.exists(): run_dir = RUNS_DIR / run_dir.name
    cells = []
    for ws in sorted(p for p in run_dir.iterdir() if p.is_dir()):
        parts = ws.name.split("__")
        if len(parts) != 4 or parts[0] not in TASKS: continue
        cells.append((parts[0], parts[1], parts[2], ws))
    print(f"completeness-judging {len(cells)} workspaces with {JUDGE_MODEL} ...")
    scored = []
    for i, (tid, arm, model, ws) in enumerate(cells, 1):
        s = parse_complete(judge_call(TASKS[tid]["prompt"], source_text(ws), key, system=RUBRIC)) \
            or {SCORE_KEY: None}
        scored.append({"task": tid, "arm": arm, "model": model, SCORE_KEY: s.get(SCORE_KEY),
                       "why": s.get("why", ""), "missing": s.get("missing", "")})
        if i % 25 == 0 or i == len(cells): print(f"  [{i}/{len(cells)}]", flush=True)
        (run_dir / "completeness.json").write_text(
            json.dumps({"judge": JUDGE_MODEL, "rubric": RUBRIC, "scores": scored}, indent=2), encoding="utf-8")
    by_arm = defaultdict(list)
    for r in scored:
        if isinstance(r[SCORE_KEY], int): by_arm[r["arm"]].append(r[SCORE_KEY])
    print(f"\n=== completeness by arm (judge: {JUDGE_MODEL}, 0=stub .. 3=fully implements) ===")
    print(f"  {'arm':16} {'n':>4} {'mean':>6} {'min':>4}")
    for arm in ARMS_ORDER:
        v = by_arm.get(arm, [])
        if v: print(f"  {arm:16} {len(v):>4} {sum(v)/len(v):>6.2f} {min(v):>4}")
    under = sorted([r for r in scored if isinstance(r[SCORE_KEY], int) and r[SCORE_KEY] <= FLAG_AT],
                   key=lambda r: r[SCORE_KEY])
    print(f"\n=== under-delivered (completeness <= {FLAG_AT}): {len(under)} cells ===")
    for r in under[:20]:
        print(f"  {r['task']:13} {r['arm']:15} {r['model']:7} score={r[SCORE_KEY]} missing={r['missing']}")
    print(f"\nwrote {run_dir / 'completeness.json'}")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true", help="live: judge ranks complete > stub")
    ap.add_argument("--selftest-offline", action="store_true", help="gate logic only, no API")
    ap.add_argument("--run", help="run dir to completeness-judge")
    args = ap.parse_args()
    if args.selftest_offline:
        sys.exit(selftest_offline())
    key = load_key()
    if not key: sys.exit("no ANTHROPIC_API_KEY (.env or env)")
    if args.selftest: sys.exit(selftest(key))
    if args.run:
        if selftest(key): sys.exit("judge not trustworthy; refusing to judge the matrix")
        return run(args.run, key)
    sys.exit("give --selftest, --selftest-offline, or --run <dir>")

if __name__ == "__main__":
    main()
