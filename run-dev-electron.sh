#!/usr/bin/env bash
set -euo pipefail
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
"$ROOT/scripts/fetch-rnnoise-wasm.sh" "$ROOT/public/vendor/rnnoise"
if command -v electron >/dev/null 2>&1; then
  exec electron "$ROOT/electron/main.cjs"
fi
echo "Electron não está instalado no sistema."
echo "No Arch: sudo pacman -S electron"
echo "Ou gere o AppImage autocontido: ./build-appimage.sh"
exit 1
