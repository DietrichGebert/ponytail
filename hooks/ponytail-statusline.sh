#!/usr/bin/env bash
# CLAUDE_CONFIG_DIR overrides ~/.claude, matching where the hooks write the flag (issue #34)
dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
flag="$dir/.ponytail-active"

# Claude Code pipes a JSON payload with session_id on stdin; prefer this
# session's own mode file so two sessions in the same repo don't show each
# other's level (#992). The read is time-boxed (same 1s budget as the hooks'
# own stdin fallback, #443/#790) so running this by hand with no piped input
# can't hang the statusline. A missing/unparsable payload, or no matching
# session file, just falls back to the shared flag, as before.
payload=""
IFS= read -r -t 1 -d '' payload
raw_session_id=$(printf '%s' "$payload" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)
session_id=$(printf '%s' "$raw_session_id" | tr -c 'A-Za-z0-9._-' '_')
if [ -n "$session_id" ] && [ -f "$dir/ponytail-sessions/$session_id" ]; then
    flag="$dir/ponytail-sessions/$session_id"
fi

[ -f "$flag" ] || exit 0

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
