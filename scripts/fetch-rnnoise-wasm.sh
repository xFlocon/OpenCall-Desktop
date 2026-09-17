#!/usr/bin/env bash
set -euo pipefail
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
DEST="${1:-$ROOT/public/vendor/rnnoise}"
VERSION="${RNNOISE_WASM_VERSION:-1.1.0}"
BASE="https://cdn.jsdelivr.net/npm/simple-rnnoise-wasm@${VERSION}/dist"
mkdir -p "$DEST"
if [[ ! -s "$DEST/rnnoise.wasm" ]]; then
  echo "==> Baixando RNNoise WASM ${VERSION}: rnnoise.wasm"
  curl -fL --retry 4 --connect-timeout 20 "$BASE/rnnoise.wasm" -o "$DEST/rnnoise.wasm.tmp"
  mv "$DEST/rnnoise.wasm.tmp" "$DEST/rnnoise.wasm"
fi
[[ -s "$DEST/opencall-rnnoise.worklet.js" ]] || { echo "opencall-rnnoise.worklet.js ausente" >&2; exit 1; }
[[ $(wc -c < "$DEST/rnnoise.wasm") -gt 50000 ]] || { echo "rnnoise.wasm inválido" >&2; exit 1; }
python3 - "$DEST/rnnoise.wasm" <<'PYWASM'
from pathlib import Path
import sys
p=Path(sys.argv[1])
if p.read_bytes()[:4] != b'\0asm':
    raise SystemExit('rnnoise.wasm não possui magic WebAssembly')
PYWASM
cat > "$DEST/NOTICE.txt" <<EOF
simple-rnnoise-wasm ${VERSION} (WASM binary only)
https://github.com/JSmith01/simple-rnnoise-wasm
License: MIT
RNNoise itself: Xiph.Org / BSD-style license.
OpenCall worklet integration: included in source tree.
EOF
echo "==> RNNoise WASM pronto em $DEST"
