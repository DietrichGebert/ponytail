#!/usr/bin/env bash
# ponytail — one-time setup for Devin CLI hooks
#
# Devin CLI does not run plugin install scripts and ignores hooks bundled in
# .devin-plugin/plugin.json, so we register ponytail hooks in the user config
# file ~/.config/devin/config.json under the "hooks" key. This needs to happen
# once per machine (or again after the companion script changes).

set -euo pipefail

find_plugin_dir() {
  local cache_base="${HOME}/.local/share/devin/cli/plugins"
  local cache_dir="${cache_base}/cache"

  if [[ -n "${PONYTAIL_PLUGIN_DIR:-}" ]]; then
    echo "$PONYTAIL_PLUGIN_DIR"
    return
  fi

  # Find the newest ponytail checkout in Devin CLI's plugin cache.
  # Layout: ~/.local/share/devin/cli/plugins/cache/<identity-hash>/<version>/
  local latest=""
  if [[ -d "$cache_dir" ]]; then
    for identity in "$cache_dir"/*; do
      [[ -d "$identity" ]] || continue
      for d in "$identity"/*; do
        [[ -d "$d" ]] || continue
        [[ -f "$d/.devin-plugin/plugin.json" ]] || continue
        if grep -q '"name"[[:space:]]*:[[:space:]]*"ponytail"' "$d/.devin-plugin/plugin.json" 2>/dev/null; then
          if [[ -z "$latest" || "$d" -nt "$latest" ]]; then
            latest="$d"
          fi
        fi
      done
    done
  fi

  # Also allow local development installs linked under the plugins root.
  if [[ -z "$latest" && -d "$cache_base" ]]; then
    for d in "$cache_base"/*; do
      [[ -d "$d" ]] || continue
      [[ "$d" == "$cache_dir" ]] && continue
      [[ -f "$d/.devin-plugin/plugin.json" ]] || continue
      if grep -q '"name"[[:space:]]*:[[:space:]]*"ponytail"' "$d/.devin-plugin/plugin.json" 2>/dev/null; then
        latest="$d"
      fi
    done
  fi

  if [[ -z "$latest" ]]; then
    echo "error: could not find the ponytail plugin in Devin CLI's plugin cache." >&2
    echo "Install it with: devin plugins install DietrichGebert/ponytail" >&2
    exit 1
  fi

  echo "$latest"
}

merge_hooks() {
  local target="$1"
  local script_path="$2"

  if [[ ! -f "$target" ]]; then
    mkdir -p "$(dirname "$target")"
    cat > "$target" <<EOF
{
  "version": 1,
  "hooks": {}
}
EOF
  fi

  # Merge the ponytail hooks into the existing "hooks" object. If the file
  # lacks a "hooks" key, add one. Avoid duplicates when re-running the script.
  # Use $HOME in the command so the same config works across machines.
  local home_script='"$HOME/.config/devin/hooks/ponytail/ponytail-devin.js"'
  node -e "
    const fs = require('fs');
    const config = JSON.parse(fs.readFileSync('$target', 'utf8'));
    if (!config || typeof config !== 'object') throw new Error('invalid config');
    if (!config.hooks || typeof config.hooks !== 'object') config.hooks = {};

    const ponytailEvents = {
      SessionStart: [{ hooks: [{ type: 'command', command: 'node ${home_script} SessionStart' }] }],
      UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'node ${home_script} UserPromptSubmit' }] }],
      PostCompaction: [{ hooks: [{ type: 'command', command: 'node ${home_script} PostCompaction' }] }],
    };

    for (const [event, hooks] of Object.entries(ponytailEvents)) {
      const existing = config.hooks[event] || [];
      const filtered = existing.filter(h => {
        const commands = (h.hooks || []).map(x => x.command || '').join(' ');
        return !commands.includes('ponytail-devin.js');
      });
      config.hooks[event] = [...filtered, ...hooks];
    }

    fs.writeFileSync('$target', JSON.stringify(config, null, 2) + '\n');
  "
}

main() {
  local plugin_dir
  plugin_dir="$(find_plugin_dir)"
  local hook_script_src="${plugin_dir}/hooks/ponytail-devin.js"

  if [[ ! -f "$hook_script_src" ]]; then
    echo "error: missing ${hook_script_src}" >&2
    exit 1
  fi

  local target_dir="${HOME}/.config/devin/hooks/ponytail"
  local target_script="${target_dir}/ponytail-devin.js"
  local target_config="${HOME}/.config/devin/config.json"

  mkdir -p "$target_dir"
  cp "$hook_script_src" "$target_script"
  chmod +x "$target_script"

  merge_hooks "$target_config" "$target_script"

  echo "Installed ponytail Devin CLI hooks:"
  echo "  script: ${target_script}"
  echo "  config: ${target_config}"
  echo ""
  echo "Open a new devin session or run 'devin -p hi' to activate ponytail."
}

main "$@"
