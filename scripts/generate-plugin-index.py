#!/usr/bin/env python3
"""Generate the plugin component catalog (.grok-plugin/plugin-index.json).

For every entry in `.grok-plugin/marketplace.json`, this script resolves the
plugin's source (local directories are scanned in place; url sources are
shallow-fetched at their pinned commit sha) and records which components the
plugin provides: skills, commands, agents, MCP servers, hooks, and LSP
servers. Clients use this to show what a plugin contains before installing it.

The output is deterministic — sorted keys, items sorted by name, no
timestamps — so CI can regenerate it and fail on any diff.

Generate:       python3 scripts/generate-plugin-index.py
Verify (CI):    python3 scripts/generate-plugin-index.py --check
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

INDEX_PATH = Path(".grok-plugin/plugin-index.json")
CATALOG_PATH = Path(".grok-plugin/marketplace.json")

MAX_ITEMS_PER_CATEGORY = 50
MAX_STRING_LEN = 120
MAX_TEXT_READ_BYTES = 64 * 1024
MAX_JSON_BYTES = 1 << 20
FETCH_ATTEMPTS = 3

SHA_RE = re.compile(r"^[0-9a-f]{40}$")

MANIFEST_PATHS = [
    Path(".grok-plugin/plugin.json"),
    Path(".claude-plugin/plugin.json"),
]

CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def clean(text: str) -> str:
    text = re.sub(r"\s+", " ", CONTROL_CHARS_RE.sub("", text)).strip()
    if len(text) > MAX_STRING_LEN:
        text = text[: MAX_STRING_LEN - 1].rstrip() + "\u2026"
    return text


def resolve_inside(root: Path, relative) -> Path | None:
    """Resolve `relative` against `root`, returning None if the result
    escapes `root` (via `..`, absolute paths, or symlinks). Plugin content
    is untrusted; nothing outside the plugin tree may be read."""
    try:
        candidate = (root / relative).resolve()
        if candidate.is_relative_to(root.resolve()):
            return candidate
    except (OSError, ValueError):
        return None
    return None


def contained(path: Path, root: Path) -> bool:
    try:
        return path.resolve().is_relative_to(root.resolve())
    except (OSError, ValueError):
        return False


def read_text_limited(path: Path) -> str:
    with open(path, encoding="utf-8", errors="replace") as f:
        return f.read(MAX_TEXT_READ_BYTES)


def load_json_file(path: Path):
    try:
        if path.stat().st_size > MAX_JSON_BYTES:
            return None
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def parse_frontmatter(path: Path) -> dict[str, str]:
    """Tolerant YAML-ish frontmatter parser: top-level `key: value` lines only."""
    try:
        text = read_text_limited(path)
    except OSError:
        return {}
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}
    fields: dict[str, str] = {}
    i = 1
    while i < len(lines):
        line = lines[i]
        if line.strip() in ("---", "..."):
            break
        m = re.match(r"^([A-Za-z0-9_-]+):\s*(.*)$", line)
        if not m:
            i += 1
            continue
        key, value = m.group(1), m.group(2).strip()
        if re.match(r"^[|>][+-]?$", value):
            block: list[str] = []
            j = i + 1
            while j < len(lines) and (lines[j].startswith((" ", "\t")) or not lines[j].strip()):
                if lines[j].strip():
                    block.append(lines[j].strip())
                j += 1
            value = " ".join(block)
            i = j
        else:
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            i += 1
        fields[key] = value
    return fields


def first_body_line(path: Path) -> str:
    """First non-empty, non-heading line after any frontmatter block."""
    try:
        text = read_text_limited(path)
    except OSError:
        return ""
    lines = text.splitlines()
    i = 0
    if lines and lines[0].strip() == "---":
        for j in range(1, len(lines)):
            if lines[j].strip() in ("---", "..."):
                i = j + 1
                break
    for line in lines[i:]:
        stripped = line.strip()
        if stripped and not stripped.startswith("#"):
            return stripped
    return ""


def make_item(name: str, description: str = "") -> dict:
    item = {"name": clean(name)}
    description = clean(description)
    if description:
        item["description"] = description
    return item


def load_manifest(root: Path) -> dict:
    for rel in MANIFEST_PATHS:
        path = resolve_inside(root, rel)
        if path and path.is_file():
            data = load_json_file(path)
            if isinstance(data, dict):
                return data
    return {}


def as_list(value) -> list:
    if isinstance(value, list):
        return value
    if value is None:
        return []
    return [value]


def scan_skills(root: Path, manifest: dict) -> list[dict]:
    skill_dirs: dict[Path, str] = {}
    for base in [root / "skills"]:
        if base.is_dir():
            for child in sorted(base.iterdir()):
                skill_md = child / "SKILL.md"
                if skill_md.is_file() and contained(skill_md, root):
                    skill_dirs[child.resolve()] = child.name
    for entry in as_list(manifest.get("skills")):
        if isinstance(entry, str):
            candidate = resolve_inside(root, entry)
            if candidate and (candidate / "SKILL.md").is_file() and contained(candidate / "SKILL.md", root):
                skill_dirs.setdefault(candidate, candidate.name)
    items = []
    for skill_dir, dirname in skill_dirs.items():
        fm = parse_frontmatter(skill_dir / "SKILL.md")
        items.append(make_item(fm.get("name") or dirname, fm.get("description", "")))
    return items


def scan_markdown_dir(root: Path, dirname: str, manifest_key: str, manifest: dict) -> list[dict]:
    files: dict[Path, str] = {}
    base = root / dirname
    if base.is_dir():
        for path in sorted(base.rglob("*.md")):
            if path.is_file() and contained(path, root):
                files[path.resolve()] = path.stem
    for entry in as_list(manifest.get(manifest_key)):
        if isinstance(entry, str):
            candidate = resolve_inside(root, entry)
            if candidate and candidate.is_file() and candidate.suffix == ".md":
                files.setdefault(candidate, candidate.stem)
    items = []
    for path, stem in files.items():
        fm = parse_frontmatter(path)
        description = fm.get("description") or first_body_line(path)
        items.append(make_item(fm.get("name") or stem, description))
    return items


def transport_hint(config: dict) -> str:
    if not isinstance(config, dict):
        return ""
    transport = config.get("type") or config.get("transport")
    if not transport:
        if config.get("command"):
            transport = "stdio"
        elif config.get("url"):
            transport = "http"
    return str(transport) if transport else ""


def scan_mcp_servers(root: Path, manifest: dict) -> list[dict]:
    servers: dict[str, dict] = {}
    declared = manifest.get("mcpServers")
    config_rel = declared if isinstance(declared, str) else ".mcp.json"
    mcp_path = resolve_inside(root, config_rel)
    if mcp_path and mcp_path.is_file():
        data = load_json_file(mcp_path)
        if isinstance(data, dict) and isinstance(data.get("mcpServers"), dict):
            servers.update(data["mcpServers"])
    if isinstance(declared, dict):
        for name, config in declared.items():
            servers.setdefault(name, config)
    return [make_item(name, transport_hint(config)) for name, config in servers.items()]


def scan_hooks(root: Path, manifest: dict) -> list[dict]:
    data = None
    hooks_path = resolve_inside(root, Path("hooks") / "hooks.json")
    if hooks_path and hooks_path.is_file():
        data = load_json_file(hooks_path)
    if data is None:
        declared = manifest.get("hooks")
        if isinstance(declared, dict):
            data = declared
        elif isinstance(declared, str):
            declared_path = resolve_inside(root, declared)
            if declared_path and declared_path.is_file():
                data = load_json_file(declared_path)
    if not isinstance(data, dict):
        return []
    hooks_obj = data.get("hooks") if isinstance(data.get("hooks"), dict) else data
    items = []
    for event, entries in hooks_obj.items():
        if not isinstance(entries, list):
            continue
        matchers = [
            e["matcher"]
            for e in entries
            if isinstance(e, dict) and isinstance(e.get("matcher"), str) and e["matcher"]
        ]
        items.append(make_item(event, ", ".join(matchers)))
    return items


def scan_lsp_servers(root: Path, manifest: dict) -> list[dict]:
    servers: dict[str, dict] = {}
    lsp_path = resolve_inside(root, ".lsp.json")
    if lsp_path and lsp_path.is_file():
        data = load_json_file(lsp_path)
        if isinstance(data, dict):
            servers.update(data.get("lspServers") if isinstance(data.get("lspServers"), dict) else data)
    declared = manifest.get("lspServers")
    if isinstance(declared, dict):
        for name, config in declared.items():
            servers.setdefault(name, config)
    return [make_item(name) for name, config in servers.items() if isinstance(config, dict)]


def scan_plugin(root: Path) -> dict:
    manifest = load_manifest(root)
    categories = {
        "skills": scan_skills(root, manifest),
        "commands": scan_markdown_dir(root, "commands", "commands", manifest),
        "agents": scan_markdown_dir(root, "agents", "agents", manifest),
        "mcpServers": scan_mcp_servers(root, manifest),
        "hooks": scan_hooks(root, manifest),
        "lspServers": scan_lsp_servers(root, manifest),
    }
    components = {}
    for key in sorted(categories):
        items = sorted(categories[key], key=lambda i: i["name"])[:MAX_ITEMS_PER_CATEGORY]
        if items:
            components[key] = items
    return components


def run_git(cmd: list[str], url: str, sha: str) -> None:
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(
            f"failed to fetch {url} at {sha}: `{' '.join(cmd)}` exited "
            f"{result.returncode}: {result.stderr.strip()}"
        )


def fetch_pinned(url: str, sha: str, dest: Path) -> None:
    run_git(["git", "init", "--quiet", "--", str(dest)], url, sha)
    fetch_cmd = [
        "git", "-C", str(dest), "fetch", "--quiet", "--depth", "1",
        "--end-of-options", url, sha,
    ]
    last_error: RuntimeError | None = None
    for attempt in range(FETCH_ATTEMPTS):
        try:
            run_git(fetch_cmd, url, sha)
            last_error = None
            break
        except RuntimeError as e:
            last_error = e
            if attempt < FETCH_ATTEMPTS - 1:
                time.sleep(2 ** attempt)
    if last_error is not None:
        raise last_error
    run_git(["git", "-C", str(dest), "checkout", "--quiet", "--detach", sha], url, sha)


def resolve_local(repo_root: Path, path: str, name: str) -> Path:
    resolved = resolve_inside(repo_root, path)
    if resolved is None:
        raise RuntimeError(f"plugin '{name}': local source path escapes the repo: {path!r}")
    return resolved


def resolve_source(entry: dict, repo_root: Path, tmp_root: Path, idx: int) -> tuple[Path, str | None]:
    """Return (plugin root dir, pinned sha or None for local sources)."""
    name = entry.get("name", "<unnamed>")
    source = entry.get("source")
    if isinstance(source, str):
        return resolve_local(repo_root, source, name), None
    if isinstance(source, dict):
        if source.get("source") == "url" or source.get("type") == "url":
            url = source.get("url")
            sha = source.get("sha")
            if not isinstance(url, str) or not url.startswith("https://"):
                raise RuntimeError(f"plugin '{name}': url source must be an https:// url, got {url!r}")
            if not sha:
                raise RuntimeError(
                    f"plugin '{name}': url source has no pinned sha. All url "
                    f"sources must pin a full commit sha (see README)."
                )
            if not isinstance(sha, str) or not SHA_RE.match(sha):
                raise RuntimeError(
                    f"plugin '{name}': sha {sha!r} is not a 40-character "
                    f"lowercase hex commit sha"
                )
            dest = tmp_root / f"plugin-{idx}"
            fetch_pinned(url, sha, dest)
            subdir = source.get("path")
            if isinstance(subdir, str) and subdir:
                resolved = resolve_inside(dest, subdir)
                if resolved is None:
                    raise RuntimeError(f"plugin '{name}': subdir {subdir!r} escapes fetched repo")
                return resolved, sha
            return dest, sha
        if source.get("type") == "local":
            path = source.get("path")
            if isinstance(path, str):
                return resolve_local(repo_root, path, name), None
    raise RuntimeError(f"plugin '{name}': unsupported source {source!r}")


def main(argv: list[str] | None = None) -> int:
    argv = argv or sys.argv[1:]
    check_only = "--check" in argv

    if not CATALOG_PATH.exists():
        print(f"no catalog at {CATALOG_PATH}", file=sys.stderr)
        return 1

    catalog = load_json_file(CATALOG_PATH)
    if not isinstance(catalog, dict) or not isinstance(catalog.get("plugins"), list):
        print("invalid catalog", file=sys.stderr)
        return 1

    plugins = catalog["plugins"]
    index: dict[str, dict] = {}

    with tempfile.TemporaryDirectory() as tmp:
        tmp_root = Path(tmp)
        for idx, entry in enumerate(plugins):
            if not isinstance(entry, dict):
                continue
            name = entry.get("name")
            if not isinstance(name, str):
                continue
            try:
                plugin_root, pinned_sha = resolve_source(entry, Path("."), tmp_root, idx)
                components = scan_plugin(plugin_root)
                if pinned_sha:
                    components["_sha"] = pinned_sha
                index[name] = components
            except Exception as e:
                print(f"error scanning {name}: {e}", file=sys.stderr)
                if check_only:
                    return 1

    output = {
        "plugins": index,
        "generated_from": str(CATALOG_PATH),
    }

    if check_only:
        if not INDEX_PATH.exists():
            print("missing plugin-index.json", file=sys.stderr)
            return 1
        existing = load_json_file(INDEX_PATH)
        if existing != output:
            print("plugin-index.json is stale", file=sys.stderr)
            return 1
        print("plugin-index.json is up to date")
        return 0

    INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    INDEX_PATH.write_text(json.dumps(output, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {INDEX_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())