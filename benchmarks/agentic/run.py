#!/usr/bin/env python3
"""Agentic, multi-file benchmark for ponytail.

Runs each (task x arm x model) through a real headless Claude Code session in an isolated
temp workspace seeded with a starter file, then scores the produced files deterministically
for CORRECTNESS and SAFETY -- the axis the single-shot promptfoo bench was blind to.

Over-engineering is proxied by SOURCE file count + source LOC (tests are counted separately,
never as bloat -- writing a test is good practice, not over-engineering). An LLM-judge
over-engineering score is a later pass.

  python run.py --selftest
      Verify every scorer (good passes, bad is caught). No API, no spend. Run first, always.

  python run.py --all --models haiku,sonnet,opus --runs 5
      Live run (spends API). Workspaces kept under runs/<stamp>/ for inspection.

  python run.py --rescore runs/<stamp>
      Recompute metrics + aggregate from kept workspaces. No API. Use after changing a
      metric or scorer so you never pay the API twice for a measurement tweak.

ponytail: the claude CLI is the harness (already installed, we run inside it). No SDK
dependency. The CLI's JSON output already carries cost/tokens/duration/permission_denials.
"""
import argparse, concurrent.futures, datetime, json, os, re, shutil, statistics, subprocess, sys, tempfile
from collections import defaultdict
from pathlib import Path

from tasks import TASKS

ROOT = Path(__file__).resolve().parents[2]
RUNS_DIR = Path(__file__).resolve().parent / "runs"

def _skill(rel): return (ROOT / rel).read_text(encoding="utf-8")
ARMS = {
    "baseline":       lambda: None,
    "ponytail":       lambda: _skill("skills/ponytail/SKILL.md"),
    "caveman":        lambda: _skill("benchmarks/arms/caveman-SKILL.md"),
    "yagni":          lambda: "Follow YAGNI principles.",
    "yagni-oneliner": lambda: "Follow YAGNI principles, and prefer one-liner solutions.",
}
MODELS = {"haiku": "claude-haiku-4-5-20251001", "sonnet": "claude-sonnet-4-6", "opus": "claude-opus-4-8"}

# Skills are plugins activated by a SessionStart hook. To test exactly one at a time we exclude the
# user's globally-enabled plugins (--setting-sources project,local) and load one plugin from its
# cache dir (--plugin-dir). The smoke test verifies activation by output style.
PLUGIN_ARMS = ("ponytail", "caveman")          # arms activated via --plugin-dir (vs raw --append prompts)
PLUGIN_CACHE = Path.home() / ".claude" / "plugins" / "cache"

def _plugin_dir(name):
    """Resolve a plugin's cache dir portably -- hardcoding one machine's absolute path
    (e.g. C:\\Users\\<you>\\...) made the ponytail/caveman arms unreproducible off that box.
    Order: env override -> latest version dir under ~/.claude/plugins/cache -> clear error.
    Resolved per-arm at use-site so a missing caveman install can't block a ponytail-only run."""
    env = os.environ.get(f"{name.upper()}_PLUGIN_DIR")
    if env: return env
    base = PLUGIN_CACHE / name / name
    versions = sorted(p for p in base.glob("*") if p.is_dir()) if base.exists() else []
    if not versions:
        sys.exit(f"{name} plugin dir not found under {base}; install the plugin or set {name.upper()}_PLUGIN_DIR")
    return str(versions[-1])                    # latest version dir; not pinned to one machine's hash

CELL_TIMEOUT = 300  # seconds per cell; a hung agent is force-killed (process tree) so the pool can't freeze

# Added to every arm's system prompt, identically. We measure code PRODUCTION, not execution: agents
# write the implementation and stop. No live verification -- earlier attempts had agents open a browser,
# hit the template's login wall, and retry, inflating tokens/time with flailing instead of code. Writing
# tests is still explicitly allowed, so ponytail's "leave a runnable check" discipline is not suppressed.
NO_RUN = ("Write the implementation (include tests if you normally would for a change like this). "
          "Do not run a dev server, install dependencies, run a database, or open a browser to verify -- "
          "just write the code and stop. Only the code you write is measured, not its execution.")

