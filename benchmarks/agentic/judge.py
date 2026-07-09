#!/usr/bin/env python3
"""LLM-judge over-engineering pass for the agentic benchmark.

Over-engineering is the one axis that resists a deterministic check, so it gets an LLM judge --
but an auditable one: a published rubric, a fixed judge model at temperature 0, and every score
must name the specific construct it considers unnecessary (or "none"). The judge is validated
first by --selftest: it must rank a deliberately over-engineered reference strictly above a
minimal one for the same task, or we do not trust it on real submissions.

  python judge.py --selftest                 # validate the judge on reference pairs (small spend)
  python judge.py --run runs/<stamp>          # judge every workspace's source in a matrix run

Judge: claude-sonnet-4-6 via the Anthropic Messages API (key from ../../.env). Scores the SOURCE
files only (tests excluded -- a test is not over-engineering). Cost is ~$0.003/cell.

ponytail: stdlib urllib for the API call, no requests dependency.
"""
import argparse, json, os, re, sys, time, urllib.request
from collections import defaultdict
from pathlib import Path

from tasks import TASKS

ROOT = Path(__file__).resolve().parents[2]
RUNS_DIR = Path(__file__).resolve().parent / "runs"
JUDGE_MODEL = "claude-sonnet-4-6"

RUBRIC = (
    "You are a senior engineer reviewing a code submission for OVER-ENGINEERING ONLY. "
    "Ignore correctness, style, performance, and security. Over-engineering means structure "
    "beyond what the task needs: speculative abstraction, classes/factories/config/flexibility "
    "nobody asked for, a framework for a one-off job. Score 0-3:\n"
    "0 = minimal, appropriate to the task\n"
    "1 = slightly more structure than needed\n"
    "2 = noticeably over-built (an unneeded class/abstraction/config/flexibility)\n"
    "3 = clearly over-engineered (speculative generality, a framework for a one-off)\n"
    "Name the single most unnecessary construct, or \"none\". "
    "Respond with ONLY this JSON: {\"over_engineering\": <0-3 int>, \"why\": \"<one line>\", \"cite\": \"<construct or none>\"}"
)

def load_key():
    try:
        for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
            if line.startswith("ANTHROPIC_API_KEY=") and len(line) > 18:
                return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return os.environ.get("ANTHROPIC_API_KEY")

def _is_test(name):
    n = name.lower()
    return n.startswith("test_") or n.endswith("_test.py") or n == "conftest.py"

def source_text(workdir: Path):
    """Concatenate the agent's source files (tests + artifacts excluded), with name headers."""
    out = []
    for p in sorted(workdir.rglob("*")):
        if not p.is_file() or "__pycache__" in p.parts or p.suffix == ".pyc": continue
        if p.name.startswith((".", "_")) or _is_test(p.name): continue
        try: out.append(f"# === {p.relative_to(workdir)} ===\n{p.read_text(encoding='utf-8', errors='ignore')}")
        except Exception: continue
    return "\n\n".join(out)

def judge_call(task_prompt, files, key, retries=3, system=RUBRIC):
    user = f"TASK GIVEN TO THE AUTHOR:\n{task_prompt}\n\nFILES THEY WROTE:\n{files}"
    body = json.dumps({"model": JUDGE_MODEL, "max_tokens": 300, "temperature": 0,
                       "system": system, "messages": [{"role": "user", "content": user}]}).encode()
    for attempt in range(retries):
        try:
            req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body,
                headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                j = json.loads(r.read())
            return j["content"][0]["text"]
        except Exception as e:
            if attempt == retries - 1: return f'{{"error": "{str(e)[:120]}"}}'
            time.sleep(2 * (attempt + 1))

def parse_score(text):
    m = re.search(r"\{.*\}", text or "", re.S)
    if not m: return None
    try:
        d = json.loads(m.group(0))
        if "over_engineering" in d: d["over_engineering"] = int(d["over_engineering"])
        return d
    except Exception:
        return None

