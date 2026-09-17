'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('openCallDesktop', Object.freeze({
  isElectron: true,
  getInfo: () => ipcRenderer.invoke('desktop:get-info'),
  listGpus: () => ipcRenderer.invoke('desktop:list-gpus'),
  getGpuProfile: () => ipcRenderer.invoke('desktop:get-gpu-profile'),
  setGpuProfile: (profile) => ipcRenderer.invoke('desktop:set-gpu-profile', profile),
  getGpuDiagnostics: () => ipcRenderer.invoke('desktop:get-gpu-diagnostics'),
  restart: () => ipcRenderer.invoke('desktop:restart'),
  listDisplaySources: () => ipcRenderer.invoke('desktop:list-display-sources'),
  selectDisplaySource: (id) => ipcRenderer.invoke('desktop:select-display-source', id),
  prepareSystemAudio: () => ipcRenderer.invoke('desktop:prepare-system-audio'),
  stopSystemAudio: () => ipcRenderer.invoke('desktop:stop-system-audio'),
  getSystemAudioStatus: () => ipcRenderer.invoke('desktop:get-system-audio-status'),
  prepareRnnoise: (options = {}) => ipcRenderer.invoke('desktop:prepare-rnnoise', options),
  stopRnnoise: () => ipcRenderer.invoke('desktop:stop-rnnoise'),
  getRnnoiseStatus: () => ipcRenderer.invoke('desktop:get-rnnoise-status'),
  getRnnoiseWasmAssets: () => ipcRenderer.invoke('desktop:get-rnnoise-wasm-assets'),
  openExternal: (url) => ipcRenderer.invoke('desktop:open-external', url),
  downloadFile: (url, name) => ipcRenderer.invoke('desktop:download-file', { url, name }),
  onDownloadProgress: callback => {
    const listener=(_event,data)=>callback(data);
    ipcRenderer.on('desktop:download-progress',listener);
    return ()=>ipcRenderer.removeListener('desktop:download-progress',listener);
  },
  logWebrtcStats: (payload = {}) => ipcRenderer.send('desktop:webrtc-stats', payload),
  setViewerFullscreen: (active) => ipcRenderer.invoke('desktop:set-viewer-fullscreen', Boolean(active)),
  getViewerFullscreen: () => ipcRenderer.invoke('desktop:get-viewer-fullscreen'),
  onViewerFullscreenChanged: (callback) => {
    const handler = (_event, active) => { try { callback(Boolean(active)); } catch (_) {} };
    ipcRenderer.on('desktop:viewer-fullscreen-changed', handler);
    return () => ipcRenderer.removeListener('desktop:viewer-fullscreen-changed', handler);
  },
}));