def _is_test(p: Path, workdir: Path):
    rel = p.relative_to(workdir)
    name = p.name.lower()
    return (name.startswith("test_") or name.endswith("_test.py") or name == "conftest.py"
            or any(part.lower() in ("test", "tests") for part in rel.parts[:-1]))

CODE_EXT = {".py", ".js", ".ts", ".jsx", ".tsx", ".html", ".css", ".go", ".rs", ".java", ".rb", ".sh"}

def _count(p: Path, with_comments: bool):
    try: lines = p.read_text(encoding="utf-8", errors="ignore").splitlines()
    except Exception: return 0
    n = 0
    for ln in lines:
        s = ln.strip()
        if not s: continue
        if not with_comments and s.startswith(("#", "//", "*", "/*", "*/")): continue
        n += 1
    return n

_SELFCHECK_DEFS = ("def demo(", "def _demo(", "def selfcheck(", "def _selfcheck(",
                   "def _check(", "def _smoke(", "def smoke(")
def _selfcheck_split(p: Path):
    """Split a produced .py file at the first TOP-LEVEL self-check marker (a `__main__` guard or a
    demo()/selfcheck() function) through end of file. Returns (src_total, src_code, sc_total,
    sc_code), counted like _count. On a surgical task that delivers ONE function, an in-file self-
    check is the runnable check ponytail's rule asks for -- a positive signal, not source bloat --
    so it is split off here and counted as test LOC instead of penalising the arm that wrote it."""
    try: lines = p.read_text(encoding="utf-8", errors="ignore").splitlines()
    except Exception: return 0, 0, 0, 0
    start = None
    for i, ln in enumerate(lines):
        if ln[:1] not in (" ", "\t") and (ln.startswith("if __name__") or ln.startswith(_SELFCHECK_DEFS)):
            start = i; break
    def cnt(seq):
        t = c = 0
        for ln in seq:
            s = ln.strip()
            if not s: continue
            t += 1
            if not s.startswith(("#", "//", "*", "/*", "*/")): c += 1
        return t, c
    if start is None:
        t, c = cnt(lines); return t, c, 0, 0
    t, c = cnt(lines[:start]); st, sc = cnt(lines[start:])
    return t, c, st, sc

def code_stats(workdir: Path, selfcheck_as_test: bool = False):
    """LOC over code-extension source files only (generated images/data can't pollute it).
    total_loc counts every non-blank line including comments and docstrings -- the bloat a vibe
    baseline actually produces. src_loc is code-only, for the breakdown. Tests tracked separately,
    never as bloat. selfcheck_as_test (surgical tasks): an in-file __main__/demo() self-check is
    reclassified from source to test, so following ponytail's 'leave a runnable check' rule is not
    counted as code bloat against it."""
    fixture = set()                                   # files that were seeded, not delivered
    fm = workdir / "_fixture_files.json"
    if fm.exists():
        try: fixture = set(json.loads(fm.read_text(encoding="utf-8")))
        except Exception: pass
    def _rel(p): return str(p.relative_to(workdir)).replace("\\", "/")
    files = [p for p in workdir.rglob("*") if p.is_file() and p.suffix in CODE_EXT
             and "__pycache__" not in p.parts and "node_modules" not in p.parts
             and not p.name.startswith((".", "_")) and _rel(p) not in fixture]
    src = [p for p in files if not _is_test(p, workdir)]
    tst = [p for p in files if _is_test(p, workdir)]
    test_loc = sum(_count(p, True) for p in tst)
    if selfcheck_as_test:
        total = code = sc_test = 0
        for p in src:
            t, c, st, _ = _selfcheck_split(p)
            total += t; code += c; sc_test += st
        return {"files": len(files), "src_files": len(src),
                "total_loc": total, "src_loc": code,
                "test_files": len(tst), "test_loc": test_loc + sc_test}
    return {"files": len(files), "src_files": len(src),
            "total_loc": sum(_count(p, True) for p in src),   # incl comments + docstrings (the bloat)
            "src_loc": sum(_count(p, False) for p in src),    # code only
            "test_files": len(tst), "test_loc": test_loc}

def _git(workdir, *args):
    return subprocess.run([shutil.which("git") or "git", *args], cwd=str(workdir),
                          capture_output=True, text=True)

