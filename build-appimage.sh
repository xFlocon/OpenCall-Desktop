#!/usr/bin/env bash
set -euo pipefail

APP_NAME="OpenCall-Desktop"
APP_VERSION="$(tr -d '\r\n' < "$(dirname -- "$0")/VERSION")"
ARCH="x86_64"
ELECTRON_VERSION="${ELECTRON_VERSION:-44.3.0}"
RNNOISE_VERSION="${RNNOISE_VERSION:-v1.10}"

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
OUT_DIR="${ROOT}/dist"
CACHE_DIR="${ROOT}/.build-cache"
WORK_BASE="${TMPDIR:-/tmp}/opencall-electron-${UID}"
APPDIR="${WORK_BASE}/${APP_NAME}.AppDir"
ELECTRON_ZIP="${CACHE_DIR}/electron-v${ELECTRON_VERSION}-linux-x64.zip"
ELECTRON_SUMS="${CACHE_DIR}/SHASUMS256-v${ELECTRON_VERSION}.txt"
APPIMAGETOOL="${CACHE_DIR}/appimagetool-x86_64.AppImage"
APPIMAGE_RUNTIME="${CACHE_DIR}/runtime-x86_64"
OUTPUT="${OUT_DIR}/${APP_NAME}-${APP_VERSION}-${ARCH}.AppImage"
RNNOISE_CACHE_DIR="${CACHE_DIR}/rnnoise-${RNNOISE_VERSION}"
RNNOISE_PLUGIN_CACHE="${CACHE_DIR}/librnnoise_ladspa-${RNNOISE_VERSION}.so"
RNNOISE_RELEASE_META="${CACHE_DIR}/rnnoise-release-${RNNOISE_VERSION}.json"

