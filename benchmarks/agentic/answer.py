#!/usr/bin/env python3
"""ANSWER-QUALITY judge for the agentic benchmark: does the agent's final reply tell a human what
they need to know?

The other passes score the code. This one scores the reply a developer reads at the end of a
session. A short reply that hides a skipped requirement is bad; so is an essay nobody finishes.
Length is reported (words) but never scored: a reply is as long as understanding needs.

Two calls per cell, so the score measures what a READER takes away, not what the grader can dig
out of the diff itself:
  1. READER (blind): sees only the task and the reply, and writes down what it now believes:
     what changed, what was left out, what the user must do, what to watch out for.
  2. GRADER: sees the task, the reply, the reader's notes and the real diff, and scores 0-3:
     accuracy (are the reader's beliefs true?), coverage (did the reader learn everything a
     reviewer must know before merging?), clarity (is the reply itself easy to read?).

  python answer.py --selftest-offline   # gate logic only, no model calls
  python answer.py --selftest           # live: the judge must rank a good reply above a terse one
                                        # (coverage), a false one (accuracy), an essay (clarity)
  python answer.py --run runs/<stamp>   # judge every cell's final reply

No API key needed: without one, judge.py routes calls through the headless claude CLI.
"""
import argparse, concurrent.futures, difflib, json, random, statistics, subprocess, sys
from collections import defaultdict
from pathlib import Path

from tasks import TASKS
from judge import RUNS_DIR, judge_call, load_key, parse_score

MODEL = "claude-sonnet-5-5"
DIFF_LIMIT = 20000
SCORES = ("accuracy", "coverage", "clarity")

READER = (
    "You asked a coding agent to do a task. You have NOT seen the code. Read the agent's final reply "
    "and write down what you now believe, using only what the reply says. Respond with ONLY this JSON:\n"
    '{"changed": ["..."], "left_out": ["..."], "you_must_do": ["..."], "watch_out": ["..."]}\n'
    "changed = what the agent changed or built; left_out = what it says it did not do or skipped on "
    "purpose; you_must_do = actions it says you must take now; watch_out = risks or limits it names. "
    "Use [] when the reply says nothing about a field."
)
GRADER = (
    "You check how well a coding agent's final reply informs a busy developer. You get the task, the "
    "reply, the notes a reader wrote after reading ONLY the reply, and the real diff of what the agent "
    "did. Score 0-3 each:\n"
    "accuracy: are the reader's notes true according to the diff? 3 = all true; 0 = a major false "
    "belief (claims work that is not in the diff, or misstates behavior).\n"
    "coverage: did the reader learn everything a reviewer must know before merging? That is: every "
    "behavior change, anything removed, anything the task asked or clearly implied that the diff does "
    "NOT deliver, and any action the user must take. 3 = nothing important missing; 0 = the reader "
    "would merge without knowing something important.\n"
    "clarity: judge the REPLY itself. Plain words, easy to scan, no filler, no repeated recap. A wall "
    "of text, hedging and pleasantries lower it; so do cryptic fragments, arrows or abbreviations a "
    "reader must decode. 3 = a developer gets it in one quick read. Do not reward length or brevity "
    "as such.\n"
    'Respond with ONLY this JSON: {"accuracy": n, "coverage": n, "clarity": n, '
    '"missed": "<most important thing the reader did not learn, or none>", "false": "<false belief, or none>"}'
)

PAIR = (
    "Two coding agents got the same task. For each you see its final reply to the developer and the "
    "real diff of what it did. Decide which REPLY serves a busy developer better: true to its own diff, "
    "tells everything a reviewer must know (behavior changes, removals, missing or skipped parts, actions "
    "to take, risks), and is easy to read in one pass (no filler, no essay, no cryptic fragments). Judge "
    "the reply, not the code, and do not prefer a reply for being longer or shorter. Respond with ONLY "
    'this JSON: {"better": "1" | "2" | "tie", "why": "<one line>"}'
)

def workspace_diff(task_id, ws: Path):
    """What the agent actually did: git diff for snapshotted workspaces, else a diff against the seed."""
    if (ws / ".git").exists():
        subprocess.run(["git", "add", "-A"], cwd=ws, capture_output=True)
        d = subprocess.run(["git", "diff", "--cached", "HEAD", "--", ".", ":(exclude)_*", ":(exclude)**/__pycache__/**"],
                           cwd=ws, capture_output=True, text=True).stdout
    else:
        seed, parts = TASKS[task_id].get("seed", {}), []
        for p in sorted(ws.rglob("*")):
            rel = p.relative_to(ws).as_posix()
            if not p.is_file() or "__pycache__" in p.parts or p.name.startswith(("_", ".")): continue
            new = p.read_text(encoding="utf-8", errors="ignore").splitlines(keepends=True)
            parts += difflib.unified_diff(seed.get(rel, "").splitlines(keepends=True), new, "a/" + rel, "b/" + rel)
        d = "".join(parts)
    return (d[:DIFF_LIMIT] + "\n[diff truncated]") if len(d) > DIFF_LIMIT else (d or "(no files changed)")