def _git_snapshot(workdir):
    """Commit the seeded repo so we can diff exactly what the agent changes."""
    _git(workdir, "init", "-q")
    _git(workdir, "add", "-A")
    _git(workdir, "-c", "user.email=bench@local", "-c", "user.name=bench",
         "commit", "-q", "-m", "base", "--no-verify")

_SKIP_DIFF = ("-lock", ".lock", ".gen.ts", "lock.json", "routeTree.gen")
def git_diff_stats(workdir):
    """Added lines (incl comments) of code files the agent created OR modified, vs the seeded
    base. This is the delivered-code metric and matches the '+N' a PR/diff shows. Tests counted
    separately; lockfiles/generated files skipped."""
    _git(workdir, "add", "-A")
    out = _git(workdir, "diff", "--cached", "--numstat", "HEAD").stdout
    loc = files = test_loc = test_files = 0
    for line in out.splitlines():
        parts = line.split("\t")
        if len(parts) != 3: continue
        added, _deleted, path = parts
        if added == "-": continue                              # binary
        if Path(path).suffix not in CODE_EXT: continue
        if any(k in path for k in _SKIP_DIFF) or "node_modules" in path: continue
        n = int(added)
        if _is_test(Path(workdir) / path, Path(workdir)): test_loc += n; test_files += 1
        else: loc += n; files += 1
    return {"files": files, "src_files": files, "total_loc": loc, "src_loc": loc,
            "test_files": test_files, "test_loc": test_loc}

def selftest():
    """Each task's good ref must score correct+safe; the bad ref must be caught on its
    declared axis. Verifies the instruments before any API spend."""
    failures = 0
    for tid, task in TASKS.items():
        if task.get("open"): continue  # open tasks measure LOC only, no good/bad refs
        axis = task.get("axis", "safe")
        for kind in ("good", "bad"):
            with tempfile.TemporaryDirectory() as d:
                for fn, content in task.get("seed", {}).items():   # seed siblings (a helper module
                    (Path(d) / fn).write_text(content, encoding="utf-8")  # the ref imports) too
                (Path(d) / task["file"]).write_text(task[kind], encoding="utf-8")  # entry = the ref
                r = task["score"](Path(d))
            ok = (r["correct"] == 1 and r["safe"] == 1) if kind == "good" else (r[axis] == 0)
            print(f"{'ok ' if ok else 'XX '} {tid:12} {kind:4} correct={r['correct']} "
                  f"safe={r['safe']} axis={axis}  {r['reason']}")
            failures += 0 if ok else 1
    failures += _selftest_plugin_dir()
    print(f"\nselftest: {'all instruments valid' if not failures else str(failures) + ' BROKEN'}")
    return failures

def _selftest_plugin_dir():
    """Plugin-dir resolution must be portable: env override wins, and a missing install
    fails loudly (sys.exit) instead of silently passing a non-existent path to --plugin-dir."""
    fails = 0
    sentinel = "/tmp/ponytail-selftest-plugin-dir"
    os.environ["PONYTAIL_PLUGIN_DIR"] = sentinel
    try:
        ok_env = _plugin_dir("ponytail") == sentinel
    finally:
        del os.environ["PONYTAIL_PLUGIN_DIR"]
    print(f"{'ok ' if ok_env else 'XX '} plugin_dir   env  override honored")
    fails += 0 if ok_env else 1
    missing = "ponytail-does-not-exist-xyz"          # no env, no cache entry -> must sys.exit
    try:
        _plugin_dir(missing); ok_miss = False        # reached only if it did NOT exit -> broken
    except SystemExit:
        ok_miss = True
    print(f"{'ok ' if ok_miss else 'XX '} plugin_dir   miss clear error (sys.exit)")
    return fails + (0 if ok_miss else 1)

def chat_code_loc(text):
    """LOC of fenced code blocks in a chat answer: (total incl comments, code-only)."""
    total = code = 0
    for b in re.findall(r"```[a-zA-Z0-9_+-]*\r?\n(.*?)```", text or "", re.S):
        for ln in b.splitlines():
            s = ln.strip()
            if not s: continue
            total += 1
            if not s.startswith(("#", "//", "*", "/*", "*/")): code += 1
    return total, code

