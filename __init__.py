"""Hermes Agent adapter for Ponytail."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

PLUGIN_DIR = Path(__file__).resolve().parent
SKILLS_DIR = PLUGIN_DIR / "skills"
DEFAULT_MODE = "full"
VALID_MODES = {"off", "lite", "full", "ultra"}
ACTIVE_MODES = VALID_MODES - {"off"}

_MODE_CMD = re.compile(r"^/ponytail(?:\s+(on|off|lite|full|ultra))?\s*$")
_MODES: dict[str, str] = {}


def _mode(value: object) -> str | None:
    value = str(value or "").strip().lower()
    if value == "on":
        return DEFAULT_MODE
    return value if value in VALID_MODES else None


def _key(session_id: object = None) -> str:
    return str(session_id or "global")


def _get_mode(session_id: object = None) -> str:
    return _MODES.get(_key(session_id)) or _MODES.get("global") or "off"


def _set_mode(mode: str, session_id: object = None) -> str:
    _MODES[_key(session_id)] = _mode(mode) or DEFAULT_MODE
    return _MODES[_key(session_id)]


def _hermes_line(line: str) -> str:
    line = line.replace('Off only: "stop ponytail" / "normal mode".', "Off: `/ponytail off`.")
    return line.replace('"stop ponytail" / "normal mode": revert.', "`/ponytail off`: revert.")


def _skill_body(mode: str) -> str:
    body = re.sub(
        r"^---[\s\S]*?---\s*",
        "",
        (SKILLS_DIR / "ponytail" / "SKILL.md").read_text(encoding="utf-8"),
        count=1,
    )
    kept: list[str] = []
    for line in body.splitlines():
        label = re.match(r"^\|\s*\*\*(.+?)\*\*\s*\|", line) or re.match(r"^-\s*([^:]+):\s*", line)
        if label and label.group(1).strip().lower() in ACTIVE_MODES - {mode}:
            continue
        kept.append(_hermes_line(line))
    return "\n".join(kept)


def _instructions(mode: str) -> str:
    mode = mode if mode in ACTIVE_MODES else DEFAULT_MODE
    return f"PONYTAIL MODE ACTIVE — level: {mode}\n\n" + _skill_body(mode)


def _pre_llm_call(**kwargs: Any) -> dict[str, str] | None:
    session_id = kwargs.get("session_id")
    prompt = str(kwargs.get("user_message") or "").strip().lower()

    if match := _MODE_CMD.match(prompt):
        requested = match.group(1)
        if requested:
            _set_mode(requested, session_id)

    mode = _get_mode(session_id)
    return {"context": _instructions(mode)} if mode in ACTIVE_MODES else None


def _handle_ponytail_command(args: str = "") -> str:
    mode = _mode(args)
    if not mode:
        return "Usage: /ponytail on|off|lite|full|ultra"
    return f"Ponytail mode: {_set_mode(mode, 'global')}"


def register(ctx: Any) -> None:
    ctx.register_hook("pre_llm_call", _pre_llm_call)
    for skill_md in sorted(SKILLS_DIR.glob("*/SKILL.md")):
        ctx.register_skill(skill_md.parent.name, skill_md)
    ctx.register_command(
        "ponytail",
        _handle_ponytail_command,
        description="Set Ponytail mode: on/off/lite/full/ultra",
        args_hint="on|off|lite|full|ultra",
    )