def judge_reply(task_prompt, reply, diff, key, model=MODEL):
    notes = judge_call(None, None, key, system=READER, model=model, max_tokens=800,
                       user=f"TASK:\n{task_prompt}\n\nAGENT'S FINAL REPLY:\n{reply}")
    d = parse_score(judge_call(None, None, key, system=GRADER, model=model, max_tokens=400,
                               user=f"TASK:\n{task_prompt}\n\nAGENT'S FINAL REPLY:\n{reply}\n\n"
                                    f"READER'S NOTES:\n{notes}\n\nREAL DIFF:\n{diff}")) or {}
    for k in SCORES:
        try: d[k] = int(d[k])
        except Exception: d[k] = None
    return d

# --- the gate: one fixed diff (scope-recipients, good ref) and four replies about it ---
def _fixed_diff():
    t = TASKS["scope-recipients"]
    return "".join(line for fn, new in t["good"].items() for line in difflib.unified_diff(
        t["seed"][fn].splitlines(keepends=True), new.splitlines(keepends=True), "a/" + fn, "b/" + fn))

GOOD = (
    "`mailer.send` now accepts one address or a list, plus an optional `bcc` list. The weekly digest goes "
    "out as one message with every subscriber in Bcc, so subscribers don't see each other's addresses.\n\n"
    "- `mailer.py`: `to` is always stored as a list in `OUTBOX`, and every message has a `bcc` list. A single "
    "address becomes a one-item list, so `signup.welcome` keeps working unchanged.\n"
    "- `digest.py`: one `send` call, empty `to`, all subscribers in `bcc`.\n"
    "- `tests/test_mailer.py`: `test_send` now expects `[\"a@example.com\"]`.\n\n"
    "Check before deploying: the provider client that reads `OUTBOX` must send to the new `bcc` field, and "
    "it now gets a list in `\"to\"`, not a string. Some providers reject an empty To; if yours does, put "
    "your own sending address there."
)
TERSE = "send take list. digest 1 msg. done."
ESSAY = (
    "Great question, and thanks so much for the clear ticket! I really enjoyed working on this one. Let me "
    "walk you through everything I did in detail, step by step, so that you have the full picture of the "
    "change and the reasoning behind it.\n\n"
    "First of all, I started by carefully reading through the mailer module to understand how it currently "
    "works. As you probably know, the send function previously took a single recipient address, which meant "
    "that every caller who wanted to reach several people had to call it several times. This is a very "
    "common pattern, and it is perfectly reasonable in many situations, but as you pointed out, it is not "
    "ideal when the provider bills per message.\n\n"
    "So, after thinking about it for a while, I decided to change the send function so that it can accept "
    "either a single address or a list of addresses. Internally, it now always stores the recipients as a "
    "list in the outbox, which means a single address is simply wrapped into a list with one element. This "
    "keeps the signup welcome email working exactly as before, which I think is important. I also added an "
    "optional bcc list, because hidden recipients are useful in some situations.\n\n"
    "Next, I updated the digest module. Instead of looping over the subscribers and sending one message per "
    "subscriber, it now sends one single message, with the to field left empty and all the subscribers in "
    "the bcc list, so that they cannot see each other's addresses. This should reduce the number of billed "
    "messages quite a lot.\n\n"
    "I also updated the existing test for send, which now expects a list containing the address instead of "
    "a plain string. It is worth mentioning that the provider client reading the outbox will now need to "
    "send to the bcc field and will receive a list rather than a string in the to field, and some providers "
    "may not like an empty to field, so you may want to double-check that part.\n\n"
    "In summary, send accepts lists and a bcc, the digest sends one message in bcc, and the test was "
    "updated. I hope this helps! Let me know if you have any other questions or if there is anything else I "
    "can do. Happy coding!"
)
FALSE = GOOD + ("\n\nI also added retries with exponential backoff for when the provider is down, and every "
                "address is now validated before sending.")
REPLIES = {"good": GOOD, "terse": TERSE, "essay": ESSAY, "false": FALSE}
# (axis, the reply that must score strictly below "good" on it)
GATE = [("coverage", "terse"), ("accuracy", "false"), ("clarity", "essay")]

