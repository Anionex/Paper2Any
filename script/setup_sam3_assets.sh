#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   bash script/setup_sam3_assets.sh [copy|link]
# Default mode: link

MODE="${1:-link}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

SRC_OFFICIAL_DIR="$ROOT_DIR/models/sam3-official/sam3"

DST_OFFICIAL_DIR="$ROOT_DIR/models/sam3-official/sam3"

mkdir -p "$ROOT_DIR/models/sam3-official"

if [[ "$MODE" != "copy" && "$MODE" != "link" ]]; then
  echo "[ERR] mode must be 'copy' or 'link'"
  exit 1
fi

link_dir() {
  local src="$1"
  local dst="$2"
  if [[ -e "$dst" || -L "$dst" ]]; then
    rm -rf "$dst"
  fi
  ln -s "$src" "$dst"
}

copy_dir() {
  local src="$1"
  local dst="$2"
  rm -rf "$dst"
  mkdir -p "$(dirname "$dst")"
  cp -a "$src" "$dst"
}

if [[ ! -d "$SRC_OFFICIAL_DIR" ]]; then
  echo "[ERR] missing source official dir: $SRC_OFFICIAL_DIR"
  exit 1
fi

if [[ "$MODE" == "link" ]]; then
  link_dir "$SRC_OFFICIAL_DIR" "$DST_OFFICIAL_DIR"
else
  copy_dir "$SRC_OFFICIAL_DIR" "$DST_OFFICIAL_DIR"
fi

echo "[OK] SAM3 assets prepared under:"
echo "      $DST_OFFICIAL_DIR"