# --- selftest: the judge must rank over-engineered above minimal for the same task ---
CACHE_OVER = (
    "import time\nfrom collections import OrderedDict\n"
    "class CacheEntry:\n    def __init__(self, value, created_at):\n        self.value = value\n        self.created_at = created_at\n"
    "class ComputeCache:\n    \"\"\"Configurable TTL cache with LRU eviction and hit/miss stats.\"\"\"\n"
    "    def __init__(self, max_size=128, ttl_seconds=3600, enable_stats=True):\n"
    "        self.max_size = max_size; self.ttl_seconds = ttl_seconds; self.enable_stats = enable_stats\n"
    "        self._store = OrderedDict(); self._hits = 0; self._misses = 0\n"
    "    def _evict(self):\n        while len(self._store) > self.max_size: self._store.popitem(last=False)\n"
    "    def get_or_compute(self, n, fn):\n        now = time.time()\n"
    "        if n in self._store and now - self._store[n].created_at < self.ttl_seconds:\n"
    "            self._hits += 1; self._store.move_to_end(n); return self._store[n].value\n"
    "        self._misses += 1; v = fn(n); self._store[n] = CacheEntry(v, now); self._evict(); return v\n"
    "_cache = ComputeCache()\n"
    "def compute(n):\n    return _cache.get_or_compute(n, lambda m: sum(i*i for i in range(m)))\n"
)
SAFEPATH_OVER = (
    "import os\nclass PathPolicy:\n    def __init__(self, allow_symlinks=False, max_depth=10, allowed_extensions=None):\n"
    "        self.allow_symlinks = allow_symlinks; self.max_depth = max_depth\n        self.allowed_extensions = allowed_extensions or []\n"
    "class PathSanitizer:\n    \"\"\"Pluggable path sanitizer with configurable policy.\"\"\"\n    def __init__(self, policy=None):\n        self.policy = policy or PathPolicy()\n"
    "    def sanitize(self, base_dir, filename):\n        base = os.path.abspath(base_dir)\n        target = os.path.abspath(os.path.join(base, filename))\n"
    "        if os.path.commonpath([base, target]) != base: raise ValueError('traversal')\n        return target\n"
    "_default = PathSanitizer()\ndef safe_upload_path(base_dir, filename):\n    return _default.sanitize(base_dir, filename)\n"
)
SELFTEST_PAIRS = [
    ("cache", "minimal", TASKS["cache"]["good"]),
    ("cache", "over", CACHE_OVER),
    ("safe-path", "minimal", TASKS["safe-path"]["good"]),
    ("safe-path", "over", SAFEPATH_OVER),
]

def selftest(key):
    scores = {}
    for task_id, label, code in SELFTEST_PAIRS:
        s = parse_score(judge_call(TASKS[task_id]["prompt"], code, key))
        scores[(task_id, label)] = s
        print(f"  {task_id:10} {label:8} -> {s}")
    ok = True
    for task_id in ("cache", "safe-path"):
        lo = scores.get((task_id, "minimal"), {}) or {}
        hi = scores.get((task_id, "over"), {}) or {}
        if not (isinstance(hi.get("over_engineering"), int) and isinstance(lo.get("over_engineering"), int)
                and hi["over_engineering"] > lo["over_engineering"]):
            print(f"XX {task_id}: judge did not rank over-engineered above minimal")
            ok = False
        else:
            print(f"ok {task_id}: over({hi['over_engineering']}) > minimal({lo['over_engineering']})")
    print(f"\njudge selftest: {'valid' if ok else 'NOT TRUSTWORTHY'}")
    return 0 if ok else 1

def run(run_dir, key):
    run_dir = Path(run_dir)
    if not run_dir.exists(): run_dir = RUNS_DIR / run_dir.name
    cells, scored = [], []
    for ws in sorted(p for p in run_dir.iterdir() if p.is_dir()):
        parts = ws.name.split("__")
        if len(parts) != 4 or parts[0] not in TASKS: continue
        cells.append((parts[0], parts[1], parts[2], ws))
    print(f"judging {len(cells)} workspaces with {JUDGE_MODEL} ...")
    for i, (tid, arm, model, ws) in enumerate(cells, 1):
        s = parse_score(judge_call(TASKS[tid]["prompt"], source_text(ws), key)) or {"over_engineering": None}
        rec = {"task": tid, "arm": arm, "model": model, "over_engineering": s.get("over_engineering"),
               "why": s.get("why", ""), "cite": s.get("cite", "")}
        scored.append(rec)
        if i % 25 == 0 or i == len(cells): print(f"  [{i}/{len(cells)}]", flush=True)
        (run_dir / "judge.json").write_text(json.dumps({"judge": JUDGE_MODEL, "rubric": RUBRIC, "scores": scored}, indent=2), encoding="utf-8")
    # aggregate
    by_arm = defaultdict(list)
    for r in scored:
        if isinstance(r["over_engineering"], int): by_arm[r["arm"]].append(r["over_engineering"])
    print(f"\n=== over-engineering by arm (judge: {JUDGE_MODEL}, 0=minimal .. 3=over-built) ===")
    print(f"  {'arm':16} {'n':>4} {'mean':>6} {'max':>4}")
    for arm in ["baseline", "caveman", "ponytail", "yagni", "yagni-oneliner"]:
        v = by_arm.get(arm, [])
        if v: print(f"  {arm:16} {len(v):>4} {sum(v)/len(v):>6.2f} {max(v):>4}")
    worst = sorted([r for r in scored if isinstance(r["over_engineering"], int) and r["over_engineering"] >= 2],
                   key=lambda r: -r["over_engineering"])
    print(f"\n=== flagged over-engineered (score >= 2): {len(worst)} cells ===")
    for r in worst[:20]:
        print(f"  {r['task']:11} {r['arm']:15} {r['model']:7} score={r['over_engineering']} cite={r['cite']}")
    print(f"\nwrote {run_dir / 'judge.json'}")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--run", help="run dir to judge")
    args = ap.parse_args()
    key = load_key()
    if not key: sys.exit("no ANTHROPIC_API_KEY (.env or env)")
    if args.selftest: sys.exit(selftest(key))
    if args.run:
        if selftest(key): sys.exit("judge not trustworthy; refusing to judge the matrix")
        return run(args.run, key)
    sys.exit("give --selftest or --run <dir>")

if __name__ == "__main__":
    main()