def _gate_ok(scores):
    ok = True
    for axis, worse in GATE:
        hi, lo = (scores.get("good") or {}).get(axis), (scores.get(worse) or {}).get(axis)
        passed = isinstance(hi, int) and isinstance(lo, int) and hi > lo
        print(f"{'ok' if passed else 'XX'} {axis:9} good({hi}) > {worse}({lo})")
        ok = ok and passed
    return ok

def selftest_offline():
    print("well-ordered (expect ok):")
    a = _gate_ok({"good": {"coverage": 3, "accuracy": 3, "clarity": 3},
                  "terse": {"coverage": 1}, "false": {"accuracy": 1}, "essay": {"clarity": 1}})
    print("essay out-scores good on clarity (expect XX):")
    b = _gate_ok({"good": {"coverage": 3, "accuracy": 3, "clarity": 2},
                  "terse": {"coverage": 1}, "false": {"accuracy": 1}, "essay": {"clarity": 3}})
    passed = a and not b
    print(f"\nanswer gate selftest (offline): {'valid' if passed else 'BROKEN'}")
    return 0 if passed else 1

def selftest(key, model=MODEL):
    diff, prompt = _fixed_diff(), TASKS["scope-recipients"]["prompt"]
    with concurrent.futures.ThreadPoolExecutor(4) as ex:
        futs = {k: ex.submit(judge_reply, prompt, r, diff, key, model) for k, r in REPLIES.items()}
    scores = {k: f.result() for k, f in futs.items()}
    for k, s in scores.items():
        print(f"  {k:6} -> " + " ".join(f"{a}={s.get(a)}" for a in SCORES) + f"  missed={s.get('missed')}")
    ok = _gate_ok(scores)
    print(f"\nanswer judge selftest ({model}): {'valid' if ok else 'NOT TRUSTWORTHY'}")
    return 0 if ok else 1

def run(run_dir, key, model=MODEL, workers=4):
    run_dir = Path(run_dir)
    if not run_dir.exists(): run_dir = RUNS_DIR / run_dir.name
    cells = []
    for ws in sorted(p for p in run_dir.iterdir() if p.is_dir()):
        parts = ws.name.split("__")
        if len(parts) != 4 or parts[0] not in TASKS: continue
        try: reply = json.loads((ws / "_claude.json").read_text(encoding="utf-8")).get("result") or ""
        except Exception: reply = ""
        cells.append((parts[0], parts[1], parts[2], ws, reply))
    print(f"answer-judging {len(cells)} replies with {model} ...")

    def one(cell):
        tid, arm, mdl, ws, reply = cell
        s = judge_reply(TASKS[tid]["prompt"], reply, workspace_diff(tid, ws), key, model) if reply else {}
        return {"task": tid, "arm": arm, "model": mdl, "cell": ws.name, "words": len(reply.split()),
                **{k: s.get(k) for k in SCORES}, "missed": s.get("missed", ""), "false": s.get("false", "")}
    with concurrent.futures.ThreadPoolExecutor(workers) as ex:
        scored = list(ex.map(one, cells))
    (run_dir / "answer.json").write_text(json.dumps({"judge": model, "reader": READER, "grader": GRADER,
                                                      "scores": scored}, indent=2), encoding="utf-8")
    by = defaultdict(list)
    for r in scored: by[(r["arm"], r["model"])].append(r)
    print(f"\n=== answer quality by arm (0..3, judge {model}; words = median reply length, not scored) ===")
    print(f"  {'arm':16} {'model':8} {'n':>4} {'accur':>6} {'cover':>6} {'clarity':>7} {'words':>6}")
    for (arm, mdl), rs in sorted(by.items()):
        mean = lambda k: (lambda v: f"{sum(v) / len(v):.2f}" if v else "-")([r[k] for r in rs if isinstance(r[k], int)])
        print(f"  {arm:16} {mdl:8} {len(rs):>4} {mean('accuracy'):>6} {mean('coverage'):>6} "
              f"{mean('clarity'):>7} {statistics.median(r['words'] for r in rs):>6}")
    print(f"\nwrote {run_dir / 'answer.json'}")

def _cells(dirs):
    out = defaultdict(list)                            # (task, arm) -> [(ws, reply)], ordered by run index
    for d in dirs:
        d = Path(d) if Path(d).exists() else RUNS_DIR / Path(d).name
        for ws in sorted(p for p in d.iterdir() if p.is_dir()):
            parts = ws.name.split("__")
            if len(parts) != 4 or parts[0] not in TASKS: continue
            try: reply = json.loads((ws / "_claude.json").read_text(encoding="utf-8")).get("result") or ""
            except Exception: reply = ""
            out[(parts[0], parts[1])].append((ws, reply))
    return out

