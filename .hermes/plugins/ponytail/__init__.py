"""ponytail — Hermes plugin.

Injects the ponytail ruleset into every LLM call as user-message context
(via the ``pre_llm_call`` hook), so the agent follows the lazy-senior-dev
ladder without touching the system prompt cache.

Reads the shared SKILL.md that lives in ``~/.config/ponytail/skills/ponytail/``
(the install script copies it there).  Mode is resolved from:
  1. ``~/.hermes/.ponytail-active``  (persisted by ``/ponytail <level>``)
  2. ``PONYTAIL_DEFAULT_MODE`` env var
  3. ``~/.config/ponytail/config.json`` → ``defaultMode``
  4. ``full``
"""

import os
import sys
import re
import json

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_HOME = os.path.expanduser("~")
_CONFIG_DIR = os.environ.get(
    "XDG_CONFIG_HOME", os.path.join(_HOME, ".config")
)
_PONYTAIL_CONFIG_DIR = os.path.join(_CONFIG_DIR, "ponytail")
_SKILL_PATH = os.path.join(
    _PONYTAIL_CONFIG_DIR, "skills", "ponytail", "SKILL.md"
)
_MODE_FILE = os.path.join(_HOME, ".hermes", ".ponytail-active")
_CONFIG_FILE = os.path.join(_PONYTAIL_CONFIG_DIR, "config.json")

_VALID_MODES = {"off", "lite", "full", "ultra"}
_DEFAULT_MODE = "full"

# Cache the ruleset text so we don't re-read the file every turn.
_cached_rules: str | None = None
_cached_mtime: float | None = None


# ---------------------------------------------------------------------------
# Mode resolution  (mirrors hooks/ponytail-config.js)
# ---------------------------------------------------------------------------

def _read_mode() -> str:
    """Return the active ponytail mode."""
    # 1. Persisted flag file (written by /ponytail commands)
    try:
        with open(_MODE_FILE) as f:
            mode = f.read().strip().lower()
            if mode in _VALID_MODES:
                return mode
    except OSError:
        pass

    # 2. Environment variable
    env = os.environ.get("PONYTAIL_DEFAULT_MODE", "").strip().lower()
    if env in _VALID_MODES:
        return env

    # 3. Config file
    try:
        with open(_CONFIG_FILE) as f:
            cfg = json.load(f)
            mode = str(cfg.get("defaultMode", "")).strip().lower()
            if mode in _VALID_MODES:
                return mode
    except (OSError, json.JSONDecodeError, AttributeError):
        pass

    return _DEFAULT_MODE


def _strip_frontmatter(text: str) -> str:
    """Remove YAML frontmatter delimiters from the top of a Markdown file."""
    return re.sub(r"^---\n[\s\S]*?\n---\n?", "", text, count=1)


# ---------------------------------------------------------------------------
# Hook
# ---------------------------------------------------------------------------

def _pre_llm_call(**kwargs):
    """Inject ponytail ruleset into the current turn's context."""
    global _cached_rules, _cached_mtime

    mode = _read_mode()
    if mode == "off":
        return None

    # Load (and cache) the ruleset
    try:
        mtime = os.path.getmtime(_SKILL_PATH)
    except OSError:
        return None

    if _cached_rules is None or _cached_mtime != mtime:
        try:
            with open(_SKILL_PATH) as f:
                raw = f.read()
            _cached_rules = _strip_frontmatter(raw).strip()
            _cached_mtime = mtime
        except OSError:
            return None

    return {"context": _cached_rules}


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

def register(ctx):
    """Called by the Hermes plugin loader."""
    if not os.path.isfile(_SKILL_PATH):
        print(
            f"ponytail: SKILL.md not found at {_SKILL_PATH}; "
            "run the ponytail install script first.",
            file=sys.stderr,
        )
        return

    ctx.register_hook("pre_llm_call", _pre_llm_call)
