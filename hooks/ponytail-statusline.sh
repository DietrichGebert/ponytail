#!/usr/bin/env bash
# CLAUDE_CONFIG_DIR overrides ~/.claude, matching where the hooks write the flag (issue #34)
dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

# Claude Code pipes the session as JSON on stdin. Each session keeps its own level in
# .ponytail-active-<session_id>, so this badge shows this session's level rather than whichever
# session changed the shared flag last. read -t never blocks for more than a second.
input=""
if [ ! -t 0 ]; then
    IFS= read -r -t 1 -d '' input || true
fi
sid=$(printf '%s' "$input" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1 | tr -cd 'A-Za-z0-9_-' | cut -c1-64)

flag=""
if [ -n "$sid" ] && [ -f "$dir/.ponytail-active-$sid" ]; then
    flag="$dir/.ponytail-active-$sid"
elif [ -f "$dir/.ponytail-active" ]; then
    # A host that names no session, or a session started before state was per session.
    flag="$dir/.ponytail-active"
elif [ -z "$sid" ]; then
    # No session name at all: the most recently active session is the best guess.
    flag=$(ls -t "$dir"/.ponytail-active-* 2>/dev/null | head -n1)
fi
[ -n "$flag" ] && [ -f "$flag" ] || exit 0

mode=$(head -n1 "$flag" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')

# Only a known level is ever printed: the flag is a file on disk, and whatever is
# in it would otherwise go straight into the terminal, control characters included.
case "$mode" in
    ""|lite|full|ultra|review) ;;
    *) exit 0 ;;
esac

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
