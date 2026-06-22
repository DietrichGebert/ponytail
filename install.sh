#!/usr/bin/env bash
# =============================================================================
# ponytail — System-wide installer for all agentic workflows
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/DietrichGebert/ponytail/main/install.sh | sh
#   ./install.sh --all
#   ./install.sh --agent claude
#   ./install.sh --uninstall
#   ./install.sh --list
#
# Options:
#   --all              Install for all agents (default when no --agent given)
#   --agent <name>     Install for a specific agent (repeatable)
#   --repo <path>      Path to local ponytail repo (default: script's parent dir)
#   --uninstall        Remove ponytail config and symlinks
#   --list             Show installation status per agent
#   --yes, -y          Non-interactive
#   --help             Show this help
#
# Supported agents:
#   claude codex copilot opencode cursor windsurf cline
#   kiro openclaw gemini pi antigravity codewhale kilo
# =============================================================================

set -euo pipefail

SCRIPT_NAME=$(basename "$0")
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# --- Defaults ----------------------------------------------------------------
REPO_ROOT="$SCRIPT_DIR"
CONFIG_DIR="${HOME}/.config/ponytail"
AGENTS=()
DO_ALL=false
DO_UNINSTALL=false
DO_LIST=false
INTERACTIVE=true

# --- Colors ------------------------------------------------------------------
if [[ -t 1 ]]; then
  BOLD='\033[1m'
  DIM='\033[2m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  RED='\033[0;31m'
  CYAN='\033[0;36m'
  GRAY='\033[0;90m'
  NC='\033[0m'
else
  BOLD=''; DIM=''; GREEN=''; YELLOW=''; RED=''; CYAN=''; GRAY=''; NC=''
fi

# --- Help --------------------------------------------------------------------
show_help() {
  sed -n '2,/^---/p' "$0" | sed 's/^# //; s/^#$//; s/^#//' | head -n -1
  exit 0
}

# --- Logging -----------------------------------------------------------------
log()  { echo -e "  ${GREEN}✓${NC} $1"; }
info() { echo -e "  ${CYAN}→${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1" >&2; }
error(){ echo -e "  ${RED}✗${NC} $1" >&2; }
header(){ echo -e "\n${BOLD}$1${NC}"; echo "  $(printf '─%.0s' $(seq 1 ${#1}))"; }

# -----------------------------------------------------------------------
#  AGENT DEFINITIONS
#  Each entry: name:label:detect_check:src_subdir:link_target
#    detect_check   - path or command that indicates this agent exists
#    src_subdir     - relative path under REPO_ROOT to symlink
#    link_target    - where to place the symlink (absolute)
# -----------------------------------------------------------------------

# -----------------------------------------------------------------------
#  AGENT DEFINITIONS
#  Each entry: name:label:detect_fn:src_rel:link_target:detect_label
#    detect_fn    = shell function that returns 0 if agent is installed
#    src_rel      = relative path under REPO_ROOT / CONFIG_DIR to symlink
#    link_target  = where to create the symlink (empty = special handling)
#    detect_label = human-readable detection source (shown in --list)
# -----------------------------------------------------------------------

# ---- Detection helpers -------------------------------------------------------
# Each returns 0 (found) or 1 (not found). Used by detect_agent().

detect_claude() {
  command -v claude &>/dev/null && return 0
  [[ -d "${HOME}/.claude" ]] && return 0
  command -v npm &>/dev/null && npm ls -g @anthropic-ai/claude-code &>/dev/null 2>&1 && return 0
  [[ -f "${HOME}/.local/bin/claude" || -f "/usr/local/bin/claude" || -f "/opt/homebrew/bin/claude" ]] && return 0
  return 1
}

detect_codex() {
  command -v codex &>/dev/null && return 0
  [[ -d "${HOME}/.codex" || -d "${HOME}/.config/codex" ]] && return 0
  command -v npm &>/dev/null && npm ls -g @openai/codex &>/dev/null 2>&1 && return 0
  return 1
}

detect_copilot() {
  command -v copilot &>/dev/null && return 0
  [[ -d "${HOME}/.copilot" ]] && return 0
  # GitHub CLI extension
  command -v gh &>/dev/null && gh extension list 2>/dev/null | grep -qi copilot && return 0
  # VS Code extension
  command -v code &>/dev/null && code --list-extensions 2>/dev/null | grep -qi github.copilot && return 0
  return 1
}

detect_opencode() {
  command -v opencode &>/dev/null && return 0
  [[ -f "${HOME}/.config/opencode/opencode.json" ]] && return 0
  command -v npm &>/dev/null && npm ls -g opencode &>/dev/null 2>&1 && return 0
  return 1
}

detect_cursor() {
  command -v cursor &>/dev/null && return 0
  [[ -d "${HOME}/.cursor" ]] && return 0
  # Flatpak / AppImage
  [[ -f "/usr/bin/cursor" || -f "/opt/cursor/cursor" ]] && return 0
  # macOS .app
  [[ -d "/Applications/Cursor.app" ]] && return 0
  return 1
}

detect_windsurf() {
  command -v windsurf &>/dev/null && return 0
  [[ -d "${HOME}/.windsurf" ]] && return 0
  [[ -d "/Applications/Windsurf.app" ]] && return 0
  return 1
}

detect_cline() {
  [[ -d "${HOME}/.clinerules" ]] && return 0
  # VS Code extension
  command -v code &>/dev/null && code --list-extensions 2>/dev/null | grep -qiE "saoudrizwan.claude-dev|cline" && return 0
  # Check common VS Code extension dirs
  for extdir in "${HOME}/.vscode/extensions" "${HOME}/.vscode-server/extensions" "${HOME}/.vscode-remote/extensions"; do
    [[ -d "$extdir" ]] && ls "$extdir" 2>/dev/null | grep -qi "claude-dev\|cline" && return 0
  done
  return 1
}

detect_kiro() {
  command -v kiro &>/dev/null && return 0
  [[ -d "${HOME}/.kiro" ]] && return 0
  command -v npm &>/dev/null && npm ls -g kiro &>/dev/null 2>&1 && return 0
  return 1
}

detect_openclaw() {
  command -v clawhub &>/dev/null && return 0
  # Config dir alone may be a stray; look for a binary or active agent config
  [[ -x "${HOME}/.openclaw/clawhub" ]] && return 0
  return 1
}

detect_gemini() {
  command -v gemini &>/dev/null && return 0
  command -v agy &>/dev/null && return 0
  command -v npm &>/dev/null && npm ls -g @google/gemini-cli &>/dev/null 2>&1 && return 0
  return 1
}

detect_pi() {
  command -v pi &>/dev/null && return 0
  [[ -d "${HOME}/.pi" ]] && return 0
  command -v cargo &>/dev/null && cargo install --list 2>/dev/null | grep -qi "pi-agent" && return 0
  return 1
}

detect_antigravity() {
  command -v agy &>/dev/null && return 0
  [[ -f "/usr/local/bin/agy" || -f "/opt/homebrew/bin/agy" ]] && return 0
  return 1
}

detect_kilo() {
  command -v code &>/dev/null && code --list-extensions 2>/dev/null | grep -qi "kilo" && return 0
  for extdir in "${HOME}/.vscode/extensions" "${HOME}/.vscode-server/extensions"; do
    [[ -d "$extdir" ]] && ls "$extdir" 2>/dev/null | grep -qi "kilo" && return 0
  done
  # Only match if it has Kilo Code's own config, not a stray rtk-rules.md
  [[ -f "${HOME}/.kilocode/rules.json" || -f "${HOME}/.kilocode/config.json" || -d "${HOME}/.kilocode/plugins" ]] && return 0
  return 1
}

detect_codewhale() {
  command -v codewhale &>/dev/null && return 0
  [[ -f "/usr/local/bin/codewhale" || -f "/opt/homebrew/bin/codewhale" ]] && return 0
  command -v npm &>/dev/null && npm ls -g codewhale &>/dev/null 2>&1 && return 0
  return 1
}

# ---- Agent definitions using detect functions --------------------------------
AGENT_DEFS=(
  "claude:Claude Code:detect_claude:.claude-plugin:${HOME}/.claude/plugins/ponytail:binary/config"
  "codex:Codex:detect_codex:.codex-plugin:${HOME}/.codex/plugins/ponytail:binary/config"
  "copilot:GitHub Copilot:detect_copilot:.github/copilot-instructions.md:${HOME}/.copilot/copilot-instructions.md:binary/gh-ext/vscode-ext"
  "opencode:OpenCode:detect_opencode:.opencode/plugins/ponytail.mjs:${HOME}/.config/opencode/plugins/ponytail.mjs:binary/config/npm"
  "cursor:Cursor:detect_cursor:.cursor/rules/ponytail.mdc:${HOME}/.cursor/rules/ponytail.mdc:binary/config/app"
  "windsurf:Windsurf:detect_windsurf:.windsurf/rules/ponytail.md:${HOME}/.windsurf/rules/ponytail.md:binary/config/app"
  "cline:Cline:detect_cline:.clinerules/ponytail.md:${HOME}/.clinerules/ponytail.md:vscode-ext/config"
  "kiro:Kiro:detect_kiro:.kiro/steering/ponytail.md:${HOME}/.kiro/steering/ponytail.md:binary/config/npm"
  "openclaw:OpenClaw:detect_openclaw:.openclaw/skills:${HOME}/.openclaw/skills/ponytail:binary/config"
  "gemini:Gemini CLI:detect_gemini:gemini-extension.json::binary/config"
  "pi:Pi agent:detect_pi:pi-extension:${HOME}/.pi/extensions/ponytail:binary/config/cargo"
  "antigravity:Antigravity:detect_antigravity:.agents/rules/ponytail.md:${HOME}/.agents/rules/ponytail.md:binary"
  "kilo:Kilo Code:detect_kilo:.kiro/steering/ponytail.md:${HOME}/.kilocode/rules/ponytail.md:vscode-ext/config"
  "codewhale:CodeWhale:detect_codewhale:AGENTS.md::binary/npm"
)

# ---- Source the ponytail files (copy or git clone) -------------------------
ensure_source() {
  local SOURCE_DIR="$1"
  if [[ -d "$SOURCE_DIR/.git" ]] && [[ -f "$SOURCE_DIR/AGENTS.md" ]]; then
    REPO_ROOT="$SOURCE_DIR"
    info "Using local ponytail repo: $REPO_ROOT"
    return 0
  fi

  # Not a valid repo — check if CONFIG_DIR has files
  if [[ -f "$CONFIG_DIR/AGENTS.md" ]]; then
    REPO_ROOT="$CONFIG_DIR"
    info "Using existing ponytail install: $CONFIG_DIR"
    return 0
  fi

  # Need to download
  mkdir -p "$CONFIG_DIR"
  if command -v git &>/dev/null; then
    warn "ponytail not found — cloning to $CONFIG_DIR..."
    git clone --depth 1 https://github.com/DietrichGebert/ponytail.git "$CONFIG_DIR" 2>/dev/null || {
      error "Failed to clone ponytail. Check network or specify --repo"
      exit 1
    }
    REPO_ROOT="$CONFIG_DIR"
  elif command -v curl &>/dev/null; then
    warn "ponytail not found — downloading tarball..."
    curl -fsSL "https://github.com/DietrichGebert/ponytail/archive/refs/heads/main.tar.gz" | tar -xz -C "$CONFIG_DIR" --strip-components=1 2>/dev/null || {
      error "Failed to download ponytail. Check network or specify --repo"
      exit 1
    }
    REPO_ROOT="$CONFIG_DIR"
  else
    error "Need git or curl to download ponytail. Install one or specify --repo"
    exit 1
  fi
}