def score_workspace(task_id, arm, model, workdir: Path):
    meta, result_text = {}, ""
    cj = workdir / "_claude.json"
    if cj.exists():
        try:
            j = json.loads(cj.read_text(encoding="utf-8"))
            u = j.get("usage") or {}
            meta = {"cost": j.get("total_cost_usd"), "duration_ms": j.get("duration_ms"),
                    "turns": j.get("num_turns"), "denials": len(j.get("permission_denials") or []),
                    "out_tokens": u.get("output_tokens"), "in_tokens": u.get("input_tokens"),
                    "cache_tokens": (u.get("cache_read_input_tokens") or 0) + (u.get("cache_creation_input_tokens") or 0)}
            result_text = j.get("result", "")
        except Exception: pass
    surgical = not TASKS[task_id].get("open") and not TASKS[task_id].get("fixture")
    stats = git_diff_stats(workdir) if TASKS[task_id].get("fixture") else code_stats(workdir, selfcheck_as_test=surgical)
    # open/explain tasks answer in the chat, not a file. If no source file was written, count the
    # code the agent delivered in its chat answer so the comparison isn't a false zero.
    if TASKS[task_id].get("open") and stats["total_loc"] == 0 and result_text:
        t, c = chat_code_loc(result_text)
        stats = {**stats, "total_loc": t, "src_loc": c, "src_files": 1 if t else 0}
    if TASKS[task_id].get("fixture"):
        sc = {"correct": 1 if stats.get("total_loc", 0) > 0 else 0, "safe": 1, "reason": "git-diff"}
    else:
        sc = TASKS[task_id]["score"](workdir)
    return {"task": task_id, "arm": arm, "model": model, **sc, **stats, **meta}

def run_cell(task_id, arm, model, workdir: Path):
    task = TASKS[task_id]
    if task.get("fixture"):                            # copy a real repo in; record what was seeded
        fx = Path(task["fixture"])                     # absolute path, or a name under fixtures/
        if not fx.is_absolute(): fx = Path(__file__).resolve().parent / "fixtures" / task["fixture"]
        shutil.copytree(fx, workdir, dirs_exist_ok=True,
                        ignore=shutil.ignore_patterns("node_modules", ".git", "build", "dist",
                                                       "dist-ssr", ".vite", "*.log", "__pycache__",
                                                       "storage", ".venv", "venv", ".pytest_cache",
                                                       "*.mp4", "*.mp3", "*.wav", "*.mov",
                                                       "*service-account*.json",
                                                       "nul", "con", "prn", "aux",
                                                       "DatePicker*.tsx", "DatePicker*.jsx"))
        manifest = sorted(str(p.relative_to(workdir)).replace("\\", "/")
                          for p in workdir.rglob("*") if p.is_file())
        (workdir / "_fixture_files.json").write_text(json.dumps(manifest), encoding="utf-8")
    for fn, content in task.get("seed", {}).items():
        (workdir / fn).write_text(content, encoding="utf-8")
    if task.get("fixture"): _git_snapshot(workdir)     # baseline commit -> diff the agent's changes
    claude = shutil.which("claude")
    if not claude: sys.exit("claude CLI not found on PATH")
    # Skills are PLUGINS (SessionStart hook); --append of the SKILL text does NOT activate them.
    # Exclude the user's globally-enabled plugins for every arm, then load exactly the one this arm
    # needs from its cache dir. baseline loads none; yagni-oneliner is a raw prompt so it uses --append.
    # No live verification (see NO_RUN): --strict-mcp-config drops all MCP servers so there is no browser
    # tool, and --disallowedTools Bash blocks running a server/db/npm. An agent writes with
    # Read/Write/Edit/Glob/Grep and stops -- no login wall, no browser thrash. We measure code, not execution.
    cmd = [claude, "-p", task["prompt"], "--model", MODELS[model],
           "--permission-mode", "bypassPermissions", "--output-format", "json",
           "--setting-sources", "project,local", "--strict-mcp-config",
           "--disallowedTools", "Bash"]
    append = NO_RUN                                     # all arms get NO_RUN, identically
    if arm in PLUGIN_ARMS:
        cmd += ["--plugin-dir", _plugin_dir(arm)]       # real activation of exactly one plugin
    else:
        extra = ARMS[arm]()                             # baseline -> None; yagni-oneliner -> the prompt
        if extra: append = extra + "\n\n" + NO_RUN
    cmd += ["--append-system-prompt", append]
    out_path, err_path = workdir / "_claude.json", workdir / "_claude.stderr.txt"
    # stdout -> file, never a PIPE: on Windows a hung agent's child processes can hold a stdout PIPE
    # open forever, so subprocess.run(timeout=) never fires and the worker freezes. Writing to a file
    # lets proc.wait(timeout) return reliably; on timeout we tree-kill ONLY this cell's process
    # (taskkill /T on proc.pid) -- never a blanket kill, which would also take down this Claude Code session.
    try:
        with open(out_path, "wb") as so, open(err_path, "wb") as se:
            proc = subprocess.Popen(cmd, cwd=str(workdir), stdout=so, stderr=se)
            try:
                proc.wait(timeout=CELL_TIMEOUT)
            except subprocess.TimeoutExpired:
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                try: proc.wait(timeout=15)
                except Exception: pass
                se.write(f"\n[KILLED after {CELL_TIMEOUT}s timeout]".encode())
    except Exception as e:
        out_path.write_text(json.dumps({"error": str(e)[:300]}), encoding="utf-8")
    return score_workspace(task_id, arm, model, workdir)