say(){ printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn(){ printf '\033[1;33mAVISO:\033[0m %s\n' "$*" >&2; }
die(){ printf '\033[1;31mERRO:\033[0m %s\n' "$*" >&2; exit 1; }

[[ "$(uname -m)" == "x86_64" ]] || die "Este builder gera AppImage x86_64."
[[ ${EUID} -ne 0 ]] || die "Execute como usuário normal, não root."

install_arch_deps(){
  local pkgs=(curl unzip squashfs-tools file libpulse python)
  local missing=()
  if command -v pacman >/dev/null 2>&1; then
    for p in "${pkgs[@]}"; do pacman -Q "$p" >/dev/null 2>&1 || missing+=("$p"); done
    if ((${#missing[@]})); then
      say "Dependências de build ausentes: ${missing[*]}"
      sudo pacman -S --needed "${missing[@]}"
    fi
  else
    for cmd in curl unzip mksquashfs file; do command -v "$cmd" >/dev/null 2>&1 || die "Comando ausente: $cmd"; done
  fi
}
install_arch_deps
if ! command -v pactl >/dev/null 2>&1; then
  warn "pactl não encontrado no computador de BUILD. Isso não impede empacotar o RNNoise; o host que executar o AppImage precisa de PipeWire/PulseAudio compatível."
fi

install_rnnoise_build_deps_arch(){
  command -v pacman >/dev/null 2>&1 || return 0
  local pkgs=(cmake ninja pkgconf freetype2 libx11 libxrandr libxinerama libxcursor alsa-lib)
  local missing=()
  for pkg in "${pkgs[@]}"; do pacman -Q "$pkg" >/dev/null 2>&1 || missing+=("$pkg"); done
  if ((${#missing[@]})); then
    say "Dependências para compilar RNNoise ausentes: ${missing[*]}"
    sudo pacman -S --needed "${missing[@]}"
  fi
}

fetch_prebuilt_rnnoise(){
  local asset_url="" asset_name="" archive="" extract_dir=""
  say "Obtendo RNNoise ${RNNOISE_VERSION} para embutir no AppImage"
  if ! curl -fsSL --retry 3 --connect-timeout 20 \
      "https://api.github.com/repos/werman/noise-suppression-for-voice/releases/tags/${RNNOISE_VERSION}" \
      -o "$RNNOISE_RELEASE_META"; then
    return 1
  fi
  readarray -t asset_info < <(python3 - "$RNNOISE_RELEASE_META" <<'PYASSET'
import json,sys
p=sys.argv[1]
try:
    data=json.load(open(p,encoding='utf-8'))
except Exception:
    raise SystemExit(1)
best=None
for a in data.get('assets',[]):
    name=str(a.get('name',''))
    low=name.lower()
    url=str(a.get('browser_download_url',''))
    if not url: continue
    if not any(x in low for x in ('linux','ubuntu','gnu')): continue
    if not any(low.endswith(x) for x in ('.zip','.tar.gz','.tgz','.tar.xz')): continue
    score=0
    if 'linux' in low: score+=20
    if any(x in low for x in ('x86_64','x64','amd64')): score+=15
    if 'plugin' in low: score+=3
    if 'ladspa' in low: score+=5
    cand=(score,name,url)
    if best is None or cand>best: best=cand
if best:
    print(best[1]); print(best[2])
PYASSET
  )
  ((${#asset_info[@]} >= 2)) || return 1
  asset_name="${asset_info[0]}"; asset_url="${asset_info[1]}"
  archive="${CACHE_DIR}/${asset_name}"
  [[ -f "$archive" ]] || curl -fL --retry 4 --connect-timeout 20 "$asset_url" -o "$archive"
  extract_dir="${RNNOISE_CACHE_DIR}/prebuilt"
  rm -rf "$extract_dir"; mkdir -p "$extract_dir"
  case "$archive" in
    *.zip) unzip -q "$archive" -d "$extract_dir" ;;
    *.tar.gz|*.tgz|*.tar.xz) tar -xf "$archive" -C "$extract_dir" ;;
    *) return 1 ;;
  esac
  local found
  found="$(find "$extract_dir" -type f -name 'librnnoise_ladspa.so' -print -quit 2>/dev/null || true)"
  [[ -n "$found" ]] || return 1
  cp -f "$found" "$RNNOISE_PLUGIN_CACHE"
  return 0
}

build_rnnoise_from_source(){
  install_rnnoise_build_deps_arch
  for cmd in cmake ninja tar python3; do command -v "$cmd" >/dev/null 2>&1 || die "Não foi possível obter RNNoise pré-compilado e falta o comando de build: $cmd"; done
  local src_archive="${CACHE_DIR}/noise-suppression-for-voice-${RNNOISE_VERSION}.tar.gz"
  local src_root="${RNNOISE_CACHE_DIR}/source"
  local build_root="${RNNOISE_CACHE_DIR}/build"
  say "Compilando apenas o plugin LADSPA RNNoise ${RNNOISE_VERSION}"
  if [[ ! -f "$src_archive" ]]; then
    curl -fL --retry 4 --connect-timeout 20 \
      "https://github.com/werman/noise-suppression-for-voice/archive/refs/tags/${RNNOISE_VERSION}.tar.gz" \
      -o "$src_archive"
  fi
  rm -rf "$src_root" "$build_root"; mkdir -p "$src_root" "$build_root"
  tar -xf "$src_archive" -C "$src_root" --strip-components=1
  cmake -S "$src_root" -B "$build_root" -GNinja \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_LADSPA_PLUGIN=ON \
    -DBUILD_VST_PLUGIN=OFF \
    -DBUILD_VST3_PLUGIN=OFF \
    -DBUILD_LV2_PLUGIN=OFF
  ninja -C "$build_root"
  local found
  found="$(find "$build_root" -type f -name 'librnnoise_ladspa.so' -print -quit 2>/dev/null || true)"
  [[ -n "$found" ]] || die "Build do RNNoise terminou, mas librnnoise_ladspa.so não foi encontrado."
  cp -f "$found" "$RNNOISE_PLUGIN_CACHE"
}

prepare_bundled_rnnoise(){
  if [[ ! -s "$RNNOISE_PLUGIN_CACHE" ]]; then
    fetch_prebuilt_rnnoise || build_rnnoise_from_source
  fi
  file "$RNNOISE_PLUGIN_CACHE" | grep -q 'ELF 64-bit' || die "Plugin RNNoise em cache não é ELF x86_64 válido: $RNNOISE_PLUGIN_CACHE"
  say "RNNoise será incluído dentro do AppImage"
  printf '    Plugin: %s\n' "$RNNOISE_PLUGIN_CACHE"
}

mkdir -p "$CACHE_DIR" "$OUT_DIR"
"$ROOT/scripts/fetch-rnnoise-wasm.sh" "$ROOT/public/vendor/rnnoise"

rm -rf "$WORK_BASE"
mkdir -p "$APPDIR/usr/lib/opencall-electron" \
         "$APPDIR/usr/share/applications" \
         "$APPDIR/usr/share/icons/hicolor/scalable/apps"

say "Baixando Electron ${ELECTRON_VERSION} (cache reutilizável)"
if [[ ! -f "$ELECTRON_ZIP" ]]; then
  curl -fL --retry 4 --connect-timeout 20 \
    "https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}/electron-v${ELECTRON_VERSION}-linux-x64.zip" \
    -o "$ELECTRON_ZIP"
fi
if [[ ! -f "$ELECTRON_SUMS" ]]; then
  curl -fL --retry 4 --connect-timeout 20 \
    "https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}/SHASUMS256.txt" \
    -o "$ELECTRON_SUMS"
fi

say "Verificando SHA-256 oficial do Electron"
ELECTRON_ASSET="electron-v${ELECTRON_VERSION}-linux-x64.zip"

find_expected_checksum() {
  awk -v f="$ELECTRON_ASSET" '
    NF >= 2 {
      name=$NF
      sub(/^\*/, "", name)
      if (name == f) { print $1; exit }
    }
  ' "$ELECTRON_SUMS"
}

expected="$(find_expected_checksum)"

# Se o arquivo de checksums veio incompleto, antigo ou foi salvo de forma
# inesperada no cache, baixa de novo uma vez antes de abortar.
if [[ -z "$expected" ]]; then
  warn "Checksum de ${ELECTRON_ASSET} não apareceu no cache de SHASUMS; baixando novamente."
  rm -f "$ELECTRON_SUMS"
  curl -fL --retry 4 --connect-timeout 20 \
    "https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}/SHASUMS256.txt" \
    -o "$ELECTRON_SUMS"
  expected="$(find_expected_checksum)"
fi

if [[ -z "$expected" ]]; then
  echo >&2
  echo "Linhas do SHASUMS que mencionam linux-x64:" >&2
  grep -F 'linux-x64' "$ELECTRON_SUMS" | head -n 10 >&2 || true
  echo >&2
  die "Checksum de ${ELECTRON_ASSET} não encontrado em ${ELECTRON_SUMS}."
fi

actual="$(sha256sum "$ELECTRON_ZIP" | awk '{print $1}')"
[[ "$expected" == "$actual" ]] || {
  rm -f "$ELECTRON_ZIP"
  die "Checksum do Electron inválido. O ZIP em cache foi removido; execute o build novamente."
}
printf '    SHA-256: %s  [OK]\n' "$actual"

say "Extraindo runtime Electron"
unzip -q "$ELECTRON_ZIP" -d "$APPDIR/usr/lib/opencall-electron"
chmod +x "$APPDIR/usr/lib/opencall-electron/electron" \
         "$APPDIR/usr/lib/opencall-electron/chrome-sandbox" \
         "$APPDIR/usr/lib/opencall-electron/chrome_crashpad_handler" 2>/dev/null || true

say "Copiando OpenCall Desktop para resources/app"
APP_RES="$APPDIR/usr/lib/opencall-electron/resources/app"
rm -rf "$APP_RES"
mkdir -p "$APP_RES/public"
cp "$ROOT/electron/main.cjs" "$APP_RES/main.cjs"
cp "$ROOT/electron/preload.cjs" "$APP_RES/preload.cjs"
cp "$ROOT/electron/package.json" "$APP_RES/package.json"
cp -a "$ROOT/public/." "$APP_RES/public/"
cp "$ROOT/LICENSE" "$APP_RES/LICENSE" 2>/dev/null || true

say "RNNoise WASM + worklet próprio do OpenCall estão dentro de resources/app/public/vendor/rnnoise"

cat > "$APPDIR/AppRun" <<'SH'
#!/bin/sh
set -eu
HERE="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
BIN="$HERE/usr/lib/opencall-electron/electron"
export ELECTRON_FORCE_IS_PACKAGED=1
# Drivers de vídeo/Mesa/VA-API não são empacotados de propósito: precisam ser os
# drivers reais do host para a GPU selecionada funcionar com aceleração.
if [ "${OPENCALL_DISABLE_SANDBOX:-0}" = "1" ]; then
  exec "$BIN" --no-sandbox "$@"
fi
exec "$BIN" "$@"
SH
chmod +x "$APPDIR/AppRun"

cat > "$APPDIR/${APP_NAME}.desktop" <<EOF_DESKTOP
[Desktop Entry]
Type=Application
Name=OpenCall Desktop
Comment=Chat, voz e compartilhamento WebRTC self-hosted
Exec=${APP_NAME}
Icon=opencall-desktop
Categories=Network;Chat;AudioVideo;
Terminal=false
StartupNotify=true
X-AppImage-Version=${APP_VERSION}
EOF_DESKTOP
cp "$APPDIR/${APP_NAME}.desktop" "$APPDIR/usr/share/applications/${APP_NAME}.desktop"

cat > "$APPDIR/opencall-desktop.svg" <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#6574f6"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs>
  <rect x="18" y="18" width="220" height="220" rx="58" fill="#0d1117"/>
  <rect x="44" y="52" width="168" height="128" rx="38" fill="url(#g)"/>
  <path d="M75 113c18-25 40-37 66-37 24 0 43 10 57 29" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round"/>
  <circle cx="93" cy="128" r="14" fill="#fff"/><circle cx="163" cy="128" r="14" fill="#fff"/>
  <path d="M89 177 69 207l48-25" fill="url(#g)"/>
</svg>
SVG
cp "$APPDIR/opencall-desktop.svg" "$APPDIR/usr/share/icons/hicolor/scalable/apps/opencall-desktop.svg"
cp "$APPDIR/opencall-desktop.svg" "$APPDIR/.DirIcon"

say "Baixando appimagetool/runtime (cache reutilizável)"
if [[ ! -f "$APPIMAGETOOL" ]]; then
  curl -fL --retry 4 --connect-timeout 20 \
    "https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage" \
    -o "$APPIMAGETOOL"
fi
if [[ ! -f "$APPIMAGE_RUNTIME" ]]; then
  curl -fL --retry 4 --connect-timeout 20 \
    "https://github.com/AppImage/type2-runtime/releases/download/continuous/runtime-x86_64" \
    -o "$APPIMAGE_RUNTIME"
fi
chmod +x "$APPIMAGETOOL" "$APPIMAGE_RUNTIME"

say "Gerando AppImage"
rm -f "$OUTPUT"
(
  export ARCH=x86_64
  export VERSION="$APP_VERSION"
  export LC_ALL=C.UTF-8
  export LANG=C.UTF-8
  "$APPIMAGETOOL" --appimage-extract-and-run \
    --runtime-file "$APPIMAGE_RUNTIME" \
    "$APPDIR" "$OUTPUT"
)
[[ -f "$OUTPUT" ]] || die "AppImage não foi criado."
chmod +x "$OUTPUT"
sha256sum "$OUTPUT" > "${OUTPUT}.sha256"

say "BUILD CONCLUÍDO"
echo "AppImage: $OUTPUT"
echo "SHA-256: ${OUTPUT}.sha256"
echo
echo "Executar:"
echo "  chmod +x '$OUTPUT'"
echo "  '$OUTPUT'"
echo
echo "Se o sandbox do Chromium estiver bloqueado pelo seu sistema:"
echo "  OPENCALL_DISABLE_SANDBOX=1 '$OUTPUT'"
echo
echo "RNNoise WASM: EMBUTIDO no AppImage; não depende de LADSPA/PipeWire para a supressão de ruído."
echo "IMPORTANTE: Mesa/AMDGPU/VA-API e o servidor de áudio PipeWire/PulseAudio permanecem do host."
echo "Isso é intencional para usar os drivers/dispositivos reais da máquina."
