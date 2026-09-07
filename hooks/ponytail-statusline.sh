#!/usr/bin/env bash
# CLAUDE_CONFIG_DIR overrides ~/.claude, matching where the hooks write the flag (issue #34)
dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
flag="$dir/.ponytail-active"
[ -f "$flag" ] || exit 0
# hideStatus: activate drops this marker when the badge is silenced (#659)
[ -f "$dir/.ponytail-hidden" ] && exit 0

mode=$(head -n1 "$flag" | tr -d '[:space:]')

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
