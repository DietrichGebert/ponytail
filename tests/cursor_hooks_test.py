#!/usr/bin/env python3
"""Cursor beforeSubmitPrompt: ordinary prompts must inject ponytail."""
import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRACKER = ROOT / "hooks" / "ponytail-mode-tracker.js"
DROP = (
    "CURSOR_VERSION",
    "CURSOR_PROJECT_DIR",
    "CLAUDE_PROJECT_DIR",
    "CLAUDE_PLUGIN_ROOT",
    "PLUGIN_DATA",
    "COPILOT_PLUGIN_DATA",
    "QODER_SESSION_ID",
    "PONYTAIL_DEFAULT_MODE",
)


def run_tracker(home, project, prompt, *, cursor_env=True, payload=None):
    env = {k: v for k, v in os.environ.items() if k not in DROP}
    env["HOME"] = str(home)
    env["USERPROFILE"] = str(home)
    env["XDG_CONFIG_HOME"] = str(home / ".config")
    env["PONYTAIL_DEFAULT_MODE"] = "full"
    if cursor_env:
        env["CURSOR_VERSION"] = "3.24.12"
        env["CURSOR_PROJECT_DIR"] = str(project)
        env["CLAUDE_PROJECT_DIR"] = str(project)
    body = {"hook_event_name": "beforeSubmitPrompt", "prompt": prompt}
    if payload:
        body.update(payload)
    return subprocess.run(
        ["node", str(TRACKER)],
        input=json.dumps(body),
        env=env,
        capture_output=True,
        text=True,
        timeout=5,
        cwd=str(project),
        check=False,
    )


class CursorHookTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="ponytail-py-"))
        self.home = self.tmp / "home"
        self.project = self.tmp / "project"
        self.home.mkdir()
        self.project.mkdir()
        self.flag = self.home / ".cursor" / ".ponytail-active"
        self.flag.parent.mkdir(parents=True)
        self.flag.write_text("full")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_ordinary_prompt_injects(self):
        r = run_tracker(self.home, self.project, "hello")
        self.assertEqual(r.returncode, 0, r.stderr)
        out = json.loads(r.stdout)
        self.assertTrue(out.get("continue"))
        self.assertTrue(
            out["additional_context"].startswith("PONYTAIL MODE ACTIVE — level: full")
        )

    def test_stdin_cursor_version_without_env(self):
        r = run_tracker(
            self.home,
            self.project,
            "hello",
            cursor_env=False,
            payload={
                "cursor_version": "3.24.12",
                "workspace_roots": [str(self.project)],
            },
        )
        self.assertEqual(r.returncode, 0, r.stderr)
        out = json.loads(r.stdout)
        self.assertTrue(
            out["additional_context"].startswith("PONYTAIL MODE ACTIVE — level: full")
        )

    def test_always_on_rule_stays_silent(self):
        rule = self.project / ".cursor" / "rules" / "ponytail.mdc"
        rule.parent.mkdir(parents=True)
        shutil.copy(ROOT / ".cursor" / "rules" / "ponytail.mdc", rule)
        r = run_tracker(self.home, self.project, "hello")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(r.stdout, "")


if __name__ == "__main__":
    unittest.main()
