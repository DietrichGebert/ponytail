#!/usr/bin/env python3
"""Build Ponytail's skills-only ChatGPT upload ZIP."""

import argparse
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("output", type=Path)
args = parser.parse_args()

manifest = json.loads((ROOT / ".codex-plugin/plugin.json").read_text(encoding="utf-8"))
interface = manifest.pop("interface")
manifest.pop("skills")
manifest.pop("hooks")
interface.update({
    "capabilities": ["Instructions"],
    "composerIcon": "./assets/chatgpt-icon.png",
    "logo": "./assets/chatgpt-icon.png",
})
manifest = {
    "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
    **manifest,
    "extensions": {"com.openai": {"interface": interface}},
}

files = [
    ROOT / "LICENSE",
    ROOT / "assets/chatgpt-icon.png",
    *sorted((ROOT / "skills").glob("*/SKILL.md")),
]
if any(path.is_symlink() or not path.resolve().is_relative_to(ROOT) for path in files):
    parser.error("bundled files must be regular files inside the plugin")

args.output.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(args.output, "w", compression=ZIP_DEFLATED) as archive:
    archive.writestr("plugin.json", json.dumps(manifest, indent=2) + "\n")
    for path in files:
        archive.write(path, path.relative_to(ROOT).as_posix())
print(args.output)