# ---- Update local file tree from REPO_ROOT ---------------------------------
sync_files() {
  mkdir -p "$CONFIG_DIR"
  header "Syncing ponytail files to $CONFIG_DIR"

  # Core files
  for f in AGENTS.md gemini-extension.json package.json; do
    if [[ -f "$REPO_ROOT/$f" ]]; then
      cp "$REPO_ROOT/$f" "$CONFIG_DIR/$f" 2>/dev/null || true
    fi
  done

  # Directories to mirror
  for d in hooks skills commands docs assets; do
    if [[ -d "$REPO_ROOT/$d" ]]; then
      mkdir -p "$CONFIG_DIR/$d"
      cp -r "$REPO_ROOT/$d"/* "$CONFIG_DIR/$d"/ 2>/dev/null || true
    fi
  done

  # Hidden agent dirs
  for d in .cursor .windsurf .clinerules .kiro .openclaw .opencode .github .agents; do
    if [[ -d "$REPO_ROOT/$d" ]]; then
      mkdir -p "$CONFIG_DIR/$d"
      cp -r "$REPO_ROOT/$d"/* "$CONFIG_DIR/$d"/ 2>/dev/null || true
    fi
  done

  log "Files synced"
}

# ---- Install for one agent --------------------------------------------------
install_agent() {
  local name="$1"
  local def
  local label detect_fn src_rel link_target detect_label

  for entry in "${AGENT_DEFS[@]}"; do
    if [[ "${entry%%:*}" == "$name" ]]; then
      def="$entry"
      break
    fi
  done

  if [[ -z "$def" ]]; then
    error "Unknown agent: $name. Supported: claude codex copilot opencode cursor windsurf cline kiro openclaw gemini pi antigravity codewhale kilo"
    return 1
  fi

  # Parse: name:label:detect_fn:src_rel:link_target:detect_label
  local rest="${def#*:}"
  label="${rest%%:*}"
  rest="${rest#*:}"
  detect_fn="${rest%%:*}"
  rest="${rest#*:}"
  src_rel="${rest%%:*}"
  rest="${rest#*:}"
  link_target="${rest%%:*}"
  detect_label="${rest#*:}"

  echo
  info "Installing for $label..."

  # Check if agent is installed using the dedicated detect function
  if ! "$detect_fn" &>/dev/null; then
    if [[ "$INTERACTIVE" == "true" ]]; then
      warn "$label not detected ($detect_label) — skipping"
      return 0
    else
      info "$label not detected — creating config anyway"
    fi
  fi

  local src_path="$CONFIG_DIR/$src_rel"
  local link_path="$link_target"

  # If no explicit link_target specified (e.g. gemini), use plugin install
  if [[ -z "$link_path" ]]; then
    case "$name" in
      gemini)
        if command -v gemini &>/dev/null; then
          info "Installing Gemini extension..."
          gemini extensions install "https://github.com/DietrichGebert/ponytail" 2>/dev/null || warn "Gemini extension install failed — try manually: gemini extensions install https://github.com/DietrichGebert/ponytail"
        fi
        return 0
        ;;
      codewhale)
        info "CodeWhale reads AGENTS.md from project root. Copy AGENTS.md into your project."
        return 0
        ;;
    esac
    return 0
  fi

  # Ensure parent dir exists
  mkdir -p "$(dirname "$link_path")"

  # Remove existing (file, dir, or broken symlink)
  if [[ -L "$link_path" ]] || [[ -e "$link_path" ]]; then
    rm -rf "$link_path"
  fi

  # Create symlink
  ln -sf "$src_path" "$link_path"
  log "Linked $src_rel → $link_path"
}

# ---- Install hooks for Claude Code / Codex ---------------------------------
install_hooks() {
  header "Installing lifecycle hooks"

  # Claude Code
  local claude_settings="${HOME}/.claude/settings.json"
  local codex_settings="${HOME}/.codex/settings.json"

  if [[ -f "$claude_settings" ]]; then
    info "Claude Code: adding hooks to settings.json..."
    local tempfile
    tempfile=$(mktemp)
    # Use python for safe JSON manipulation
    python3 -c "
import json, sys
with open('$claude_settings') as f:
    s = json.load(f)
s.setdefault('hooks', {})
s['hooks']['SessionStart'] = s['hooks'].get('SessionStart', [])
s['hooks']['UserPromptSubmit'] = s['hooks'].get('UserPromptSubmit', [])
# Check if already installed
already = any('ponytail' in str(h) for h in s['hooks']['SessionStart'])
if not already:
    s['hooks']['SessionStart'].append({
        'matcher': 'startup|resume|clear|compact',
        'hooks': [{
            'type': 'command',
            'command': 'command -v node >/dev/null 2>&1 && node \"${CLAUDE_CONFIG_DIR}/../plugins/ponytail/hooks/ponytail-activate.js\" || exit 0',
            'timeout': 5,
            'statusMessage': 'Loading ponytail mode...'
        }]
    })
    s['hooks']['UserPromptSubmit'].append({
        'hooks': [{
            'type': 'command',
            'command': 'command -v node >/dev/null 2>&1 && node \"${CLAUDE_CONFIG_DIR}/../plugins/ponytail/hooks/ponytail-mode-tracker.js\" || exit 0',
            'timeout': 5,
            'statusMessage': 'Tracking ponytail mode...'
        }]
    })
    with open('$claude_settings', 'w') as f:
        json.dump(s, f, indent=2)
    print('hooks added')
else:
    print('hooks already present')
" 2>/dev/null && log "Claude Code hooks installed" || warn "Failed to install Claude Code hooks"
  fi

  # Codex - similar approach
  if [[ -d "${HOME}/.codex/plugins" ]] && [[ -d "$CONFIG_DIR/.codex-plugin" ]]; then
    local codex_plugin_dir="${HOME}/.codex/plugins/ponytail"
    mkdir -p "$(dirname "$codex_plugin_dir")"
    if [[ ! -L "$codex_plugin_dir" ]]; then
      ln -sf "$CONFIG_DIR/.codex-plugin" "$codex_plugin_dir"
      log "Codex plugin symlinked"
    fi
  fi
}

# ---- Remove all symlinks ----------------------------------------------------
uninstall_all() {
  header "Uninstalling ponytail"

  for entry in "${AGENT_DEFS[@]}"; do
    local name="${entry%%:*}"
    local rest="${entry#*:}"
    local label="${rest%%:*}"
    local link_target
    link_target="$(echo "$rest" | cut -d: -f5)"

    if [[ -z "$link_target" ]]; then
      continue
    fi

    if [[ -L "$link_target" ]]; then
      rm -f "$link_target"
      log "Removed symlink: $link_target"
    fi
  done

  # Remove Claude Code hooks
  local claude_settings="${HOME}/.claude/settings.json"
  if [[ -f "$claude_settings" ]]; then
    python3 -c "
import json
with open('$claude_settings') as f:
    s = json.load(f)
changed = False
for hook_key in ['SessionStart', 'UserPromptSubmit']:
    hooks = s.get('hooks', {}).get(hook_key, [])
    s['hooks'][hook_key] = [h for h in hooks if 'ponytail' not in str(h)]
    if len(s['hooks'][hook_key]) != len(hooks):
        changed = True
if changed:
    with open('$claude_settings', 'w') as f:
        json.dump(s, f, indent=2)
    print('hooks removed')
else:
    print('no ponytail hooks found')
" 2>/dev/null && log "Claude Code hooks removed" || true
  fi

  # Ask about CONFIG_DIR
  if [[ -d "$CONFIG_DIR" ]]; then
    echo
    info "Config dir: $CONFIG_DIR"
    warn "Run 'rm -rf $CONFIG_DIR' to remove all ponytail files."
  fi

  log "Uninstall complete"
}

# ---- List installation status -----------------------------------------------
list_status() {
  header "Ponytail installation status"
  echo "  Config dir: ${CONFIG_DIR}"
  echo "  Repo:        ${REPO_ROOT}"
  echo

  for entry in "${AGENT_DEFS[@]}"; do
    local name="${entry%%:*}"
    local rest="${entry#*:}"
    local label="${rest%%:*}"
    rest="${rest#*:}"
    local detect_fn="${rest%%:*}"
    rest="${rest#*:}"
    local src_rel="${rest%%:*}"
    rest="${rest#*:}"
    local link_target="${rest%%:*}"

    local detected="" installed=""
    "$detect_fn" &>/dev/null && detected="${GREEN}yes${NC}" || detected="${DIM}no${NC}"

    if [[ -L "$link_target" ]]; then
      installed="${GREEN}symlink${NC}"
    elif [[ -z "$link_target" ]]; then
      installed="${GRAY}N/A${NC}"
    else
      installed="${DIM}no${NC}"
    fi

    printf "  %-22s detected: %-6s  installed: %s\n" "$label" "$detected" "$installed"
  done
}

# ---- Main -------------------------------------------------------------------
main() {
  # Parse args
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --all|-a) DO_ALL=true ;;
      --agent) shift; AGENTS+=("$1") ;;
      --repo) shift; REPO_ROOT="$1" ;;
      --uninstall) DO_UNINSTALL=true ;;
      --list|--status) DO_LIST=true ;;
      --yes|-y) INTERACTIVE=false ;;
      --help|-h) show_help ;;
      *) error "Unknown option: $1"; show_help ;;
    esac
    shift
  done

  # --list only
  if [[ "$DO_LIST" == "true" ]]; then
    ensure_source "$REPO_ROOT"
    list_status
    exit 0
  fi

  # --uninstall
  if [[ "$DO_UNINSTALL" == "true" ]]; then
    uninstall_all
    exit 0
  fi

  # Ensure we have the source files
  ensure_source "$REPO_ROOT"

  # Sync files
  sync_files

  # Determine which agents to install
  if [[ ${#AGENTS[@]} -gt 0 ]]; then
    :
  elif [[ "$DO_ALL" == "true" ]] || [[ ${#AGENTS[@]} -eq 0 ]]; then
    # Default: install for all agents
    for entry in "${AGENT_DEFS[@]}"; do
      AGENTS+=("${entry%%:*}")
    done
  fi

  # Install for each agent
  for agent in "${AGENTS[@]}"; do
    install_agent "$agent"
  done

  # Install hooks
  install_hooks

  echo
  header "Done"
  echo "  Restart your agents to apply ponytail."
  echo "  Config: $CONFIG_DIR"
  echo
  echo "  ${BOLD}Commands:${NC}"
  echo "  /ponytail [lite|full|ultra|off]  — Set mode"
  echo "  /ponytail-review                  — Review diff for over-engineering"
  echo
  echo "  To see status:  $SCRIPT_NAME --list"
  echo "  To uninstall:   $SCRIPT_NAME --uninstall"
}

main "$@"