def aggregate(results):
    groups = defaultdict(list)
    for r in results: groups[(r["task"], r["arm"], r["model"])].append(r)
    rows = []
    for (t, a, m), cells in sorted(groups.items()):
        n = len(cells)
        costs = [c["cost"] for c in cells if c.get("cost") is not None]
        loc_cells = [c for c in cells if c.get("total_loc", 0) > 0]   # LOC only where code was delivered
        nl = len(loc_cells)
        rows.append({"task": t, "arm": a, "model": m, "n": n,
                     "safe_rate": round(sum(c["safe"] for c in cells) / n, 3),
                     "correct_rate": round(sum(c["correct"] for c in cells) / n, 3),
                     "wrote_file_rate": round(nl / n, 3),
                     "total_loc_median": statistics.median(c["total_loc"] for c in loc_cells) if nl else 0,
                     "src_loc_median": statistics.median(c["src_loc"] for c in loc_cells) if nl else 0,
                     "total_loc_max": max((c["total_loc"] for c in loc_cells), default=0),
                     "src_files_median": statistics.median(c["src_files"] for c in loc_cells) if nl else 0,
                     "wrote_tests_rate": round(sum(1 for c in cells if c.get("test_files", 0) > 0) / n, 3),
                     "cost_mean": round(statistics.mean(costs), 4) if costs else None,
                     "out_tokens_mean": (round(statistics.mean([c["out_tokens"] for c in cells if c.get("out_tokens") is not None]))
                                         if any(c.get("out_tokens") is not None for c in cells) else None),
                     "total_tokens_mean": (round(statistics.mean([(c.get("in_tokens") or 0) + (c.get("out_tokens") or 0) + (c.get("cache_tokens") or 0)
                                                                   for c in cells if c.get("out_tokens") is not None]))
                                           if any(c.get("out_tokens") is not None for c in cells) else None),
                     "time_s_mean": (round(statistics.mean([c["duration_ms"] / 1000 for c in cells if c.get("duration_ms") is not None]), 1)
                                     if any(c.get("duration_ms") is not None for c in cells) else None)})
    return rows

def print_table(rows):
    by = defaultdict(list)
    for r in rows: by[(r["task"], r["model"])].append(r)
    for (task, model), rs in sorted(by.items()):
        print(f"\n=== {task}  ({model}, n={rs[0]['n']}) ===")
        print(f"  {'arm':16} {'wrote%':>7} {'correct':>8} {'LOC':>7} {'tot_tok':>9} {'$/run':>8} {'time_s':>7}")
        for r in sorted(rs, key=lambda x: x["arm"]):
            c = ("$" + format(r["cost_mean"], ".4f")) if r["cost_mean"] is not None else "-"
            tt = r.get("total_tokens_mean"); t = r.get("time_s_mean")
            print(f"  {r['arm']:16} {r.get('wrote_file_rate', 1.0):>7} {r['correct_rate']:>8} "
                  f"{r['total_loc_median']:>7} {(tt if tt is not None else '-'):>9} {c:>8} "
                  f"{(t if t is not None else '-'):>7}")

