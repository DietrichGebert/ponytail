#!/usr/bin/env bash
# CLAUDE_CONFIG_DIR overrides ~/.claude, matching where the hooks write the flag (issue #34)
flag="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.ponytail-active"
[ -d "$flag" ] || exit 0

mode=$(PONYTAIL_STATE_DIR="$flag" node -e '
const crypto = require("crypto"), fs = require("fs"), path = require("path");
let input = ""; process.stdin.on("data", c => input += c); process.stdin.on("end", () => {
  try {
    const id = JSON.parse(input).session_id;
    if (typeof id !== "string" || !id.trim() || id.length > 512) return;
    const key = crypto.createHash("sha256").update(id.trim()).digest("hex");
    process.stdout.write(fs.readFileSync(path.join(process.env.PONYTAIL_STATE_DIR, key), "utf8").trim());
  } catch {}
});' 2>/dev/null)

# ultra is the high-intensity mode; flag it amber so it stands out from the
# default green at a glance. The level is still in the text, so color is a
# redundant cue, not the only one.
color=108
[ "$mode" = "ultra" ] && color=173

if [ -z "$mode" ] || [ "$mode" = "full" ]; then
    printf '\033[38;5;%sm[PONYTAIL]\033[0m' "$color"
else
    printf '\033[38;5;%sm[PONYTAIL:%s]\033[0m' "$color" "$(printf '%s' "$mode" | tr '[:lower:]' '[:upper:]')"
fi
