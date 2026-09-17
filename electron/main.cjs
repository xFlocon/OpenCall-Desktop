'use strict';

const { app, BrowserWindow, ipcMain, session, desktopCapturer, shell, Menu } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawn } = require('child_process');

const APP_VERSION = '0.7.61';
const APP_NAME = 'OpenCall Desktop';
const PROJECT_ROOT = fs.existsSync(path.join(__dirname, 'public')) ? __dirname : path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');

const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
const desktopConfigDir = path.join(xdgConfig, 'opencall-desktop');
const gpuProfilePath = path.join(desktopConfigDir, 'gpu-profile.json');
const xdgCache = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
const rnnoiseRuntimeDir = path.join(xdgCache, 'opencall-desktop', 'native', 'rnnoise-v1.10');
let rnnoiseRuntimePluginPath = '';

// v0.7.43: o OpenCall precisa enxergar todas as GPUs mesmo quando o desktop do
// usuário esconde uma delas globalmente dos jogos. Estes filtros são removidos
// SOMENTE deste processo e dos subprocessos Chromium que ele cria; o ambiente
// global do sistema não é alterado.
const inheritedGpuEnv = {};
function neutralizeInheritedLinuxGpuFilters() {
  if (process.platform !== 'linux') return;
  for (const key of [
    'DRI_PRIME',
    'MESA_VK_DEVICE_SELECT',
    'MESA_VK_DEVICE_SELECT_FORCE_DEFAULT_DEVICE',
    'MESA_DRM_ID',
  ]) {
    if (Object.prototype.hasOwnProperty.call(process.env, key)) {
      inheritedGpuEnv[key] = String(process.env[key] ?? '');
      delete process.env[key];
    }
  }
}
neutralizeInheritedLinuxGpuFilters();

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
}
function readTrim(file) {
  try { return fs.readFileSync(file, 'utf8').trim(); } catch (_) { return ''; }
}
function normalizeHex(v) { return String(v || '').toLowerCase().replace(/^0x/, ''); }

function pciLabel(slot, vendor, device, driver) {
  if (slot) {
    try {
      const line = execFileSync('lspci', ['-s', slot], { encoding: 'utf8', timeout: 1200 }).trim();
      if (line) return line.replace(/^\S+\s+/, '');
    } catch (_) {}
  }
  const known = {
    '1002:67df': 'AMD Polaris10 (RX 470/480/570/580)',
    '1002:6939': 'AMD Tonga PRO (R9 285/380)',
  };
  return known[`${vendor}:${device}`] || `${driver || 'GPU'} ${vendor}:${device}`;
}

function enumerateLinuxGpus() {
  if (process.platform !== 'linux') return [];
  const drm = '/sys/class/drm';
  let nodes = [];
  try { nodes = fs.readdirSync(drm).filter(x => /^renderD\d+$/.test(x)).sort((a,b)=>Number(a.slice(7))-Number(b.slice(7))); }
  catch (_) { return []; }

  return nodes.map((node, index) => {
    const devicePath = path.join(drm, node, 'device');
    const vendor = normalizeHex(readTrim(path.join(devicePath, 'vendor')));
    const device = normalizeHex(readTrim(path.join(devicePath, 'device')));
    const uevent = readTrim(path.join(devicePath, 'uevent'));
    const slot = (uevent.match(/^PCI_SLOT_NAME=(.+)$/m) || [])[1] || '';
    let driver = '';
    try { driver = path.basename(fs.realpathSync(path.join(devicePath, 'driver'))); } catch (_) {}
    const driPrime = slot ? `pci-${slot.replace(/[:.]/g, '_')}` : String(index);
    const vkSelector = vendor && device ? `${vendor}:${device}` : '';
    return {
      id: `${node}:${vendor}:${device}:${slot || index}`,
      index,
      renderNode: `/dev/dri/${node}`,
      node,
      vendor,
      device,
      slot,
      driver,
      driPrime,
      vkSelector,
      label: pciLabel(slot, vendor, device, driver),
    };
  });
}

function defaultGpuProfile() {
  return {
    encoderGpuId: 'auto',
    decoderGpuId: 'auto',
    encoderMode: 'auto',
    zeroCopyMode: 'auto',
    backend: 'auto',
    hardwareAcceleration: true,
  };
}

const startupGpus = enumerateLinuxGpus();
const startupProfile = { ...defaultGpuProfile(), ...readJson(gpuProfilePath, {}) };

// Marca os streams de áudio do próprio OpenCall como comunicação. No Linux isso
// permite mantê-los fora do barramento virtual usado para compartilhar o áudio
// do sistema, evitando que a voz da call volte para a transmissão.
if (process.platform === 'linux') {
  const currentPulseProps = String(process.env.PULSE_PROP || '').trim();
  const openCallProps = `application.name=\"${APP_NAME}\" media.role=communication`;
  process.env.PULSE_PROP = currentPulseProps ? `${currentPulseProps} ${openCallProps}` : openCallProps;
}

const rnnoiseBridge = {active:false,modules:[],sourceName:'',sourceLabel:'OpenCall RNNoise Microphone',inputSource:'',pluginPath:'',mode:'',lastError:''};

const systemAudioBridge = {
  active: false,
  sinkName: '',
  sourceName: '',
  sourceLabel: 'OpenCall System Audio',
  defaultSink: '',
  modules: [],
  loopbackModuleId: null,
  routeTimer: null,
  routeSubscriber: null,
  routeDebounceTimer: null,
  lastError: '',
};