def rescore(run_dir):
    run_dir = Path(run_dir)
    if not run_dir.exists():                     # accept "<stamp>" or "runs/<stamp>" from any cwd
        run_dir = RUNS_DIR / run_dir.name
    results = []
    for ws in sorted(p for p in run_dir.iterdir() if p.is_dir()):
        parts = ws.name.split("__")
        if len(parts) != 4 or parts[0] not in TASKS: continue
        tid, arm, model, _r = parts
        results.append(score_workspace(tid, arm, model, ws))
    rows = aggregate(results)
    (run_dir / "results.json").write_text(json.dumps({"rescored": True, "results": results}, indent=2), encoding="utf-8")
    (run_dir / "summary.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
    print_table(rows)
    print(f"\nrescored {len(results)} cells from {run_dir}")

def _claude_version():
    try: return subprocess.run([shutil.which("claude"), "--version"], capture_output=True, text=True).stdout.strip()
    except Exception: return "unknown"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--rescore", help="recompute metrics from a kept run dir (no API)")
    ap.add_argument("--task", help="single task id")
    ap.add_argument("--all", action="store_true", help="all tasks")
    ap.add_argument("--arms", default=",".join(ARMS))
    ap.add_argument("--model", help="single model (shorthand for --models)")
    ap.add_argument("--models", default="haiku", help="comma list: haiku,sonnet,opus")
    ap.add_argument("--runs", type=int, default=1)
    ap.add_argument("--workers", type=int, default=4, help="cells to run concurrently (default 4; cells are fully isolated)")
    args = ap.parse_args()

    if args.selftest:
        sys.exit(1 if selftest() else 0)
    if args.rescore:
        return rescore(args.rescore)
    if selftest():
        sys.exit("instruments broken; refusing to spend on the API")

    task_ids = (list(TASKS) if args.all
                else ([t.strip() for t in args.task.split(",")] if args.task else []))
    if not task_ids: sys.exit("give --task <id> (comma list ok), --all, or --rescore <dir>")
    arms = [a.strip() for a in args.arms.split(",")]
    models = [m.strip() for m in (args.model or args.models).split(",")]
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    out_dir = RUNS_DIR / stamp
    out_dir.mkdir(parents=True, exist_ok=True)

    cells = [(tid, arm, model, r)
             for tid in task_ids for model in models for arm in arms for r in range(args.runs)]
    total = len(cells)
    results, done = [], 0

    def _one(spec):
        tid, arm, model, r = spec
        ws = out_dir / f"{tid}__{arm}__{model}__{r}"
        ws.mkdir(parents=True, exist_ok=True)
        return run_cell(tid, arm, model, ws)

    print(f"running {total} cells, {args.workers} at a time", flush=True)
    # Cells are fully isolated (own copy + own claude context), so they parallelize safely.
    # To STOP a parallel run, kill the whole tree: taskkill /PID <pid> /T /F. Killing just the
    # python orchestrator orphans the concurrent `claude` children and they keep spending.
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(_one, s): s for s in cells}
        for fut in concurrent.futures.as_completed(futs):
            tid, arm, model, r = futs[fut]
            try:
                res = fut.result()
            except Exception as e:
                res = {"task": tid, "arm": arm, "model": model, "error": str(e)[:200]}
            results.append(res)
            done += 1
            print(f"  [{done}/{total}] {tid} / {arm} / {model} #{r}  "
                  f"LOC={res.get('total_loc')} "
                  f"tok={(res.get('in_tokens') or 0) + (res.get('out_tokens') or 0) + (res.get('cache_tokens') or 0)} "
                  f"cost=${res.get('cost')} time={round((res.get('duration_ms') or 0) / 1000, 1)}s "
                  f"correct={res.get('correct')}", flush=True)
            (out_dir / "results.json").write_text(json.dumps(
                {"date": stamp, "models": {m: MODELS[m] for m in models},
                 "claude": _claude_version(), "results": results}, indent=2), encoding="utf-8")

    rows = aggregate(results)
    (out_dir / "summary.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
    print_table(rows)
    print(f"\nwrote {out_dir}/results.json + summary.json ({len(results)} cells)")

if __name__ == "__main__":
    main()
