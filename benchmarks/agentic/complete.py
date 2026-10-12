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

Judge: --model (default claude-sonnet-4-6). API key from ../../.env (shared with judge.py), or the
claude CLI login when there is none.

ponytail: reuses judge.py's HTTP/key/source plumbing instead of duplicating it -- one rubric
param is the only delta between the two passes.
"""
import argparse, json, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict
from pathlib import Path

from tasks import TASKS
from judge import load_key, source_text, judge_call, parse_score, RUNS_DIR, JUDGE_MODEL

SCORE_KEY = "completeness"
FLAG_AT = 1                 # cells scoring <= this are under-delivery (stub/partial) and get listed
ARMS_ORDER = ["baseline", "caveman", "ponytail", "ponytail2", "yagni", "yagni-oneliner"]
# the tasks scored on LOC alone (no deterministic check): the only ones this pass is for
LOC_ONLY = ("vibe-", "open-", "tmpl-")

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

def selftest(key, model=JUDGE_MODEL):
    """Live: the judge model must rank each complete ref above its stub."""
    scores = {}
    for task_id, label, code in PAIRS:
        s = parse_complete(judge_call(TASKS[task_id]["prompt"], code, key, system=RUBRIC, model=model))
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

def submission(ws, tid):
    """What the agent delivered. Fixture tasks: only its diff against the seeded repo, not the whole
    repo. Open tasks may answer in chat with no file. Arm-revealing marker words are neutralized so
    the judge stays blind."""
    if TASKS[tid].get("fixture"):
        text = subprocess.run(["git", "-C", str(ws), "diff", "--cached", "-U10", "HEAD", "--", ".", ":(exclude)_*"],
                              capture_output=True, text=True).stdout
    else:
        text = source_text(ws)
        if not text.strip() and (ws / "_claude.json").exists():
            try: text = json.loads((ws / "_claude.json").read_text(encoding="utf-8")).get("result", "") or ""
            except ValueError: text = ""                # the agent timed out: nothing delivered
    return re.sub(r"\bponytail:", "note:", text, flags=re.I)

def run(run_dir, key, model=JUDGE_MODEL, arms=None, workers=6):
    run_dir = Path(run_dir)
    if not run_dir.exists(): run_dir = RUNS_DIR / run_dir.name
    cells, timed_out = [], defaultdict(int)
    for ws in sorted(p for p in run_dir.iterdir() if p.is_dir()):
        parts = ws.name.split("__")
        if len(parts) != 4 or parts[0] not in TASKS: continue
        if not parts[0].startswith(LOC_ONLY) or (arms and parts[1] not in arms): continue
        if (ws / "_claude.json").exists() and not (ws / "_claude.json").stat().st_size:
            timed_out[parts[1]] += 1; continue           # killed at the cell timeout: nothing to judge, counted apart
        cells.append((parts[0], parts[1], parts[2], ws))
    print(f"completeness-judging {len(cells)} workspaces with {model} ...; timed out, not judged: {dict(timed_out) or 0}")
    def one(cell):
        tid, arm, mdl, ws = cell
        r = parse_complete(judge_call(TASKS[tid]["prompt"], submission(ws, tid), key, system=RUBRIC, model=model)) \
            or {SCORE_KEY: None}
        return {"task": tid, "arm": arm, "model": mdl, "cell": ws.name, SCORE_KEY: r.get(SCORE_KEY),
                "why": r.get("why", ""), "missing": r.get("missing", "")}
    with ThreadPoolExecutor(workers) as ex:
        scored = list(ex.map(one, cells))
    (run_dir / "completeness.json").write_text(
        json.dumps({"judge": model, "rubric": RUBRIC, "timed_out": timed_out, "scores": scored}, indent=2), encoding="utf-8")
    by_arm = defaultdict(list)
    for r in scored:
        if isinstance(r[SCORE_KEY], int): by_arm[r["arm"]].append(r[SCORE_KEY])
    print(f"\n=== completeness by arm (judge: {model}, 0=stub .. 3=fully implements) ===")
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
    ap.add_argument("--model", default=JUDGE_MODEL, help="judge model")
    ap.add_argument("--arms", help="comma list, default all")
    ap.add_argument("--workers", type=int, default=6)
    args = ap.parse_args()
    if args.selftest_offline:
        sys.exit(selftest_offline())
    key = load_key()
    if args.selftest: sys.exit(selftest(key, args.model))
    if args.run:
        if selftest(key, args.model): sys.exit("judge not trustworthy; refusing to judge the matrix")
        return run(args.run, key, args.model, args.arms and args.arms.split(","), args.workers)
    sys.exit("give --selftest, --selftest-offline, or --run <dir>")

if __name__ == "__main__":
    main()