function commandExists(command) {
  try {
    execFileSync('sh', ['-lc', `command -v ${command}`], { stdio: 'ignore', timeout: 1200 });
    return true;
  } catch (_) { return false; }
}

function pactl(args, timeout = 2500) {
  return execFileSync('pactl', args, { encoding: 'utf8', timeout }).trim();
}

function loadPulseModule(name, args = []) {
  const out = pactl(['load-module', name, ...args]);
  const id = Number.parseInt(out, 10);
  if (!Number.isFinite(id)) throw new Error(`pactl não retornou o id de ${name}`);
  systemAudioBridge.modules.push(id);
  return id;
}

function loadRnnoisePulseModule(name, args = []) {
  const out = pactl(['load-module', name, ...args]);
  const id = Number.parseInt(out, 10);
  if (!Number.isFinite(id)) throw new Error(`pactl não retornou o id de ${name}`);
  rnnoiseBridge.modules.push(id); return id;
}
function sleepSync(ms) {
  // Só é usado durante a criação do bridge RNNoise. Evita corrida do
  // pipewire-pulse entre load-module e publicação do sink/source.
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch (_) {}
}
function pulseSinkExists(name) {
  try {
    return pactl(['list','sinks','short']).split(/\r?\n/).some(row => row.trim().split(/\s+/)[1] === name);
  } catch (_) { return false; }
}
function pulseSourceExists(name) {
  try {
    return pactl(['list','sources','short']).split(/\r?\n/).some(row => row.trim().split(/\s+/)[1] === name);
  } catch (_) { return false; }
}
function waitForPulseEntity(kind, name, timeoutMs = 1800) {
  const exists = kind === 'sink' ? pulseSinkExists : pulseSourceExists;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (exists(name)) return true;
    sleepSync(35);
  }
  return exists(name);
}
function stopLinuxRnnoiseBridge() {
  for (const id of [...rnnoiseBridge.modules].reverse()) { try { pactl(['unload-module', String(id)], 1800); } catch (_) {} }
  rnnoiseBridge.active=false;rnnoiseBridge.modules=[];rnnoiseBridge.sourceName='';rnnoiseBridge.inputSource='';rnnoiseBridge.pluginPath='';rnnoiseBridge.mode='';
}
function bundledRnnoisePlugin() {
  const candidates = [
    process.env.OPENCALL_RNNOISE_PLUGIN || '',
    path.join(process.resourcesPath || '', 'native', 'ladspa', 'librnnoise_ladspa.so'),
    path.join(path.dirname(process.execPath || ''), 'resources', 'native', 'ladspa', 'librnnoise_ladspa.so')
  ];
  return candidates.find(p=>p&&fs.existsSync(p))||'';
}
function materializeBundledRnnoisePlugin() {
  if (rnnoiseRuntimePluginPath && fs.existsSync(rnnoiseRuntimePluginPath)) return rnnoiseRuntimePluginPath;
  const source = bundledRnnoisePlugin();
  if (!source) return '';
  const target = path.join(rnnoiseRuntimeDir, 'librnnoise_ladspa.so');
  try {
    fs.mkdirSync(rnnoiseRuntimeDir, { recursive: true, mode: 0o700 });
    let copy = !fs.existsSync(target);
    if (!copy) {
      const a=fs.statSync(source), b=fs.statSync(target);
      copy = a.size !== b.size;
    }
    if (copy) fs.copyFileSync(source, target);
    fs.chmodSync(target, 0o755);
    // O daemon PipeWire é outro processo. Um caminho persistente em ~/.cache
    // é mais confiável do que /tmp/.mount_* do AppImage (FUSE/mount namespace).
    const previous=String(process.env.LADSPA_PATH||'').split(':').filter(Boolean);
    if(!previous.includes(rnnoiseRuntimeDir))process.env.LADSPA_PATH=[rnnoiseRuntimeDir,...previous].join(':');
    rnnoiseRuntimePluginPath=target;
    return target;
  } catch (err) {
    console.warn('RNNoise: não foi possível materializar plugin fora do AppImage:', err);
    return source;
  }
}
function findRnnoisePlugin() {
  const materialized=materializeBundledRnnoisePlugin();
  if(materialized&&fs.existsSync(materialized))return materialized;
  const system = [
    '/usr/lib/ladspa/librnnoise_ladspa.so','/usr/lib64/ladspa/librnnoise_ladspa.so','/usr/local/lib/ladspa/librnnoise_ladspa.so',
    path.join(os.homedir(),'.ladspa/librnnoise_ladspa.so')
  ];
  return system.find(p=>p&&fs.existsSync(p))||'';
}
function pulseSourceBlocks() {
  try {
    const text=pactl(['list','sources']); if(!text)return [];
    return text.split(/\n(?=Source #)/g).map(block=>({
      name:String((block.match(/^\s*Name:\s*(.+)$/m)||[])[1]||'').trim(),
      description:String((block.match(/^\s*Description:\s*(.+)$/m)||[])[1]||'').trim(),block
    })).filter(x=>x.name&&!x.name.endsWith('.monitor')&&!/opencall_/i.test(x.name));
  } catch (_) { return []; }
}
function normAudioName(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function choosePulseInputSource(deviceLabel='') {
  let fallback=''; try{fallback=pactl(['get-default-source'])}catch(_){}
  const list=pulseSourceBlocks(); if(!deviceLabel)return fallback||list[0]?.name||'';
  const want=normAudioName(deviceLabel);let best=null,bestScore=-1;
  for(const src of list){const text=normAudioName(`${src.description} ${src.name} ${src.block}`);let score=0;if(text.includes(want)||want.includes(normAudioName(src.description)))score+=100;for(const t of want.split(/\s+/).filter(x=>x.length>2))if(text.includes(t))score+=1;if(score>bestScore){bestScore=score;best=src}}
  return (bestScore>0?best?.name:'')||fallback||list[0]?.name||'';
}
function startLinuxRnnoiseBridge(deviceLabel='') {
  if(process.platform!=='linux')return {ok:false,supported:false,message:'RNNoise nativo está disponível nesta versão apenas no Linux.'};
  if(!commandExists('pactl'))return {ok:false,supported:false,message:'pactl não encontrado.'};
  const plugin=findRnnoisePlugin(); if(!plugin)return {ok:false,supported:false,reason:'plugin_missing',message:'RNNoise embutido não foi encontrado no AppImage.'};
  stopLinuxRnnoiseBridge();
  const input=choosePulseInputSource(deviceLabel);
  if(!input)return {ok:false,supported:false,reason:'input_missing',message:'Microfone PulseAudio/PipeWire não encontrado.'};
  const suffix=String(process.pid),src=`opencall_rnnoise_source_${suffix}`;

  // PipeWire possui module-ladspa-source nativo. Ele filtra diretamente uma
  // source existente, evitando o antigo grafo null-sink -> LADSPA sink ->
  // loopback -> remap-source, que era mais frágil no pipewire-pulse.
  let directError='';
  try {
    loadRnnoisePulseModule('module-ladspa-source',[
      `source_name=${src}`,`source_master=${input}`,`plugin=${plugin}`,
      'label=noise_suppressor_mono','control=50,200,0,0,0','rate=48000','channels=1',
      'source_properties=device.description=OpenCall_RNNoise_Microphone'
    ]);
    if(!waitForPulseEntity('source',src,2500))throw new Error(`PipeWire não publicou a source RNNoise: ${src}`);
    rnnoiseBridge.active=true;rnnoiseBridge.sourceName=src;rnnoiseBridge.inputSource=input;rnnoiseBridge.pluginPath=plugin;rnnoiseBridge.mode='ladspa-source';
    return {ok:true,supported:true,mode:'rnnoise-ladspa-source',sourceName:src,sourceLabel:rnnoiseBridge.sourceLabel,inputSource:input,pluginPath:plugin};
  } catch (err) {
    directError=String(err?.message||err);
    stopLinuxRnnoiseBridge();
  }

  // Fallback para PulseAudio/implementações onde module-ladspa-source não
  // exista. Continua usando o plugin materializado fora do mount do AppImage.
  try{
    const outSink=`opencall_rnnoise_out_${suffix}`,inSink=`opencall_rnnoise_in_${suffix}`;
    loadRnnoisePulseModule('module-null-sink',[`sink_name=${outSink}`,'rate=48000','channels=1','sink_properties=device.description=OpenCall_RNNoise_Output']);
    if(!waitForPulseEntity('sink',outSink))throw new Error(`PipeWire não publicou o sink RNNoise de saída: ${outSink}`);
    loadRnnoisePulseModule('module-ladspa-sink',[`sink_name=${inSink}`,`sink_master=${outSink}`,`plugin=${plugin}`,'label=noise_suppressor_mono','control=50,200,0,0,0','rate=48000','channels=1','sink_properties=device.description=OpenCall_RNNoise_Processor']);
    if(!waitForPulseEntity('sink',inSink))throw new Error(`PipeWire não publicou o sink RNNoise de entrada: ${inSink}`);
    loadRnnoisePulseModule('module-loopback',[`source=${input}`,`sink=${inSink}`,'channels=1','latency_msec=10','source_dont_move=true','sink_dont_move=true']);
    const monitor=`${outSink}.monitor`;
    if(!waitForPulseEntity('source',monitor))throw new Error(`Monitor RNNoise não apareceu no PipeWire: ${monitor}`);
    loadRnnoisePulseModule('module-remap-source',[`master=${monitor}`,`source_name=${src}`,'channels=1','source_properties=device.description=OpenCall_RNNoise_Microphone']);
    if(!waitForPulseEntity('source',src))throw new Error(`Fonte virtual RNNoise não apareceu no PipeWire: ${src}`);
    rnnoiseBridge.active=true;rnnoiseBridge.sourceName=src;rnnoiseBridge.inputSource=input;rnnoiseBridge.pluginPath=plugin;rnnoiseBridge.mode='legacy-sink-chain';
    return {ok:true,supported:true,mode:'rnnoise-ladspa-fallback',sourceName:src,sourceLabel:rnnoiseBridge.sourceLabel,inputSource:input,pluginPath:plugin};
  }catch(err){
    const fallbackError=String(err?.message||err);
    rnnoiseBridge.lastError=`PipeWire LADSPA source falhou: ${directError} | fallback por sink falhou: ${fallbackError}`;
    stopLinuxRnnoiseBridge();
    return {ok:false,supported:false,reason:'bridge_failed',message:rnnoiseBridge.lastError};
  }
}

function sinkIndexByName(name) {
  try {
    const line = pactl(['list', 'sinks', 'short']).split(/\r?\n/).find(row => row.split(/\s+/)[1] === name);
    return line ? Number.parseInt(line.split(/\s+/)[0], 10) : null;
  } catch (_) { return null; }
}

function sinkInputBlocks() {
  try {
    const text = pactl(['list', 'sink-inputs']);
    if (!text) return [];
    return text.split(/\n(?=Sink Input #)/g).map(block => {
      const id = Number.parseInt((block.match(/^Sink Input #(\d+)/m) || [])[1], 10);
      const sink = Number.parseInt((block.match(/^\s*Sink:\s*(\d+)/m) || [])[1], 10);
      const ownerModule = Number.parseInt((block.match(/^\s*Owner Module:\s*(\d+)/m) || [])[1], 10);
      const driver = String((block.match(/^\s*Driver:\s*(.+)$/m) || [])[1] || '').trim();
      return { id, sink, ownerModule, driver, block, lower: block.toLowerCase() };
    }).filter(item => Number.isFinite(item.id));
  } catch (_) { return []; }
}

function isDescendantProcess(pid) {
  let current = Number(pid);
  const seen = new Set();
  for (let depth = 0; depth < 16 && Number.isFinite(current) && current > 1 && !seen.has(current); depth++) {
    if (current === process.pid) return true;
    seen.add(current);
    try {
      const status = fs.readFileSync(`/proc/${current}/status`, 'utf8');
      const ppid = Number.parseInt((status.match(/^PPid:\s*(\d+)/m) || [])[1], 10);
      if (!Number.isFinite(ppid) || ppid <= 1) break;
      current = ppid;
    } catch (_) { break; }
  }
  return false;
}

function isBridgeLoopbackInput(input) {
  if (!input) return false;
  if (Number.isFinite(systemAudioBridge.loopbackModuleId) && input.ownerModule === systemAudioBridge.loopbackModuleId) return true;
  const lower = String(input.lower || input.block || '').toLowerCase();
  return lower.includes('module-loopback.c') ||
    lower.includes('loopback from') ||
    lower.includes('loopback to') ||
    lower.includes('opencall_system_audio_local_monitor');
}

function isOpenCallPlayback(input) {
  const text = String(input?.block || input || '');
  const lower = text.toLowerCase();
  if (isBridgeLoopbackInput(input)) return true;
  const pulsePid = Number.parseInt((text.match(/application\.process\.id\s*=\s*"?(\d+)/i) || [])[1], 10);
  if (Number.isFinite(pulsePid) && isDescendantProcess(pulsePid)) return true;
  return lower.includes('opencall desktop') ||
    lower.includes('application.name = "opencall') ||
    lower.includes('media.role = "communication"') ||
    lower.includes('media.role = communication') ||
    lower.includes(systemAudioBridge.sinkName.toLowerCase());
}

function ensureSystemAudioLocalMonitor() {
  if (!systemAudioBridge.active || !systemAudioBridge.defaultSink) return false;
  const defaultIndex = sinkIndexByName(systemAudioBridge.defaultSink);
  if (!Number.isFinite(defaultIndex)) return false;
  let found = false;
  for (const input of sinkInputBlocks()) {
    if (!isBridgeLoopbackInput(input)) continue;
    found = true;
    if (input.sink !== defaultIndex) {
      try { pactl(['move-sink-input', String(input.id), systemAudioBridge.defaultSink], 1400); } catch (_) {}
    }
  }
  return found;
}

function routeSystemAudioInputs() {
  if (!systemAudioBridge.active || !systemAudioBridge.sinkName) return;
  const shareIndex = sinkIndexByName(systemAudioBridge.sinkName);
  const defaultIndex = sinkIndexByName(systemAudioBridge.defaultSink);
  if (!Number.isFinite(shareIndex) || !Number.isFinite(defaultIndex)) return;

  ensureSystemAudioLocalMonitor();

  for (const input of sinkInputBlocks()) {
    if (input.sink === shareIndex) continue;
    if (input.sink !== defaultIndex) continue;
    if (isOpenCallPlayback(input)) continue;
    try { pactl(['move-sink-input', String(input.id), systemAudioBridge.sinkName], 1400); } catch (_) {}
  }

  ensureSystemAudioLocalMonitor();
}


function scheduleSystemAudioRoute(delay = 90) {
  if (!systemAudioBridge.active) return;
  if (systemAudioBridge.routeDebounceTimer) clearTimeout(systemAudioBridge.routeDebounceTimer);
  systemAudioBridge.routeDebounceTimer = setTimeout(() => {
    systemAudioBridge.routeDebounceTimer = null;
    try { routeSystemAudioInputs(); } catch (_) {}
  }, delay);
}

function stopPulseRouteSubscriber() {
  if (systemAudioBridge.routeDebounceTimer) clearTimeout(systemAudioBridge.routeDebounceTimer);
  systemAudioBridge.routeDebounceTimer = null;
  if (systemAudioBridge.routeSubscriber) {
    try { systemAudioBridge.routeSubscriber.kill('SIGTERM'); } catch (_) {}
  }
  systemAudioBridge.routeSubscriber = null;
}

function startPulseRouteSubscriber() {
  stopPulseRouteSubscriber();
  if (!systemAudioBridge.active || process.platform !== 'linux') return;
  try {
    const sub = spawn('pactl', ['subscribe'], { stdio: ['ignore', 'pipe', 'ignore'] });
    systemAudioBridge.routeSubscriber = sub;
    sub.stdout.setEncoding('utf8');
    sub.stdout.on('data', chunk => {
      // Re-route only when a playback stream is created/changed. Unlike the old
      // 900 ms polling loop this does no work while the audio graph is stable,
      // avoiding periodic hitches in desktop capture / mouse motion.
      for (const line of String(chunk).split(/\r?\n/)) {
        if (!/Event '(?:new|change)' on sink-input #/i.test(line)) continue;
        scheduleSystemAudioRoute(70);
        break;
      }
    });
    sub.on('error', () => {
      if (systemAudioBridge.routeSubscriber === sub) systemAudioBridge.routeSubscriber = null;
    });
    sub.on('exit', () => {
      if (systemAudioBridge.routeSubscriber === sub) systemAudioBridge.routeSubscriber = null;
    });
  } catch (_) {
    systemAudioBridge.routeSubscriber = null;
  }
}

function restoreSystemAudioInputs() {
  if (!systemAudioBridge.sinkName || !systemAudioBridge.defaultSink) return;
  const shareIndex = sinkIndexByName(systemAudioBridge.sinkName);
  if (!Number.isFinite(shareIndex)) return;
  for (const input of sinkInputBlocks()) {
    if (input.sink !== shareIndex) continue;
    try { pactl(['move-sink-input', String(input.id), systemAudioBridge.defaultSink], 1400); } catch (_) {}
  }
}

function stopLinuxSystemAudioBridge() {
  if (systemAudioBridge.routeTimer) clearInterval(systemAudioBridge.routeTimer);
  systemAudioBridge.routeTimer = null;
  stopPulseRouteSubscriber();
  if (systemAudioBridge.active) restoreSystemAudioInputs();
  for (const id of [...systemAudioBridge.modules].reverse()) {
    try { pactl(['unload-module', String(id)], 1800); } catch (_) {}
  }
  systemAudioBridge.active = false;
  systemAudioBridge.modules = [];
  systemAudioBridge.loopbackModuleId = null;
  systemAudioBridge.sinkName = '';
  systemAudioBridge.sourceName = '';
  systemAudioBridge.defaultSink = '';
}

function startLinuxSystemAudioBridge() {
  if (process.platform !== 'linux') return { ok: false, supported: false, reason: 'linux_only' };
  if (!commandExists('pactl')) {
    return { ok: false, supported: false, reason: 'pactl_missing', message: 'pactl não encontrado. Instale pipewire-pulse/libpulse.' };
  }
  stopLinuxSystemAudioBridge();
  try {
    const suffix = String(process.pid);
    systemAudioBridge.sinkName = `opencall_share_${suffix}`;
    systemAudioBridge.sourceName = `opencall_share_source_${suffix}`;
    systemAudioBridge.defaultSink = pactl(['get-default-sink']);
    if (!systemAudioBridge.defaultSink) throw new Error('Saída de áudio padrão não encontrada');

    loadPulseModule('module-null-sink', [
      `sink_name=${systemAudioBridge.sinkName}`,
      'rate=48000',
      'channels=2',
      'sink_properties=device.description=OpenCall_Shared_Audio',
    ]);
    loadPulseModule('module-remap-source', [
      `master=${systemAudioBridge.sinkName}.monitor`,
      `source_name=${systemAudioBridge.sourceName}`,
      'source_properties=device.description=OpenCall_System_Audio',
    ]);
    systemAudioBridge.loopbackModuleId = loadPulseModule('module-loopback', [
      `source=${systemAudioBridge.sinkName}.monitor`,
      `sink=${systemAudioBridge.defaultSink}`,
      'latency_msec=35',
    ]);

    systemAudioBridge.active = true;
    ensureSystemAudioLocalMonitor();
    routeSystemAudioInputs();
    startPulseRouteSubscriber();
    return {
      ok: true, supported: true, isolated: true,
      sourceName: systemAudioBridge.sourceName,
      sourceLabel: systemAudioBridge.sourceLabel,
      sinkName: systemAudioBridge.sinkName,
      defaultSink: systemAudioBridge.defaultSink,
      message: 'Áudio do sistema isolado da call pelo PipeWire/PulseAudio.',
    };
  } catch (err) {
    systemAudioBridge.lastError = String(err?.message || err);
    stopLinuxSystemAudioBridge();
    return { ok: false, supported: false, reason: 'bridge_failed', message: systemAudioBridge.lastError };
  }
}

function selectedGpu(id) {
  return startupGpus.find(g => g.id === id) || null;
}

function applyStartupGpuProfile() {
  if (startupProfile.hardwareAcceleration === false) {
    app.disableHardwareAcceleration();
    return;
  }

  const nativeWayland = process.platform === 'linux' && (
    String(process.env.XDG_SESSION_TYPE || '').toLowerCase() === 'wayland' ||
    Boolean(String(process.env.WAYLAND_DISPLAY || '').trim())
  );
  const encoderGpu = selectedGpu(startupProfile.encoderGpuId);
  const decoderGpu = selectedGpu(startupProfile.decoderGpuId);

  // v0.7.60: o usuário pode escolher o caminho de transferência de frames.
  // auto = cópia segura no cenário multi-GPU Wayland (comportamento recomendado);
  // safe = desativa zero-copy explicitamente; zero-copy = força o caminho antigo.
  const zeroCopyMode = ['auto','safe','zero-copy'].includes(startupProfile.zeroCopyMode)
    ? startupProfile.zeroCopyMode : 'auto';
  const autoSafeCopy = process.platform === 'linux' && nativeWayland &&
    startupProfile.encoderMode !== 'software' && Boolean(encoderGpu) && startupGpus.length > 1;
  const multiGpuSafeCopy = zeroCopyMode === 'safe' ? true
    : zeroCopyMode === 'zero-copy' ? false
    : autoSafeCopy;

  app.commandLine.appendSwitch('ignore-gpu-blocklist');
  app.commandLine.appendSwitch(multiGpuSafeCopy ? 'disable-zero-copy' : 'enable-zero-copy');
  app.commandLine.appendSwitch('enable-gpu-rasterization');

  const mediaFeatures = [
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
  }

  // Chromium aceita um único render node VA-API. Em software, decoder tem prioridade;
  // em hardware/auto, encoder tem prioridade. Isso não usa DRI_PRIME.
  const preferred = startupProfile.encoderMode === 'software'
    ? (decoderGpu || encoderGpu)
    : (encoderGpu || decoderGpu);
  if (process.platform === 'linux' && preferred?.renderNode) {
    app.commandLine.appendSwitch('hardware-video-device-path', preferred.renderNode);
  }

  if (process.platform === 'linux' && preferred && startupProfile.backend === 'vulkan' && !nativeWayland) {
    if (preferred.vkSelector) process.env.MESA_VK_DEVICE_SELECT = preferred.vkSelector;
  }

  startupProfile.zeroCopyMode = zeroCopyMode;
  startupProfile.multiGpuSafeCopy = multiGpuSafeCopy;
}

applyStartupGpuProfile();
app.setName(APP_NAME);
app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
// OpenCall é um cliente de voz/vídeo: mídia remota deve tocar assim que a conexão WebRTC chega.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let mainWindow = null;
let pendingCaptureSourceId = null;

function safeProfile(profile) {
  const available = new Set(['auto', ...enumerateLinuxGpus().map(g => g.id)]);
  const backend = ['auto', 'vulkan', 'opengl'].includes(profile?.backend) ? profile.backend : 'auto';
  const encoderMode = ['auto', 'hardware', 'software'].includes(profile?.encoderMode) ? profile.encoderMode : 'auto';
  const zeroCopyMode = ['auto', 'safe', 'zero-copy'].includes(profile?.zeroCopyMode) ? profile.zeroCopyMode : 'auto';
  return {
    encoderGpuId: available.has(profile?.encoderGpuId) ? profile.encoderGpuId : 'auto',
    decoderGpuId: available.has(profile?.decoderGpuId) ? profile.decoderGpuId : 'auto',
    encoderMode,
    zeroCopyMode,
    backend,
    hardwareAcceleration: profile?.hardwareAcceleration !== false,
  };
}

async function gpuDiagnostics() {
  let gpuInfo = null;
  let featureStatus = null;
  try { gpuInfo = await app.getGPUInfo('complete'); } catch (_) {}
  try { featureStatus = app.getGPUFeatureStatus(); } catch (_) {}
  const current = { ...defaultGpuProfile(), ...readJson(gpuProfilePath, {}) };
  const gpus = enumerateLinuxGpus();
  const enc = gpus.find(g => g.id === current.encoderGpuId) || null;
  const dec = gpus.find(g => g.id === current.decoderGpuId) || null;
  const splitRequested = Boolean(enc && dec && enc.id !== dec.id);
  const applied = current.encoderMode === 'software' ? (dec || enc || null) : (enc || dec || null);
  return {
    featureStatus,
    gpuInfo,
    profile: current,
    encoderMode: current.encoderMode || 'auto',
    zeroCopyMode: current.zeroCopyMode || 'auto',
    effectiveCopyMode: startupProfile.multiGpuSafeCopy ? 'safe' : 'zero-copy',
    multiGpuSafeCopy: Boolean(startupProfile.multiGpuSafeCopy),
    splitRequested,
    appliedGpu: applied,
    splitRoutingSupported: false,
    note: current.encoderMode === 'software'
      ? 'Encoder de vídeo forçado para software/CPU. Renderização do Chromium e decoder acelerado continuam disponíveis; a GPU de decoder tem prioridade no caminho VA-API.'
      : (splitRequested
        ? 'Chromium 152 aceita um único --hardware-video-device-path para VA-API. A GPU do encoder tem prioridade para encode/decode; separar encoder e decoder em GPUs diferentes ainda não é suportado pelo backend Chromium.'
        : 'VA-API encode/decode é direcionado ao render node escolhido via --hardware-video-device-path, sem DRI_PRIME e sem sair do Wayland.'),
    env: {
      DRI_PRIME: process.env.DRI_PRIME || '',
      MESA_VK_DEVICE_SELECT: process.env.MESA_VK_DEVICE_SELECT || '',
      MESA_DRM_ID: process.env.MESA_DRM_ID || '',
      hardwareVideoDevicePath: applied?.renderNode || '',
      zeroCopyMode: current.zeroCopyMode || 'auto',
      effectiveCopyMode: startupProfile.multiGpuSafeCopy ? 'safe' : 'zero-copy',
      multiGpuSafeCopy: Boolean(startupProfile.multiGpuSafeCopy),
      inheritedGlobalGpuFilters: { ...inheritedGpuEnv },
      globalGpuFiltersNeutralizedForOpenCall: process.platform === 'linux',
    },
  };
}

function preferNativeSystemDisplayPicker() {
  if (process.platform !== 'linux') return false;
  const sessionType = String(process.env.XDG_SESSION_TYPE || '').toLowerCase();
  const waylandDisplay = String(process.env.WAYLAND_DISPLAY || '').trim();
  // Em Wayland, GNOME/KDE normalmente delegam a seleção de tela ao
  // xdg-desktop-portal. Abrir antes o nosso desktopCapturer gera duas
  // confirmações: uma no OpenCall e outra no portal do desktop.
  return sessionType === 'wayland' || Boolean(waylandDisplay);
}

function setupPermissions() {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(['media', 'notifications', 'fullscreen', 'clipboard-read'].includes(permission));
  });
  ses.setPermissionCheckHandler((_wc, permission) => ['media', 'notifications', 'fullscreen', 'clipboard-read'].includes(permission));

  const nativeSystemPicker = preferNativeSystemDisplayPicker();
  ses.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      // Este handler é o fallback para Windows/X11 ou para desktops sem
      // system picker. Em Wayland com portal disponível, useSystemPicker
      // faz o Chromium abrir somente o seletor nativo e este bloco nem roda.
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 480, height: 270 },
        fetchWindowIcons: true,
      });
      const selected = sources.find(s => s.id === pendingCaptureSourceId) || sources.find(s => s.id.startsWith('screen:')) || sources[0];
      pendingCaptureSourceId = null;
      if (!selected) return callback({});
      const result = { video: selected };
      // Electron 44 respeita restrictOwnAudio no pedido do renderer e troca
      // o loopback por loopbackWithoutChrome no Windows, excluindo o áudio
      // reproduzido pelo próprio OpenCall da captura. No Linux usamos a ponte
      // PipeWire/PulseAudio criada via IPC e adicionamos a track no renderer.
      if (request.audioRequested && process.platform === 'win32') result.audio = 'loopback';
      callback(result);
    } catch (err) {
      console.error('displayMedia handler:', err);
      pendingCaptureSourceId = null;
      callback({});
    }
  }, nativeSystemPicker ? { useSystemPicker: true } : {});
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#0d1117',
    title: APP_NAME,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('enter-full-screen', () => { try { mainWindow?.webContents.send('desktop:viewer-fullscreen-changed', true); } catch (_) {} });
  mainWindow.on('leave-full-screen', () => { try { mainWindow?.webContents.send('desktop:viewer-fullscreen-changed', false); } catch (_) {} });
  mainWindow.loadFile(path.join(PUBLIC_DIR, 'index.html'));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file:')) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url).catch(() => {});
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function registerIpc() {
  // v0.7.59: diagnóstico WebRTC do renderer direto no terminal do AppImage.
  ipcMain.on('desktop:webrtc-stats', (_event, payload = {}) => {
    try {
      const side = String(payload.side || 'RTC').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 12) || 'RTC';
      const peer = String(payload.peer || '').replace(/[\r\n\t]/g, ' ').slice(0, 48);
      const line = String(payload.line || '').replace(/[\r\n]+/g, ' ').slice(0, 2000);
      const ts = new Date().toISOString().slice(11, 23);
      process.stdout.write(`[WebRTC ${side}] ${ts}${peer ? ` peer=${peer}` : ''} ${line}\n`);
    } catch (_) {}
  });
  // v0.7.60: fullscreen estável do viewer. A janela Electron entra em fullscreen,
  // enquanto o mesmo elemento <video> permanece no DOM (sem Fullscreen API do Chromium).
  ipcMain.handle('desktop:set-viewer-fullscreen', async (_event, active) => {
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    const desired = Boolean(active);
    mainWindow.setFullScreen(desired);
    return desired;
  });
  ipcMain.handle('desktop:get-viewer-fullscreen', async () => Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isFullScreen()));

  ipcMain.handle('desktop:get-info', async () => ({
    name: APP_NAME,
    version: APP_VERSION,
    electron: process.versions.electron,
    chromium: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    appImage: process.env.APPIMAGE || '',
    sessionType: process.env.XDG_SESSION_TYPE || '',
    desktopEnvironment: process.env.XDG_CURRENT_DESKTOP || process.env.DESKTOP_SESSION || '',
    nativeDisplayPickerPreferred: preferNativeSystemDisplayPicker(),
  }));
  ipcMain.handle('desktop:list-gpus', async () => enumerateLinuxGpus());
  ipcMain.handle('desktop:get-gpu-profile', async () => ({ ...defaultGpuProfile(), ...readJson(gpuProfilePath, {}) }));
  ipcMain.handle('desktop:set-gpu-profile', async (_event, profile) => {
    const clean = safeProfile(profile || {});
    writeJson(gpuProfilePath, clean);
    const enc = enumerateLinuxGpus().find(g => g.id === clean.encoderGpuId) || null;
    const dec = enumerateLinuxGpus().find(g => g.id === clean.decoderGpuId) || null;
    return {
      ok: true,
      profile: clean,
      requiresRestart: true,
      splitRequested: Boolean(enc && dec && enc.id !== dec.id),
      splitRoutingSupported: false,
    };
  });
  ipcMain.handle('desktop:get-gpu-diagnostics', gpuDiagnostics);
  ipcMain.handle('desktop:restart', async () => {
    app.relaunch();
    app.exit(0);
    return true;
  });
  ipcMain.handle('desktop:list-display-sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 360, height: 203 },
      fetchWindowIcons: true,
    });
    return sources.map(s => ({
      id: s.id,
      name: s.name,
      display_id: s.display_id || '',
      thumbnail: s.thumbnail?.isEmpty() ? '' : s.thumbnail.toDataURL(),
      appIcon: s.appIcon?.isEmpty?.() === false ? s.appIcon.toDataURL() : '',
      kind: s.id.startsWith('screen:') ? 'screen' : 'window',
    }));
  });
  ipcMain.handle('desktop:select-display-source', async (_event, id) => {
    pendingCaptureSourceId = String(id || '');
    return Boolean(pendingCaptureSourceId);
  });
  ipcMain.handle('desktop:prepare-system-audio', async () => {
    if (process.platform === 'linux') return startLinuxSystemAudioBridge();
    if (process.platform === 'win32') return { ok: true, supported: true, isolated: true, mode: 'electron-loopback-with-restrict-own-audio' };
    return { ok: false, supported: false, reason: 'platform_not_implemented', message: 'Captura isolada de áudio ainda não está configurada para esta plataforma.' };
  });
  ipcMain.handle('desktop:stop-system-audio', async () => {
    if (process.platform === 'linux') stopLinuxSystemAudioBridge();
    return true;
  });
  ipcMain.handle('desktop:get-system-audio-status', async () => ({
    platform: process.platform,
    active: systemAudioBridge.active,
    supported: process.platform === 'win32' || (process.platform === 'linux' && commandExists('pactl')),
    sourceName: systemAudioBridge.sourceName,
    sourceLabel: systemAudioBridge.sourceLabel,
    sinkName: systemAudioBridge.sinkName,
    defaultSink: systemAudioBridge.defaultSink,
    localMonitorActive: ensureSystemAudioLocalMonitor(),
    loopbackModuleId: systemAudioBridge.loopbackModuleId,
    routingMode: systemAudioBridge.routeSubscriber ? 'event-driven' : 'one-shot',
    lastError: systemAudioBridge.lastError,
  }));
  ipcMain.handle('desktop:prepare-rnnoise', async (_event, options = {}) => startLinuxRnnoiseBridge(String(options.deviceLabel || '')));
  ipcMain.handle('desktop:stop-rnnoise', async () => { stopLinuxRnnoiseBridge(); return { ok: true }; });
  ipcMain.handle('desktop:get-rnnoise-status', async () => ({ active: rnnoiseBridge.active, supported: process.platform === 'linux' && Boolean(findRnnoisePlugin()), pluginPath: rnnoiseBridge.pluginPath || findRnnoisePlugin(), sourceName: rnnoiseBridge.sourceName, mode: rnnoiseBridge.mode, lastError: rnnoiseBridge.lastError }));

  ipcMain.handle('desktop:get-rnnoise-wasm-assets', async () => {
    const dir = path.join(PUBLIC_DIR, 'vendor', 'rnnoise');
    const workletPath = path.join(dir, 'opencall-rnnoise.worklet.js');
    const wasmPath = path.join(dir, 'rnnoise.wasm');
    for (const file of [workletPath, wasmPath]) {
      if (!fs.existsSync(file)) throw new Error(`RNNoise WASM ausente no AppImage: ${file}`);
    }
    return {
      workletSource: fs.readFileSync(workletPath, 'utf8'),
      wasmBase64: fs.readFileSync(wasmPath).toString('base64'),
    };
  });

  ipcMain.handle('desktop:open-external', async (_event, url) => {
    if (/^https?:/i.test(String(url || ''))) await shell.openExternal(String(url));
    return true;
  });
  ipcMain.handle('desktop:download-file', async (event, payload) => {
    const url = String(payload?.url || '');
    if (!/^https?:/i.test(url)) throw new Error('URL de download inválida.');
    // downloadURL inicia o download pelo WebContents sem navegar o renderer.
    // Isso é deliberado: navegação por <a href> pode disparar beforeunload e
    // derrubar a call mesmo quando o Chromium converte a navegação em download.
    event.sender.downloadURL(url);
    return { ok: true, name: String(payload?.name || '') };
  });
}

app.on('before-quit', () => {
  if (process.platform === 'linux') { stopLinuxRnnoiseBridge(); stopLinuxSystemAudioBridge(); }
});

app.whenReady().then(() => {
  process.stdout.write(`[OpenCall ${APP_VERSION}] diagnóstico WebRTC no terminal ativo (intervalo ~1s).\n`);
  process.stdout.write('[OpenCall] TX/RX mostram FPS, bitrate, frames, drops, perdas, NACK/PLI, RTT e repetição quando disponível.\n');
  Menu.setApplicationMenu(null);
  setupPermissions();
  registerIpc();
  let downloadSequence=0;
  session.defaultSession.on('will-download', (_event,item,contents)=>{
    const id=++downloadSequence;
    let lastUpdate=0;
    const report=(status,force=false)=>{
      const now=Date.now();if(!force&&now-lastUpdate<200)return;lastUpdate=now;
      if(contents&&!contents.isDestroyed())contents.send('desktop:download-progress',{
        id,name:item.getFilename(),received:item.getReceivedBytes(),total:item.getTotalBytes(),status
      });
    };
    report('progressing',true);
    item.on('updated',(_event,status)=>report(status));
    item.once('done',(_event,status)=>report(status,true));
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
