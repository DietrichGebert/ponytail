"""
Ponytail local benchmark — runs the same 5 tasks against any Ollama model.
No promptfoo required. Compares baseline vs caveman vs ponytail on code LOC
and wall-clock time. Results are printed as a table and saved to a JSON file.

Usage:
    python benchmarks/benchmark-local.py
    python benchmarks/benchmark-local.py --model llama3.2 --repeat 3

Prerequisites: Ollama running locally (https://ollama.com), model pulled.
"""

import argparse
import json
import re
import time
import urllib.request
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).parent.parent

TASKS = [
    ("email",      "Write me a Python function that validates email addresses."),
    ("debounce",   "Add debounce to a search input in vanilla JavaScript. It currently fires an API call on every keystroke."),
    ("csv-sum",    "Write Python code that reads sales.csv and sums the 'amount' column."),
    ("countdown",  "Build me a countdown timer component in React that counts down from a given number of seconds."),
    ("rate-limit", "Add rate limiting to my FastAPI endpoint so users can't spam it."),
]


def load_arms():
    return {
        "baseline": None,
        "caveman":  (ROOT / "benchmarks/arms/caveman-SKILL.md").read_text(encoding="utf-8"),
        "ponytail": (ROOT / "skills/ponytail/SKILL.md").read_text(encoding="utf-8"),
    }


def count_loc(text):
    """Non-blank, non-comment lines of code: fenced blocks, or the whole
    response when the model emitted bare code with no fence."""
    blocks = re.findall(r"```[a-zA-Z0-9_+\-]*\n([\s\S]*?)```", text)
    lines = ("\n".join(blocks) if blocks else text).splitlines()
    return sum(
        1 for l in lines
        if l.strip()
        and not l.strip().startswith("//")
        and not l.strip().startswith("#")
        and l.strip() not in ("*/",)
        and not l.strip().startswith("/*")
        and not l.strip().startswith("*")
    )


def call_ollama(model, system_prompt, user_prompt, ollama_url):
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": user_prompt})

    payload = json.dumps({
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {"temperature": 0.7},
    }).encode()

    req = urllib.request.Request(
        f"{ollama_url}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = json.loads(resp.read())
    elapsed = time.time() - t0
    return data["message"]["content"], round(elapsed, 1)


def run(model, repeat, ollama_url):
    arms = load_arms()
    task_ids = [t[0] for t in TASKS]
    # results[arm][task_id] = list of {loc, time}
    results = {arm: {t: [] for t in task_ids} for arm in arms}
    total = len(arms) * len(TASKS) * repeat

    done = 0
    for r in range(repeat):
        for arm, system in arms.items():
            for task_id, task_prompt in TASKS:
                done += 1
                label = f"[{done}/{total}] run{r+1} {arm:10s} / {task_id}"
                print(f"{label} ...", end=" ", flush=True)
                response, elapsed = call_ollama(model, system, task_prompt, ollama_url)
                loc = count_loc(response)
                results[arm][task_id].append({"loc": loc, "time": elapsed, "response": response})
                print(f"{loc} LOC  {elapsed}s")

    # compute medians
    def median(vals):
        s = sorted(vals)
        n = len(s)
        return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2

    med_loc  = {arm: {t: median([r["loc"]  for r in results[arm][t]]) for t in task_ids} for arm in arms}
    med_time = {arm: {t: median([r["time"] for r in results[arm][t]]) for t in task_ids} for arm in arms}

    col = 12
    header = f"{'arm':<12}" + "".join(f"{t:>{col}}" for t in task_ids) + f"{'TOTAL':>{col}}"
    sep = "-" * len(header)

    print(f"\n{'=' * 60}")
    print(f"  RESULTS - {model}  (n={repeat}, median)")
    print(f"{'=' * 60}")

    print(f"\nCode LOC per task (median)")
    print(header)
    print(sep)
    for arm in arms:
        row = [med_loc[arm][t] for t in task_ids]
        print(f"{arm:<12}" + "".join(f"{v:>{col}}" for v in row) + f"{sum(row):>{col}}")

    print(f"\nTime seconds per task (median)")
    print(header)
    print(sep)
    for arm in arms:
        row = [med_time[arm][t] for t in task_ids]
        print(f"{arm:<12}" + "".join(f"{v:>{col}.1f}" for v in row) + f"{sum(row):>{col}.1f}")

    print(f"\n{'=' * 60}")
    print("  LOC vs baseline (median totals)")
    print(f"{'=' * 60}")
    base_total = sum(med_loc["baseline"][t] for t in task_ids)
    for arm in ("caveman", "ponytail"):
        arm_total = sum(med_loc[arm][t] for t in task_ids)
        pct = (1 - arm_total / base_total) * 100 if base_total else 0
        sign = "less" if pct >= 0 else "more"
        print(f"  {arm:10s}: {arm_total} LOC  ({abs(pct):.0f}% {sign} than baseline)")

    out = Path(__file__).parent / "benchmark-local-results.json"
    out.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"\nFull responses -> {out}")


def main():
    parser = argparse.ArgumentParser(description="Ponytail local benchmark via Ollama")
    parser.add_argument("--model",      default="llama3.2", help="Ollama model name (default: llama3.2)")
    parser.add_argument("--repeat",     type=int, default=1, help="Runs per cell; median reported (default: 1)")
    parser.add_argument("--ollama-url", default="http://localhost:11434", help="Ollama base URL")
    args = parser.parse_args()

    parsed_url = urllib.parse.urlparse(args.ollama_url)
    if parsed_url.scheme not in ("http", "https"):
        parser.error(f"Invalid --ollama-url scheme: '{parsed_url.scheme}'. Only 'http' and 'https' are supported.")

    run(args.model, args.repeat, args.ollama_url)


if __name__ == "__main__":
    main()
