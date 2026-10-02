#!/usr/bin/env python3
"""
ponytail_router.py — Smart Intent Context Injector for Lazy-Dev Thinking Rules
Enables AI agents to query, filter, and inject high-leverage ponytail heuristics into prompt context.
"""
import os
import sys
import argparse

def main():
    parser = argparse.ArgumentParser(description="Ponytail Intent Router & Context Injector")
    parser.add_argument("task", nargs="*", help="User coding task")
    parser.add_argument("--format", choices=["prompt", "rules", "json"], default="prompt")
    args = parser.parse_args()

    task_desc = " ".join(args.task) if args.task else "general refactor"
    rules = [
        "Write the minimum code needed to deliver maximum value.",
        "Favor standard library solutions over heavy third-party dependencies.",
        "Automate verification: every change must be proven with a runnable check.",
        "Prevent premature abstractions: clean composition beats speculative architecture."
    ]
    
    if args.format == "json":
        import json
        print(json.dumps({"task": task_desc, "injected_rules": rules}, indent=2))
    elif args.format == "rules":
        for r in rules:
            print(f"- {r}")
    else:
        print(f"<!-- PONYTAIL SENIOR DEV HEURISTICS FOR: {task_desc} -->")
        for r in rules:
            print(f"> {r}")

if __name__ == "__main__":
    main()
