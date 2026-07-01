#!/bin/sh

script="${1:-}"
case "$script" in
  ponytail-*.js) ;;
  *) exit 0 ;;
esac

root="${CLAUDE_PLUGIN_ROOT:-}"
if [ -z "$root" ]; then
  root="${0%/hooks/*}"
fi

node_bin="${NODE_BIN:-}"
if [ -z "$node_bin" ]; then
  node_bin="$(command -v node 2>/dev/null || true)"
fi

if [ -z "$node_bin" ] && [ -x /usr/bin/node ]; then
  node_bin="/usr/bin/node"
fi

if [ -z "$node_bin" ] && [ -x /opt/homebrew/bin/node ]; then
  node_bin="/opt/homebrew/bin/node"
fi

[ -n "$node_bin" ] && [ -x "$node_bin" ] || exit 0
exec "$node_bin" "$root/hooks/$script"
