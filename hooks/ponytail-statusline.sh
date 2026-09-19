#!/usr/bin/env bash
# CLAUDE_CONFIG_DIR overrides ~/.claude, matching where the hooks write the flag (issue #34)
dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
flag="$dir/.ponytail-active"

# Claude Code pipes this session's JSON on stdin. The session's own mode wins
# over the legacy flag, which another session may have written (#662). Same id
# rule as sessionIdFrom in ponytail-runtime.js.
if [ ! -t 0 ]; then
    input=$(cat)
    sid=$(printf '%s' "$input" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 \
        | sed 's/.*"\([^"]*\)"$/\1/' | tr -cd 'A-Za-z0-9_-' | cut -c1-128)
    [ -n "$sid" ] && [ -f "$dir/.ponytail-sessions/$sid" ] && flag="$dir/.ponytail-sessions/$sid"
fi
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
