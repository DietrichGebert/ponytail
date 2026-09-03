import argparse
import sys
from pathlib import Path
from occam_core.engine import analyze_source

def main():
    parser = argparse.ArgumentParser(prog="occam", description="OCCAM-CORE AST Complexity & Invariant Auditor")
    subparsers = parser.add_subparsers(dest="command", required=True)

    check_parser = subparsers.add_parser("check", help="Audit files for over-engineering or golfing violations")
    check_parser.add_argument("files", nargs="+", help="Files to inspect")
    check_parser.add_argument("--max-cyclomatic", type=int, default=15, help="Cyclomatic threshold")
    check_parser.add_argument("--max-depth", type=int, default=12, help="AST depth threshold")

    args = parser.parse_args()

    if args.command == "check":
        failed = False
        for fpath in args.files:
            p = Path(fpath)
            if not p.exists() or not p.name.endswith(".py"):
                continue
            code = p.read_text(encoding="utf-8")
            try:
                m = analyze_source(code)
                print(f"[OCCAM] {fpath}: LOC={m.loc} | Depth={m.ast_depth} | Cyclo={m.cyclomatic_complexity} | HalsteadV={m.halstead_volume:.1f}")
                if m.cyclomatic_complexity > args.max_cyclomatic:
                    print(f"  \033[1;31m[FAIL]\033[0m Cyclomatic complexity {m.cyclomatic_complexity} > {args.max_cyclomatic}")
                    failed = True
                if m.ast_depth > args.max_depth:
                    print(f"  \033[1;31m[FAIL]\033[0m AST depth {m.ast_depth} > {args.max_depth}")
                    failed = True
            except Exception as e:
                print(f"[ERROR] Failed parsing {fpath}: {e}")
                failed = True
        sys.exit(1 if failed else 0)

if __name__ == "__main__":
    main()