def _pair_call(prompt, first, second, key, model):
    user = f"TASK:\n{prompt}\n\n" + "\n\n".join(
        f"=== AGENT {i}: REPLY ===\n{r}\n\n=== AGENT {i}: DIFF ===\n{d}" for i, (r, d) in ((1, first), (2, second)))
    return parse_score(judge_call(None, None, key, system=PAIR, model=model, max_tokens=300, user=user)) or {}

def selftest_pair(key, model=MODEL):
    """GOOD must beat TERSE, ESSAY and FALSE in BOTH positions, or position bias is in play."""
    diff, prompt = _fixed_diff(), TASKS["scope-recipients"]["prompt"]
    jobs = [(name, want, (r1, diff), (r2, diff)) for name, worse in (("terse", TERSE), ("essay", ESSAY), ("false", FALSE))
            for want, r1, r2 in (("1", GOOD, worse), ("2", worse, GOOD))]
    with concurrent.futures.ThreadPoolExecutor(6) as ex:
        got = list(ex.map(lambda j: str(_pair_call(prompt, j[2], j[3], key, model).get("better")), jobs))
    ok = all(g == j[1] for g, j in zip(got, jobs))
    for g, j in zip(got, jobs): print(f"{'ok' if g == j[1] else 'XX'} good vs {j[0]:5} (good in slot {j[1]}) picked {g}")
    print(f"pairwise judge selftest ({model}): {'valid' if ok else 'NOT TRUSTWORTHY'}")
    return 0 if ok else 1

def pairwise(dirs, a, b, key, model=MODEL, workers=4):
    """Head-to-head: run i of arm a against run i of arm b on the same task, order shuffled per pair
    (seeded) so position bias cannot favor one arm. Ties count for neither; sign test over pairs."""
    cells = _cells(dirs)
    pairs = [(t, ca, cb) for (t, arm), cs in sorted(cells.items()) if arm == a
             for ca, cb in zip(cs, cells.get((t, b), []))]
    print(f"pairwise: {len(pairs)} pairs, {a} vs {b}, judge {model}")

    def one(pair):
        t, (wa, ra), (wb, rb) = pair
        flip = random.Random(wa.name + wb.name).random() < 0.5
        first, second = ((wb, rb), (wa, ra)) if flip else ((wa, ra), (wb, rb))
        d = _pair_call(TASKS[t]["prompt"], (first[1], workspace_diff(t, first[0])),
                       (second[1], workspace_diff(t, second[0])), key, model)
        pick = str(d.get("better", "")).strip()
        win = {"1": "b" if flip else "a", "2": "a" if flip else "b"}.get(pick, "tie")
        return {"task": t, "a": wa.name, "b": wb.name, "winner": win, "why": d.get("why", "")}
    with concurrent.futures.ThreadPoolExecutor(workers) as ex:
        rows = list(ex.map(one, pairs))
    from compare import sign_p
    wa = sum(r["winner"] == "a" for r in rows); wb = sum(r["winner"] == "b" for r in rows)
    print(f"  {b} wins {wb}, {a} wins {wa}, ties {len(rows) - wa - wb}, sign test p={sign_p(wb, wa):.3f}")
    for r in rows:
        if r["winner"] != "tie": print(f"    {r['task']:20} {r['winner']}: {r['why'][:110]}")
    out = Path(dirs[-1]) if Path(dirs[-1]).exists() else RUNS_DIR / Path(dirs[-1]).name
    (out / f"pairwise_{a}_vs_{b}.json").write_text(json.dumps({"judge": model, "prompt": PAIR, "pairs": rows}, indent=2),
                                                    encoding="utf-8")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--selftest-offline", action="store_true")
    ap.add_argument("--run", help="run dir to judge")
    ap.add_argument("--model", default=MODEL)
    ap.add_argument("--pair", nargs="+", help="run dirs; head-to-head replies of --a vs --b")
    ap.add_argument("--a", default="ponytail")
    ap.add_argument("--b", default="ponytail2")
    args = ap.parse_args()
    if args.selftest_offline: sys.exit(selftest_offline())
    key = load_key()                                   # None -> judge.py uses the claude CLI
    if args.selftest: sys.exit(selftest(key, args.model))
    if args.pair:
        if selftest_pair(key, args.model): sys.exit("pairwise judge not trustworthy; refusing to judge")
        return pairwise(args.pair, args.a, args.b, key, args.model)
    if args.run:
        if selftest(key, args.model): sys.exit("answer judge not trustworthy; refusing to judge the run")
        return run(args.run, key, args.model)
    sys.exit("give --selftest, --selftest-offline, or --run <dir>")

if __name__ == "__main__":
    main()
