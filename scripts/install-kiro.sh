#!/usr/bin/env bash
set -euo pipefail

# Ponytail — Kiro global install script
# Symlinks the steering file so `git pull` keeps it current.

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
KIRO_STEERING_DIR="$HOME/.kiro/steering"
SOURCE_FILE="$REPO_DIR/.kiro/steering/ponytail.md"
TARGET_FILE="$KIRO_STEERING_DIR/ponytail.md"

if [[ ! -f "$SOURCE_FILE" ]]; then
  echo "Error: $SOURCE_FILE not found. Are you running this from the ponytail repo?" >&2
  exit 1
fi

mkdir -p "$KIRO_STEERING_DIR"

if [[ -L "$TARGET_FILE" ]]; then
  existing=$(readlink "$TARGET_FILE")
  if [[ "$existing" == "$SOURCE_FILE" ]]; then
    echo "Already installed (symlink points to this repo). Nothing to do."
    exit 0
  fi
  echo "Replacing existing symlink ($existing) → $SOURCE_FILE"
  rm "$TARGET_FILE"
elif [[ -f "$TARGET_FILE" ]]; then
  echo "Replacing existing file with symlink → $SOURCE_FILE"
  rm "$TARGET_FILE"
fi

ln -s "$SOURCE_FILE" "$TARGET_FILE"
echo "Installed: $TARGET_FILE → $SOURCE_FILE"
echo ""
echo "To update: git pull in $REPO_DIR"
echo "To uninstall: rm $TARGET_FILE"
