#!/usr/bin/env bash
set -Eeuo pipefail

# v2: corrige instalação do NSIS no Arch Linux (AUR)
REQUIRED_VERSION="0.7.61"
ELECTRON_VERSION="${ELECTRON_VERSION:-44.3.0}"
TARGET_ARCH="${TARGET_ARCH:-x64}"
AUTO_INSTALL_DEPS="${AUTO_INSTALL_DEPS:-1}"
SELF_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
INPUT="${1:-}"

say(){ printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok(){ printf '\033[1;32mOK:\033[0m %s\n' "$*"; }
warn(){ printf '\033[1;33mAVISO:\033[0m %s\n' "$*" >&2; }
die(){ printf '\033[1;31mERRO:\033[0m %s\n' "$*" >&2; exit 1; }
has(){ command -v "$1" >/dev/null 2>&1; }

install_nsis_arch(){
  has makensis && return 0

  say "NSIS não está nos repositórios oficiais detectados; instalando pelo AUR"

  # Preferência: helper AUR já instalado.
  if has paru; then
    paru -S --needed --noconfirm nsis
  elif has yay; then
    yay -S --needed --noconfirm nsis
  else
    # Sem helper: usa o fluxo oficial de PKGBUILD/makepkg.
    # Nunca executa makepkg como root.
    has git || sudo pacman -S --needed --noconfirm git
    sudo pacman -S --needed --noconfirm base-devel

    local aur_tmp
    aur_tmp="$(mktemp -d "${TMPDIR:-/tmp}/opencall-nsis-aur.XXXXXXXX")"

    (
      set -Eeuo pipefail
      cd "$aur_tmp"
      git clone --depth=1 https://aur.archlinux.org/nsis.git
      cd nsis
      makepkg -si --needed --noconfirm
    )
    local rc=$?
    rm -rf "$aur_tmp"
    ((rc == 0)) || die "Falha ao construir NSIS pelo AUR."
  fi

  has makensis || die "NSIS foi instalado, mas o comando makensis ainda não está disponível."
  ok "NSIS/makensis disponível."
}

install_deps(){
  local miss=()
  for c in curl unzip zip python3 sha256sum node; do
    has "$c" || miss+=("$c")
  done

  if ((${#miss[@]})); then
    [[ "$AUTO_INSTALL_DEPS" == "1" ]] || die "Dependências ausentes: ${miss[*]}"
    say "Instalando dependências: ${miss[*]}"

    if has pacman; then
      # NSIS é tratado separadamente no Arch.
      sudo pacman -S --needed --noconfirm \
        curl unzip zip python nodejs coreutils git base-devel
    elif has apt-get; then
      sudo apt-get update
      sudo apt-get install -y \
        curl unzip zip python3 nodejs nsis coreutils
    elif has dnf; then
      sudo dnf install -y \
        curl unzip zip python3 nodejs nsis coreutils
    else
      die "Instale manualmente: curl unzip zip python3 nodejs coreutils e NSIS/makensis"
    fi
  fi

  # O Arch não fornece nsis no mesmo repositório oficial do restante.
  if ! has makensis; then
    if has pacman; then
      [[ "$AUTO_INSTALL_DEPS" == "1" ]] || die "Falta makensis/NSIS."
      install_nsis_arch
    elif has apt-get; then
      [[ "$AUTO_INSTALL_DEPS" == "1" ]] || die "Falta makensis/NSIS."
      sudo apt-get update
      sudo apt-get install -y nsis
    elif has dnf; then
      [[ "$AUTO_INSTALL_DEPS" == "1" ]] || die "Falta makensis/NSIS."
      sudo dnf install -y nsis
    else
      die "Falta makensis/NSIS."
    fi
  fi

  for c in curl unzip zip python3 sha256sum node makensis; do
    has "$c" || die "Ainda falta a dependência: $c"
  done
}
install_deps

[[ "$(uname -s)" == Linux ]] || die "Execute este builder no Linux."
[[ "$(uname -m)" == x86_64 ]] || die "Host x86_64 obrigatório."

CACHE_DIR="${OPENCALL_BUILD_CACHE:-${XDG_CACHE_HOME:-$HOME/.cache}/opencall-windows-builder}"
mkdir -p "$CACHE_DIR"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/opencall761-win.XXXXXXXX")"
trap 'rc=$?; rm -rf "$WORK_DIR"; exit $rc' EXIT INT TERM HUP

find_root(){
  local b="$1" p r
  if [[ -f "$b/electron/package.json" && -f "$b/electron/main.cjs" && -f "$b/public/app.js" ]]; then printf '%s\n' "$b"; return; fi
  while IFS= read -r -d '' p; do
    r="$(dirname "$(dirname "$p")")"
    [[ -f "$r/electron/main.cjs" && -f "$r/public/app.js" ]] && { printf '%s\n' "$r"; return; }
  done < <(find "$b" -maxdepth 5 -type f -path '*/electron/package.json' -print0 2>/dev/null)
}

SOURCE_ROOT=""
BASE_OUTPUT_DIR="$PWD"
if [[ -n "$INPUT" ]]; then
  INPUT="$(realpath "$INPUT")"
  if [[ -d "$INPUT" ]]; then
    SOURCE_ROOT="$(find_root "$INPUT" | head -n1 || true)"; BASE_OUTPUT_DIR="$INPUT"
  elif [[ -f "$INPUT" && "$INPUT" == *.zip ]]; then
    mkdir -p "$WORK_DIR/source"; unzip -q "$INPUT" -d "$WORK_DIR/source"
    SOURCE_ROOT="$(find_root "$WORK_DIR/source" | head -n1 || true)"; BASE_OUTPUT_DIR="$(dirname "$INPUT")"
  else die "Entrada inválida: $INPUT"; fi
else
  SOURCE_ROOT="$(find_root "$PWD" | head -n1 || true)"
  [[ -n "$SOURCE_ROOT" ]] || SOURCE_ROOT="$(find_root "$SELF_DIR" | head -n1 || true)"
  if [[ -z "$SOURCE_ROOT" ]]; then
    Z="$(find "$PWD" "$SELF_DIR" -maxdepth 1 -type f -name 'OpenCall-Desktop-Electron-v0.7.61*.zip' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n1 | cut -d' ' -f2-)"
    [[ -n "$Z" ]] && { mkdir -p "$WORK_DIR/source"; unzip -q "$Z" -d "$WORK_DIR/source"; SOURCE_ROOT="$(find_root "$WORK_DIR/source" | head -n1 || true)"; BASE_OUTPUT_DIR="$(dirname "$Z")"; }
  fi
fi
[[ -n "$SOURCE_ROOT" ]] || die "Fonte OpenCall v0.7.61 não encontrada."

for f in VERSION LICENSE validate.sh electron/main.cjs electron/preload.cjs electron/package.json public/index.html public/styles.css public/app.js scripts/fetch-rnnoise-wasm.sh; do
  [[ -f "$SOURCE_ROOT/$f" ]] || die "Arquivo obrigatório ausente: $f"
done

APP_VERSION="$(python3 - "$SOURCE_ROOT/electron/package.json" <<'PY'
import json,sys
print(json.load(open(sys.argv[1],encoding='utf-8')).get('version',''))
PY
)"
[[ "$APP_VERSION" == "$REQUIRED_VERSION" ]] || die "Builder exige v$REQUIRED_VERSION; recebeu ${APP_VERSION:-?}."

OUT_DIR="${OUT_DIR:-$BASE_OUTPUT_DIR/dist-windows}"
mkdir -p "$OUT_DIR"; OUT_DIR="$(realpath "$OUT_DIR")"

say "Validando OpenCall v${APP_VERSION} original"
( cd "$SOURCE_ROOT" && bash ./validate.sh ) || die "validate.sh falhou."
grep -Fq "process.platform === 'win32'" "$SOURCE_ROOT/electron/main.cjs" || die "Caminho Windows ausente em main.cjs."
grep -Fq 'restrictOwnAudio:true' "$SOURCE_ROOT/public/app.js" || die "Loopback Windows/restrictOwnAudio ausente."
grep -Fq 'screen_protocol:2' "$SOURCE_ROOT/public/app.js" || die "screen_protocol v2 ausente."
ok "Fonte original validada."

APP_SRC="$WORK_DIR/app"
RUNTIME_DIR="$WORK_DIR/OpenCall Desktop"
mkdir -p "$APP_SRC/public"
cp "$SOURCE_ROOT/electron/main.cjs" "$APP_SRC/main.cjs"
cp "$SOURCE_ROOT/electron/preload.cjs" "$APP_SRC/preload.cjs"
cp "$SOURCE_ROOT/electron/package.json" "$APP_SRC/package.json"
cp -a "$SOURCE_ROOT/public/." "$APP_SRC/public/"
cp "$SOURCE_ROOT/LICENSE" "$APP_SRC/LICENSE"
cp "$SOURCE_ROOT/VERSION" "$APP_SRC/VERSION"

say "Aplicando porte Windows / DXGI"
python3 - "$APP_SRC/main.cjs" "$APP_SRC/public/app.js" "$APP_SRC/public/index.html" <<'PY_PATCH'
from pathlib import Path
import sys
mainp, appp, htmlp = map(Path, sys.argv[1:4])
m=mainp.read_text(encoding='utf-8')
a=appp.read_text(encoding='utf-8')
h=htmlp.read_text(encoding='utf-8')

def rep(text, old, new, label):
    if old not in text:
        raise SystemExit(f'Porte Windows: bloco não encontrado: {label}')
    return text.replace(old,new,1)

m=rep(m,
"""const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
const desktopConfigDir = path.join(xdgConfig, 'opencall-desktop');
const gpuProfilePath = path.join(desktopConfigDir, 'gpu-profile.json');
const xdgCache = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
const rnnoiseRuntimeDir = path.join(xdgCache, 'opencall-desktop', 'native', 'rnnoise-v1.10');""",
"""const platformConfigRoot = process.platform === 'win32'
  ? (process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'))
  : (process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'));
const desktopConfigDir = path.join(platformConfigRoot, 'OpenCall Desktop');
const gpuProfilePath = path.join(desktopConfigDir, 'gpu-profile.json');
const platformCacheRoot = process.platform === 'win32'
  ? (process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'))
  : (process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'));
const rnnoiseRuntimeDir = path.join(platformCacheRoot, 'OpenCall Desktop', 'native', 'rnnoise-v1.10');""",
'config paths')

marker='\nfunction defaultGpuProfile() {'
if marker not in m: raise SystemExit('Porte Windows: defaultGpuProfile ausente')
win=r'''
function windowsGpuPowerPreference(name, vendor, adapterRam) {
  const n = String(name || '').toLowerCase();
  const v = normalizeHex(vendor);
  if (/microsoft basic|remote display|virtual display|parsec|indirect display/.test(n)) return 'software';
  if (v === '8086') return /\barc\b/.test(n) ? 'high-performance' : 'low-power';
  if (v === '10de') return 'high-performance';
  if (v === '1002') {
    if (/integrated|radeon\(tm\) graphics|radeon graphics/.test(n) && Number(adapterRam || 0) < 3 * 1024 ** 3) return 'low-power';
    return 'high-performance';
  }
  return Number(adapterRam || 0) >= 2 * 1024 ** 3 ? 'high-performance' : 'auto';
}

function enumerateWindowsGpus() {
  if (process.platform !== 'win32') return [];
  const ps = [
    '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8',
    '$g=@(Get-CimInstance Win32_VideoController | Select-Object Name,PNPDeviceID,AdapterCompatibility,VideoProcessor,AdapterRAM,DriverVersion,Status)',
    '$g | ConvertTo-Json -Compress'
  ].join(';');
  try {
    const raw = execFileSync('powershell.exe', ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',ps], {encoding:'utf8',timeout:6000,windowsHide:true}).trim();
    let rows = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(rows)) rows = rows ? [rows] : [];
    return rows.filter(Boolean).map((row,index)=>{
      const name=String(row.Name||row.VideoProcessor||`GPU ${index+1}`).trim();
      const pnpDeviceId=String(row.PNPDeviceID||'').trim();
      const ven=(pnpDeviceId.match(/VEN_([0-9A-F]{4})/i)||[])[1]||'';
      const dev=(pnpDeviceId.match(/DEV_([0-9A-F]{4})/i)||[])[1]||'';
      const vendor=normalizeHex(ven), device=normalizeHex(dev), adapterRam=Number(row.AdapterRAM||0);
      const powerPreference=windowsGpuPowerPreference(name,vendor,adapterRam);
      return {id:`win:${pnpDeviceId||`${vendor}:${device}:${index}`}`.toLowerCase(),index,renderNode:'DXGI',node:`DXGI adapter ${index}`,vendor,device,slot:'',driver:String(row.DriverVersion||''),label:name,pnpDeviceId,adapterCompatibility:String(row.AdapterCompatibility||''),adapterRam,powerPreference,backend:'ANGLE/DXGI'};
    });
  } catch (err) {
    console.warn('Windows GPU enumeration failed:',err?.message||err);
    return [];
  }
}

function enumerateDesktopGpus() {
  if (process.platform === 'win32') return enumerateWindowsGpus();
  return enumerateLinuxGpus();
}
'''
m=m.replace(marker,'\n'+win+marker,1)
m=rep(m,'const startupGpus = enumerateLinuxGpus();','const startupGpus = enumerateDesktopGpus();','startup gpus')
m=rep(m,"const available = new Set(['auto', ...enumerateLinuxGpus().map(g => g.id)]);","const available = new Set(['auto', ...enumerateDesktopGpus().map(g => g.id)]);",'safeProfile gpus')
m=rep(m,"const backend = ['auto', 'vulkan', 'opengl'].includes(profile?.backend) ? profile.backend : 'auto';","const backend = ['auto', 'd3d11', 'd3d11on12', 'vulkan', 'opengl'].includes(profile?.backend) ? profile.backend : 'auto';",'backend list')

old="""  const mediaFeatures = [
    'WebRTCPipeWireCapturer',
    'AcceleratedVideoDecoder',
    'VaapiIgnoreDriverChecks',
  ];
  if (!multiGpuSafeCopy) mediaFeatures.push('AcceleratedVideoDecodeLinuxZeroCopyGL');
  if (startupProfile.encoderMode !== 'software') {
    mediaFeatures.push('AcceleratedVideoEncoder');
  } else {
    app.commandLine.appendSwitch('disable-features', 'AcceleratedVideoEncoder');
  }
  app.commandLine.appendSwitch('enable-features', mediaFeatures.join(','));

  // Mantém exatamente a base Wayland estável da 0.7.48/0.7.54: nunca força X11.
  // ANGLE/Vulkan explícito só é usado fora do Wayland; em Wayland, Ozone auto.
  if (startupProfile.backend === 'vulkan' && !nativeWayland) {
    app.commandLine.appendSwitch('use-gl', 'angle');
    app.commandLine.appendSwitch('use-angle', 'vulkan');
  } else if (startupProfile.backend === 'opengl') {
    app.commandLine.appendSwitch('use-gl', 'angle');
    app.commandLine.appendSwitch('use-angle', 'gl');
  }"""
new="""  const mediaFeatures = ['AcceleratedVideoDecoder'];
  if (process.platform === 'linux') {
    mediaFeatures.push('WebRTCPipeWireCapturer', 'VaapiIgnoreDriverChecks');
    if (!multiGpuSafeCopy) mediaFeatures.push('AcceleratedVideoDecodeLinuxZeroCopyGL');
  }
  if (startupProfile.encoderMode !== 'software') mediaFeatures.push('AcceleratedVideoEncoder');
  else app.commandLine.appendSwitch('disable-features', 'AcceleratedVideoEncoder');
  app.commandLine.appendSwitch('enable-features', mediaFeatures.join(','));

  if (startupProfile.backend === 'd3d11' && process.platform === 'win32') {
    app.commandLine.appendSwitch('use-gl','angle'); app.commandLine.appendSwitch('use-angle','d3d11');
  } else if (startupProfile.backend === 'd3d11on12' && process.platform === 'win32') {
    app.commandLine.appendSwitch('use-gl','angle'); app.commandLine.appendSwitch('use-angle','d3d11on12');
  } else if (startupProfile.backend === 'vulkan' && !nativeWayland) {
    app.commandLine.appendSwitch('use-gl','angle'); app.commandLine.appendSwitch('use-angle','vulkan');
  } else if (startupProfile.backend === 'opengl') {
    app.commandLine.appendSwitch('use-gl','angle'); app.commandLine.appendSwitch('use-angle','gl');
  }"""
m=rep(m,old,new,'ANGLE/media features')

m=rep(m,
"""  if (process.platform === 'linux' && preferred?.renderNode) {
    app.commandLine.appendSwitch('hardware-video-device-path', preferred.renderNode);
  }

  if (process.platform === 'linux' && preferred && startupProfile.backend === 'vulkan' && !nativeWayland) {""",
"""  if (process.platform === 'linux' && preferred?.renderNode) {
    app.commandLine.appendSwitch('hardware-video-device-path', preferred.renderNode);
  }

  if (process.platform === 'win32' && preferred) {
    if (preferred.powerPreference === 'high-performance') app.commandLine.appendSwitch('force_high_performance_gpu');
    else if (preferred.powerPreference === 'low-power') app.commandLine.appendSwitch('force_low_power_gpu');
  }

  if (process.platform === 'linux' && preferred && startupProfile.backend === 'vulkan' && !nativeWayland) {""",
'GPU preference')

m=rep(m,"app.setName(APP_NAME);\napp.commandLine.appendSwitch('ozone-platform-hint', 'auto');","app.setName(APP_NAME);\nif (process.platform === 'win32') app.setAppUserModelId('com.opencall.desktop');\napp.commandLine.appendSwitch('ozone-platform-hint', 'auto');",'app id')
m=rep(m,'const gpus = enumerateLinuxGpus();','const gpus = enumerateDesktopGpus();','diag gpus')
m=rep(m,"ipcMain.handle('desktop:list-gpus', async () => enumerateLinuxGpus());","ipcMain.handle('desktop:list-gpus', async () => enumerateDesktopGpus());",'ipc list gpus')
m=rep(m,"""    const enc = enumerateLinuxGpus().find(g => g.id === clean.encoderGpuId) || null;
    const dec = enumerateLinuxGpus().find(g => g.id === clean.decoderGpuId) || null;""","""    const gpus = enumerateDesktopGpus();
    const enc = gpus.find(g => g.id === clean.encoderGpuId) || null;
    const dec = gpus.find(g => g.id === clean.decoderGpuId) || null;""",'ipc set profile')

m=rep(m,"""      globalGpuFiltersNeutralizedForOpenCall: process.platform === 'linux',
    },""","""      globalGpuFiltersNeutralizedForOpenCall: process.platform === 'linux',
      windowsGpuPowerPreference: process.platform === 'win32' ? (applied?.powerPreference || 'auto') : '',
      windowsExactAdapterSelectionSupported: false,
      windowsBackend: process.platform === 'win32' ? (current.backend || 'auto') : '',
    },""",'diag env')

oldline='els.desktopGpuEnv.textContent=`encoder=${profile.encoderMode||"auto"} · transferência=${diag.effectiveCopyMode|| (diag.multiGpuSafeCopy?"safe":"zero-copy")} (pedido=${profile.zeroCopyMode||"auto"}) · DRI_PRIME=${diag.env?.DRI_PRIME||"não usado"} · mídia VA-API=${diag.env?.hardwareVideoDevicePath||"auto"} · MESA_VK_DEVICE_SELECT=${diag.env?.MESA_VK_DEVICE_SELECT||"auto"} · filtros globais=${diag.env?.globalGpuFiltersNeutralizedForOpenCall?"isolados":"padrão"}`;'
newline='if((info?.platform||"")==="win32")els.desktopGpuEnv.textContent=`encoder=${profile.encoderMode||"auto"} · backend=${profile.backend||"auto"} · DXGI=${diag.env?.windowsGpuPowerPreference||"auto"} · adaptador exato=${diag.env?.windowsExactAdapterSelectionSupported?"sim":"não (Chromium escolhe dentro da classe)"}`;else '+oldline
a=rep(a,oldline,newline,'GPU UI env')
a=rep(a,'profile.encoderMode==="hardware"?"hardware/VA-API":"automático"','profile.encoderMode==="hardware"?"hardware/GPU":"automático"','encoder label')

h=rep(h,'Esta página fica ativa no aplicativo Electron/AppImage.','Esta página fica ativa no aplicativo Electron Desktop.','desktop label')
h=rep(h,'<option value="hardware">Hardware / VA-API</option>','<option value="hardware">Hardware / GPU</option>','hardware option')
h=rep(h,'<label>Backend gráfico<select id="gpuBackendSelect"><option value="auto">Automático</option><option value="vulkan">Vulkan / ANGLE</option><option value="opengl">OpenGL / ANGLE</option></select></label>','<label>Backend gráfico<select id="gpuBackendSelect"><option value="auto">Automático</option><option value="d3d11">Direct3D 11 / ANGLE (Windows)</option><option value="d3d11on12">D3D11-on-12 / ANGLE (Windows)</option><option value="vulkan">Vulkan / ANGLE</option><option value="opengl">OpenGL / ANGLE</option></select></label>','backend options')
h=rep(h,'Automático usa cópia segura em multi-GPU Wayland. Zero-copy reduz cópias e latência, mas pode causar flicker/quadros verdes dependendo das GPUs. Requer reinício.','No Linux/Wayland, Automático usa cópia segura em multi-GPU. No Windows esse ajuste é apenas uma preferência do pipeline Chromium. Zero-copy pode reduzir cópias/latência, mas pode causar flicker em alguns drivers. Requer reinício.','zero copy note')

for x in ['function enumerateWindowsGpus()','Get-CimInstance Win32_VideoController','force_high_performance_gpu','force_low_power_gpu',"use-angle','d3d11",'windowsExactAdapterSelectionSupported',"result.audio = 'loopback'"]:
    if x not in m: raise SystemExit('Porte Windows incompleto: '+x)
for x in ['restrictOwnAudio:true','screen_protocol:2','adaptador exato=']:
    if x not in a: raise SystemExit('Porte Windows app incompleto: '+x)
for x in ['Direct3D 11 / ANGLE (Windows)','Hardware / GPU']:
    if x not in h: raise SystemExit('Porte Windows HTML incompleto: '+x)

mainp.write_text(m,encoding='utf-8'); appp.write_text(a,encoding='utf-8'); htmlp.write_text(h,encoding='utf-8')
print('Porte Windows v0.7.61: OK')
PY_PATCH

node --check "$APP_SRC/main.cjs"
node --check "$APP_SRC/preload.cjs"
node --check "$APP_SRC/public/app.js"

say "Validando RNNoise WASM"
RN="$APP_SRC/public/vendor/rnnoise/rnnoise.wasm"
RW="$APP_SRC/public/vendor/rnnoise/opencall-rnnoise.worklet.js"
if [[ ! -s "$RN" || ! -s "$RW" ]]; then chmod +x "$SOURCE_ROOT/scripts/fetch-rnnoise-wasm.sh"; "$SOURCE_ROOT/scripts/fetch-rnnoise-wasm.sh" "$APP_SRC/public/vendor/rnnoise"; fi
python3 - "$RN" "$RW" <<'PY'
from pathlib import Path
import sys
b=Path(sys.argv[1]).read_bytes(); w=Path(sys.argv[2]).read_text(encoding='utf-8')
assert len(b)>50000 and b[:4]==b'\0asm'
assert 'registerProcessor("opencall-rnnoise"' in w
print('RNNoise: OK')
PY

ELECTRON_ASSET="electron-v${ELECTRON_VERSION}-win32-${TARGET_ARCH}.zip"
ELECTRON_ZIP="$CACHE_DIR/$ELECTRON_ASSET"
ELECTRON_SUMS="$CACHE_DIR/SHASUMS256-v${ELECTRON_VERSION}.txt"
say "Obtendo Electron ${ELECTRON_VERSION} Windows ${TARGET_ARCH}"
[[ -s "$ELECTRON_ZIP" ]] || { curl -fL --retry 4 "https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}/${ELECTRON_ASSET}" -o "$ELECTRON_ZIP.tmp"; mv "$ELECTRON_ZIP.tmp" "$ELECTRON_ZIP"; }
if [[ -s "$SOURCE_ROOT/.build-cache/SHASUMS256-v${ELECTRON_VERSION}.txt" ]]; then cp "$SOURCE_ROOT/.build-cache/SHASUMS256-v${ELECTRON_VERSION}.txt" "$ELECTRON_SUMS"; elif [[ ! -s "$ELECTRON_SUMS" ]]; then curl -fL --retry 4 "https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}/SHASUMS256.txt" -o "$ELECTRON_SUMS.tmp"; mv "$ELECTRON_SUMS.tmp" "$ELECTRON_SUMS"; fi
EXPECTED="$(awk -v f="$ELECTRON_ASSET" 'NF>=2{n=$NF;sub(/^\*/,"",n);if(n==f){print $1;exit}}' "$ELECTRON_SUMS")"
ACTUAL="$(sha256sum "$ELECTRON_ZIP"|awk '{print $1}')"
[[ -n "$EXPECTED" && "$EXPECTED" == "$ACTUAL" ]] || { rm -f "$ELECTRON_ZIP"; die "SHA-256 do Electron inválido."; }
ok "Electron verificado."

rm -rf "$RUNTIME_DIR"; mkdir -p "$RUNTIME_DIR"; unzip -q "$ELECTRON_ZIP" -d "$RUNTIME_DIR"
[[ -f "$RUNTIME_DIR/electron.exe" ]] || die "electron.exe ausente."
mv "$RUNTIME_DIR/electron.exe" "$RUNTIME_DIR/OpenCall Desktop.exe"
mkdir -p "$RUNTIME_DIR/resources/app"; cp -a "$APP_SRC/." "$RUNTIME_DIR/resources/app/"

PORTABLE_ZIP="$OUT_DIR/OpenCall-Desktop-v${APP_VERSION}-Windows-${TARGET_ARCH}-Portable.zip"
rm -f "$PORTABLE_ZIP"; say "Gerando Portable.zip"; (cd "$WORK_DIR" && zip -qr "$PORTABLE_ZIP" "OpenCall Desktop")

VER4="$(python3 - "$APP_VERSION" <<'PY'
import re,sys
n=re.findall(r'\d+',sys.argv[1])[:4]; n+=['0']*(4-len(n)); print('.'.join(n))
PY
)"
SETUP="$OUT_DIR/OpenCall-Desktop-v${APP_VERSION}-Windows-${TARGET_ARCH}-Setup.exe"
PORTABLE="$OUT_DIR/OpenCall-Desktop-v${APP_VERSION}-Windows-${TARGET_ARCH}-Portable.exe"

cat > "$WORK_DIR/setup.nsi" <<EOF
Unicode true
Name "OpenCall Desktop"
OutFile "$SETUP"
InstallDir "\$LOCALAPPDATA\\Programs\\OpenCall Desktop"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetOverwrite on
VIProductVersion "$VER4"
VIAddVersionKey /LANG=1046 "ProductName" "OpenCall Desktop"
VIAddVersionKey /LANG=1046 "ProductVersion" "$APP_VERSION"
VIAddVersionKey /LANG=1046 "FileDescription" "OpenCall Desktop Windows"
VIAddVersionKey /LANG=1046 "FileVersion" "$APP_VERSION"
Page directory
Page instfiles
UninstPage instfiles
Section
  SetShellVarContext current
  SetOutPath "\$INSTDIR"
  File /r "$RUNTIME_DIR/*"
  WriteUninstaller "\$INSTDIR\\Uninstall OpenCall Desktop.exe"
  CreateDirectory "\$SMPROGRAMS\\OpenCall Desktop"
  CreateShortcut "\$SMPROGRAMS\\OpenCall Desktop\\OpenCall Desktop.lnk" "\$INSTDIR\\OpenCall Desktop.exe"
  CreateShortcut "\$DESKTOP\\OpenCall Desktop.lnk" "\$INSTDIR\\OpenCall Desktop.exe"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\OpenCall Desktop" "DisplayName" "OpenCall Desktop"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\OpenCall Desktop" "DisplayVersion" "$APP_VERSION"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\OpenCall Desktop" "UninstallString" '"\$INSTDIR\\Uninstall OpenCall Desktop.exe"'
SectionEnd
Section "Uninstall"
  SetShellVarContext current
  Delete "\$DESKTOP\\OpenCall Desktop.lnk"
  Delete "\$SMPROGRAMS\\OpenCall Desktop\\OpenCall Desktop.lnk"
  RMDir "\$SMPROGRAMS\\OpenCall Desktop"
  DeleteRegKey HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\OpenCall Desktop"
  RMDir /r "\$INSTDIR"
SectionEnd
EOF

cat > "$WORK_DIR/portable.nsi" <<EOF
Unicode true
Name "OpenCall Desktop Portable"
OutFile "$PORTABLE"
RequestExecutionLevel user
SilentInstall silent
AutoCloseWindow true
SetCompressor /SOLID lzma
VIProductVersion "$VER4"
VIAddVersionKey /LANG=1046 "ProductName" "OpenCall Desktop Portable"
VIAddVersionKey /LANG=1046 "ProductVersion" "$APP_VERSION"
VIAddVersionKey /LANG=1046 "FileDescription" "OpenCall Desktop Portable"
VIAddVersionKey /LANG=1046 "FileVersion" "$APP_VERSION"
Section
  SetShellVarContext current
  StrCpy \$INSTDIR "\$LOCALAPPDATA\\OpenCall Desktop\\Portable\\$APP_VERSION"
  RMDir /r "\$INSTDIR"
  SetOutPath "\$INSTDIR"
  File /r "$RUNTIME_DIR/*"
  ExecWait '"\$INSTDIR\\OpenCall Desktop.exe"' \$0
  SetErrorLevel \$0
SectionEnd
EOF

say "Gerando Setup.exe"; makensis -V2 "$WORK_DIR/setup.nsi"
say "Gerando Portable.exe"; makensis -V2 "$WORK_DIR/portable.nsi"
for f in "$SETUP" "$PORTABLE"; do [[ -s "$f" ]] || die "Não criado: $f"; python3 - "$f" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); assert p.read_bytes()[:2]==b'MZ'; print(f'PE OK: {p.name} ({p.stat().st_size/1024/1024:.1f} MiB)')
PY
done

SHA="$OUT_DIR/OpenCall-Desktop-v${APP_VERSION}-Windows-${TARGET_ARCH}.sha256"
(cd "$OUT_DIR" && sha256sum "$(basename "$SETUP")" "$(basename "$PORTABLE")" "$(basename "$PORTABLE_ZIP")" > "$(basename "$SHA")")

ok "Build Windows v${APP_VERSION} concluída."
printf '\nArquivos:\n  %s\n  %s\n  %s\n  %s\n' "$SETUP" "$PORTABLE" "$PORTABLE_ZIP" "$SHA"
printf '\nRecursos Windows: desktopCapturer, loopback de áudio com restrictOwnAudio, RNNoise WASM, chamadas em segundo plano, Win32_VideoController e ANGLE/DXGI.\n'
printf 'Observação: o Electron/Chromium não expõe seleção exata entre duas GPUs discretas da mesma classe; o OpenCall aplica preferência high-performance/low-power.\n'
