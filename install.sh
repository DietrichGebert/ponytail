#!/usr/bin/env bash
# ponytail -- installer shim.
#
# Thin wrapper around scripts/install.js, the real installer. Every flag it takes
# can be passed here; this script just forwards them.
#
# One-line install:
#   curl -fsSL https://raw.githubusercontent.com/DietrichGebert/ponytail/main/install.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/DietrichGebert/ponytail/main/install.sh | bash -s -- --dry-run
#
# Local clone:
#   bash install.sh [flags]
#
# install.ps1 is the Windows twin. Both only locate Node and hand off; all the
# install logic lives in scripts/install.js, so the pair has nothing to drift
# out of sync. Pin a release by setting PONYTAIL_REF for the shell that runs
# this script: curl -fsSL <url> | PONYTAIL_REF=<tag> bash

set -euo pipefail

# Everything runs inside main so a truncated `curl | bash` stream cannot execute
# a half-read prefix of this file: the last line is what starts the work.
main() {
  local repo="DietrichGebert/ponytail"
  local ref="${PONYTAIL_REF:-main}"

  # ref lands in a URL path. curl applies RFC 3986 dot-segment removal, so a ref
  # inherited from a profile or CI job could redirect the download elsewhere.
  if [[ ! "$ref" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ || "$ref" == *".."* ]]; then
    echo "ponytail: refusing PONYTAIL_REF='$ref' -- expected a branch or tag name." >&2
    exit 1
  fi

  if ! command -v node >/dev/null 2>&1; then
    echo "ponytail: Node.js (>=18) required. Install:" >&2
    echo "  macOS:  brew install node" >&2
    echo "  Linux:  https://nodejs.org or nvm (https://github.com/nvm-sh/nvm)" >&2
    exit 1
  fi

  # Take the last line and require it to be digits only. Keeping every digit in
  # the output instead would concatenate them, so a wrapper printing its own
  # banner ("wrapper 2.0") ahead of Node 16 would read as 2016 and pass a check
  # meant to reject it. Anything unparseable falls through to the message below.
  local node_major
  node_major="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null | tail -n 1)"
  case "$node_major" in
    '' | *[!0-9]*) node_major='' ;;
  esac
  if [ -z "$node_major" ] || [ "$node_major" -lt 18 ]; then
    echo "ponytail: need Node >=18 (got '${node_major:-unknown}'). Upgrade: https://nodejs.org" >&2
    exit 1
  fi

  # Inside a clone: run the local installer -- no download, works offline.
  # BASH_SOURCE is unset under `curl | bash`; dirname "" resolves to "." and
  # would run an unrelated $PWD/scripts/install.js, so only use it when set.
  # AGENTS.md has to be there too, so a stray scripts/install.js in some other
  # project is not mistaken for a ponytail checkout.
  local here="" source_path="${BASH_SOURCE[0]:-}"
  if [ -n "$source_path" ]; then
    here="$(cd "$(dirname "$source_path")" 2>/dev/null && pwd)" || here=""
  fi
  if [ -n "$here" ] && [ -f "$here/scripts/install.js" ] && [ -f "$here/AGENTS.md" ]; then
    exec node "$here/scripts/install.js" "$@"
  fi

  for tool in curl tar; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      echo "ponytail: $tool required for the download." >&2
      exit 1
    fi
  done

  # Unpack the repo into a temp dir and run the installer from there. The
  # installer reads .agents/rules/ponytail.md and .kiro/steering/ponytail.md at
  # runtime, and a source tarball has the whole repo, so nothing has to be
  # mirrored into package.json to keep this path working.
  local tmp
  tmp="$(mktemp -d)"
  # No exec here: exec would replace this shell and the EXIT trap would never
  # fire, leaking the temp dir. set -e propagates the installer's exit code.
  trap 'rm -rf "$tmp"' EXIT
  curl -fsSL "https://codeload.github.com/$repo/tar.gz/$ref" | tar -xzf - -C "$tmp" --strip-components=1
  # A ref older than the installer downloads fine and then has no entry point;
  # without this the user gets Node's MODULE_NOT_FOUND stack instead.
  if [ ! -f "$tmp/scripts/install.js" ]; then
    echo "ponytail: '$ref' has no scripts/install.js -- that ref predates the installer. Use a newer one." >&2
    exit 1
  fi
  node "$tmp/scripts/install.js" "$@"
}

main "$@"
