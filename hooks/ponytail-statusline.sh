#!/usr/bin/env bash

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
helper="$script_dir/ponytail-statusline.js"
if command -v node >/dev/null 2>&1 && [ -f "$helper" ]; then
    node "$helper"
    exit $?
fi

# CLAUDE_CONFIG_DIR overrides ~/.claude, matching where the hooks write the flag (issue #34)
flag="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.ponytail-active"
[ -f "$flag" ] || exit 0

mode=$(head -n1 "$flag" | tr -d '[:space:]')
[ "$mode" = "off" ] && exit 0

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
