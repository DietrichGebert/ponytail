#!/usr/bin/env bash
flag_opencode="$HOME/.config/opencode/.ponytail-active"
flag_claude="$HOME/.claude/.ponytail-active"

if [ -f "$flag_opencode" ]; then
    flag="$flag_opencode"
elif [ -f "$flag_claude" ]; then
    flag="$flag_claude"
else
    exit 0
fi

mode=$(head -n1 "$flag" | tr -d '[:space:]')

if [ -z "$mode" ] || [ "$mode" = "full" ]; then
    printf '\033[38;5;108m[PONYTAIL]\033[0m'
else
    printf '\033[38;5;108m[PONYTAIL:%s]\033[0m' "$(printf '%s' "$mode" | tr '[:lower:]' '[:upper:]')"
fi
