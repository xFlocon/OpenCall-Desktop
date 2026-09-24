#!/usr/bin/env bash
set -euo pipefail
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
BUILDER="$ROOT/server/build-opencall-local-server-appimage-0.7.1-guild-leave-delete.sh"

echo "==> Validando OpenCall Desktop Electron 0.7.61"
command -v python3 >/dev/null || { echo "python3 ausente" >&2; exit 1; }
python3 -m py_compile "$ROOT/scripts/serve.py"
python3 "$ROOT/scripts/check-membership.py"
python3 "$ROOT/scripts/check-hierarchy.py"
python3 "$ROOT/scripts/check-dm-streams.py"
python3 "$ROOT/scripts/check-presence.py"
bash -n "$ROOT/run-opencall.sh" "$ROOT/run-dev-electron.sh" "$ROOT/build-appimage.sh" "$ROOT/scripts/fetch-rnnoise-wasm.sh" "$BUILDER"
if command -v node >/dev/null 2>&1; then
  node --check "$ROOT/public/app.js"
  node "$ROOT/scripts/check-transfer.cjs"
  node --check "$ROOT/electron/main.cjs"
  node --check "$ROOT/electron/preload.cjs"
else
  echo "AVISO: node ausente; pulando checagem JS."
fi
python3 - "$ROOT" "$BUILDER" <<'PY'
import re,sys,json
from pathlib import Path
root=Path(sys.argv[1]); builder=Path(sys.argv[2])
html=(root/'public/index.html').read_text(encoding='utf-8')
js=(root/'public/app.js').read_text(encoding='utf-8')
ids=set(re.findall(r'id="([^"]+)"',html))
start=js.index('Object.fromEntries(['); end=js.index('].map(id =>',start)
refs=set(re.findall(r'"([A-Za-z][A-Za-z0-9]+)"',js[start:end]))
missing=sorted(refs-ids)
if missing: raise SystemExit('IDs ausentes: '+', '.join(missing))
for needed in ('streamSetupDialog','streamSetupResolution','streamSetupFps','streamSetupBitrate','noiseSuppressionMode','desktopSourceDialog','shareSystemAudioToggle','shareAudioIsolationStatus','encoderGpuSelect','decoderGpuSelect','desktopGpuEncodeStatus','desktopGpuDecodeStatus'):
    if needed not in ids: raise SystemExit('UI Electron ausente: '+needed)
print(f'HTML/JS IDs: OK ({len(refs)})')

main=(root/'electron/main.cjs').read_text(encoding='utf-8')
for term in ('neutralizeInheritedLinuxGpuFilters','MESA_VK_DEVICE_SELECT','MESA_DRM_ID','getGPUFeatureStatus','getGPUInfo','setDisplayMediaRequestHandler','desktop:list-gpus','module-null-sink','module-remap-source','module-loopback','desktop:prepare-system-audio','desktop:stop-system-audio'):
    if term not in main: raise SystemExit('Integração Electron ausente: '+term)
print('Electron IPC/GPU: OK')
assert "delete process.env[key]" in main, 'filtros globais de GPU não são neutralizados no OpenCall'
assert "app.commandLine.appendSwitch('use-gl', 'angle')" in main, 'ANGLE explícito ausente'
assert "process.env.MESA_VK_DEVICE_SELECT = preferred.vkSelector" in main, 'preferência Vulkan sem DRI_PRIME ausente'
assert "`${preferred.vkSelector}!`" not in main, 'MESA_VK_DEVICE_SELECT ainda oculta as demais GPUs com !'
assert "process.env.DRI_PRIME = preferred.driPrime" not in main, 'DRI_PRIME ainda é aplicado à GPU preferida'
print('v0.7.43 Linux GPU isolation/visibility: OK')

pkg=json.loads((root/'electron/package.json').read_text(encoding='utf-8'))
assert pkg['main']=='main.cjs' and pkg['version'] in ('0.7.58','0.7.59','0.7.60','0.7.61')
print('Electron package.json: OK')

shell=builder.read_text(encoding='utf-8')
marker='cat > "${APPDIR}/usr/share/private-screen-share-server/server_main.py" <<\'PY\'\n'
s=shell.index(marker)+len(marker); e=shell.index('\nPY\n\n# ------------------------------------------------------------\n# Gerenciador do servidor',s)
code=shell[s:e]
compile(code,'embedded-server_main.py','exec')
mm='cat > "${APPDIR}/usr/share/private-screen-share-server/manager.py" <<\'PY\'\n'
ms=shell.index(mm)+len(mm); me=shell.index('\nPY\n',ms)
compile(shell[ms:me],'embedded-manager.py','exec')
required=('auth_register','auth_login','guild_create','category_delete','channel_create','role_create','chat_send','chat_edit','chat_delete','chat_react','chat_pin','dm_create','voice_join','voice_signal','voice_speaking','create_session','resumable_upload','MAX_FILE_BYTES','admin_stats','invite_create','mod_ban')
for x in required:
    if x not in code: raise SystemExit(f'Protocolo ausente: {x}')
assert 'rtc_config_payload' in code and '"rtc_config"' in code, 'RTC/TURN automático ausente'
assert 'WebSocket is not connected' in code and 'disconnect message has been received' in code, 'fix de desconexão WebSocket ausente'
assert 'inline_media = mime.startswith' in code and 'content_disposition_type=disposition' in code, 'mídia inline do servidor ausente'
print('Servidor 0.7.1 embutido + social/attachment-edit/read-only/category delete/RTC/TURN/WebSocket/inline media: OK')
PY
echo "==> Validação concluída"

# v0.7.39: regressions + internal image/video viewers.
python3 - <<'PY'
from pathlib import Path
s=Path('public/app.js').read_text()
start=s.index('function leaveVoice(){')
end=s.index('function cleanupVoice', start)
body=s[start:end]
assert 'stopScreenShare(true)' in body, 'leaveVoice must stop screen share'
assert body.index('stopScreenShare(true)') < body.index('type:"voice_leave"'), 'screen share must stop before voice_leave'
voice_left=s.index('case "voice_left":')
voice_left_end=s.index('break;', voice_left)
assert 'stopScreenShare(true)' in s[voice_left:voice_left_end], 'server voice_left must stop screen share'
assert 'autoplay-policy' in Path('electron/main.cjs').read_text(), 'autoplay policy ausente'
assert 'automaticTurnConfig' in s and 'shouldInitiateVoice' in s and 'unlockRemoteMedia' in s, 'correções WebRTC ausentes'
assert 'stun:stun.l.google.com:19302' in s, 'Google STUN padrão ausente'
assert 'rec.audio.srcObject=rec.audioStream' in s, 'playback direto de voz ausente'
assert 'SCREEN_RESOLUTIONS' in s and '2160p' in s and 'bitrateMbps' in s, 'perfil avançado de transmissão ausente'
assert 'hostQualityApply' in s and 'screenFpsInput' in s and 'dmEmojiPicker' in s, 'novos controles UI ausentes'
assert 'populateEmojiPicker(els.dmEmojiPicker,els.dmInput)' in s, 'picker de emoji do DM não está ligado ao input privado'
assert 'Math.round(clampNumber(profile.fps,1,120' in s, 'FPS customizado 1-120 ausente'
assert 'openImageViewer' in s and 'imageViewerDialog' in s, 'viewer interno de imagens ausente'
assert 'openVideoViewer' in s and 'videoViewerDialog' in s and 'isVideoAttachment' in s, 'viewer interno de vídeos ausente'
assert 'closeScreenViewer(true)' in body, 'leaveVoice deve sair também da transmissão remota'
assert 'window.open(mediaUrl(a.media_id)' not in s, 'imagem ainda abre no navegador externo'
print('==> v0.7.39 voz/transmissão/RTC/viewers: OK')
PY

# v0.7.39: duas pessoas podem ser host e viewer uma da outra sem misturar SDP/ICE.
python3 - <<'PY_DUAL_STREAM'
from pathlib import Path
s=Path('public/app.js').read_text()
assert 'screen_protocol:2' in s, 'protocolo de tela v2 ausente'
assert 'stream_host_id:rec.streamHostId' in s, 'stream_host_id não acompanha sinais de tela'
assert 'session_code:rec.sessionCode' in s, 'session_code não acompanha sinais de tela'
assert 'function screenPeerForIncomingSignal' in s, 'roteador de sinais bidirecionais ausente'
router=s[s.index('function screenPeerForIncomingSignal'):s.index('async function handleScreenSignal')]
assert 'streamHostId===state.clientId' in router and 'state.screenPeers.get(from)' in router, 'sinal da stream local não é roteado ao host peer'
assert 'streamHostId===from&&state.viewingHostId===from' in router and 'ensureScreenViewerPeer(from)' in router, 'sinal da stream remota não é roteado ao viewer peer'
assert 'sendScreenPeerSignal(rec,{kind:"description"' in s, 'SDP não usa envelope identificado'
assert 'pc.onicecandidate=e=>{if(e.candidate)sendScreenPeerSignal' in s, 'ICE não usa envelope identificado'
print('==> v0.7.39 dual-host/dual-viewer signaling: OK')
PY_DUAL_STREAM

# v0.7.31: downloads de anexos não podem navegar o renderer / derrubar voice call
grep -q "downloadFile: (url, name)" electron/preload.cjs
grep -q "desktop:download-file" electron/main.cjs
grep -q "event.sender.downloadURL(url)" electron/main.cjs
grep -q "function downloadAttachment" public/app.js
! grep -q 'link.href=mediaUrl(a.media_id,true)' public/app.js

# v0.7.31: volume boost >100% deve manter fallback direto até o boost tocar
python3 - <<'PY2'
from pathlib import Path
s=Path('public/app.js').read_text()
assert 'boostAudio:null' in s, 'canal separado de boost ausente'
assert 'rec.boostAudio=boostAudio' in s, 'boostAudio não é preservado'
assert 'rec.audio.muted=true' in s and 'rec.boostAudio.muted=deaf' in s, 'troca segura para boost ausente'
assert 'mantendo áudio direto em 100%' in s, 'fallback de 100% ausente'
assert 'if(ctx.state!=="running")throw' in s, 'AudioContext suspenso ainda pode ser aceito como boost válido'
assert 'await applyAudioOutput(r.boostAudio)' in s, 'troca de saída não atualiza boost'
print('==> volume 101-200% com fallback: OK')
PY2

# v0.7.31: qualidade antes do picker, estado mute e supressão de ruído
python3 - <<'PY31'
from pathlib import Path
s=Path('public/app.js').read_text()
h=Path('public/index.html').read_text()
m=Path('electron/main.cjs').read_text()
assert 'configureScreenShare()' in s and 'await configureScreenShare()' in s, 'pré-configuração de transmissão ausente'
assert s.index('await configureScreenShare()') < s.index('requestDesktopDisplayMedia', s.index('async function startScreenShare')), 'picker abre antes da qualidade'
assert 'voiceStateIcons' in s and 'voice-state-flags' in s and 'member-voice-state' in s, 'ícones de mute/deafen ausentes'
assert 'noiseSuppressionMode' in s and 'openVoiceMicrophoneStream' in s, 'supressão de ruído configurável ausente'
assert 'createRnnoiseStream' in s and 'new AudioWorkletNode(ctx,"opencall-rnnoise"' in s and 'rnnoise.wasm' in m, 'RNNoise WASM/AudioWorklet ausente'
assert 'stopManagedVoiceStream' in s, 'cleanup de stream RNNoise ausente'
assert 'streamSetupDialog' in h and 'RNNoise' in h, 'UI v0.7.31 ausente'
print('==> v0.7.31 stream setup / mute / RNNoise: OK')
PY31



# v0.7.39: sair da call deve fechar viewer remoto e vídeos devem tocar no app.
python3 - <<'PY37'
from pathlib import Path
a=Path('public/app.js').read_text()
h=Path('public/index.html').read_text()
srv=Path('server/build-opencall-local-server-appimage-0.7.1-guild-leave-delete.sh').read_text()
leave=a[a.index('function leaveVoice(){'):a.index('function cleanupVoice',a.index('function leaveVoice(){'))]
assert 'closeScreenViewer(true)' in leave, 'sair da call não fecha transmissão remota'
assert 'isVideoAttachment' in a and 'openVideoViewer' in a and 'videoViewerVideo' in a
assert 'videoViewerDialog' in h and 'controls playsinline preload="metadata"' in h
assert 'inline_media = mime.startswith(("image/","video/","audio/"))' in srv
assert 'mimetypes.guess_type' in srv
print('==> v0.7.39 leave-call + video viewer + inline media: OK')
PY37

# v0.7.39: RNNoise deve rodar dentro do renderer via WASM/AudioWorklet sem Blob/file://.
python3 - <<'PY38'
from pathlib import Path
b=Path('build-appimage.sh').read_text()
a=Path('public/app.js').read_text()
h=Path('public/index.html').read_text()
m=Path('electron/main.cjs').read_text()
p=Path('electron/preload.cjs').read_text()
f=Path('scripts/fetch-rnnoise-wasm.sh').read_text()
w=Path('public/vendor/rnnoise/opencall-rnnoise.worklet.js').read_text()
assert 'createRnnoiseStream' in a and 'new AudioWorkletNode(ctx,"opencall-rnnoise"' in a
assert 'javascriptDataUrl' in a and 'data:text/javascript;base64' in a
assert 'Blob([runtime.__opencallBundledAssets.workletSource]' not in a
assert 'RNNoiseNode.register' not in a
assert 'processorOptions:{wasmBytes:wasmBuffer}' in a
assert 'RNNoise · embutido no OpenCall (WASM)' in h
assert 'fetch-rnnoise-wasm.sh' in b
assert 'simple-rnnoise-wasm@${VERSION}' in f
assert 'getRnnoiseWasmAssets' in a and 'getRnnoiseWasmAssets' in p
assert "desktop:get-rnnoise-wasm-assets" in m and "desktop:get-rnnoise-wasm-assets" in p
section=m[m.index("desktop:get-rnnoise-wasm-assets"):m.index("desktop:open-external")]
assert 'workletSource' in section and 'wasmBase64' in section and 'moduleSource' not in section
assert 'new WebAssembly.Module(bytes)' in w and 'new WebAssembly.Instance(module)' in w
assert 'registerProcessor("opencall-rnnoise"' in w
assert 'type: "ready"' in w and 'type: "error"' in w
assert 'fetch rnnoise.mjs' not in f and 'fetch rnnoise.worklet.js' not in f
print('==> v0.7.39 RNNoise data-URL/raw-WASM worklet: OK')
PY38

# v0.7.42: exclusão segura de categoria + canais somente leitura
python3 - <<'PY40'
from pathlib import Path
a=Path('public/app.js').read_text()
h=Path('public/index.html').read_text()
srv=Path('server/build-opencall-local-server-appimage-0.7.1-guild-leave-delete.sh').read_text()
assert 'adminCategoryList' in h and 'adminCategoryList' in a, 'lista administrativa de categorias ausente'
assert 'type:"category_delete"' in a, 'cliente não envia category_delete'
assert 'serverSupportsCategoryDelete()' in a, 'cliente não verifica compatibilidade do servidor'
assert 'case "category_deleted"' in a, 'cliente não trata confirmação category_deleted'
assert 'Canais, mensagens e arquivos NÃO serão apagados' in a, 'confirmação segura ausente'
assert 'if t=="category_delete"' in srv, 'servidor sem category_delete'
assert 'UPDATE channels SET category_id=NULL' in srv, 'servidor não move canais explicitamente'
assert '"type":"category_deleted"' in srv, 'servidor não confirma category_deleted'
assert '"category_delete":True' in srv, 'feature flag category_delete ausente'
assert 'DELETE FROM categories WHERE id=? AND guild_id=?' in srv, 'DELETE de categoria ausente'
assert 'ON DELETE SET NULL' in srv, 'schema não preserva canais ao excluir categoria'
assert 'channels_moved_to_outros' in srv, 'auditoria de categoria ausente'
assert 'read_only INTEGER DEFAULT 0' in srv, 'schema read_only ausente'
assert 'ALTER TABLE channels ADD COLUMN read_only' in srv, 'migração read_only ausente'
assert 'def can_write_channel' in srv and 'read_only_channel' in srv, 'enforcement read_only ausente'
assert '"read_only_channels":True' in srv, 'feature flag read_only ausente'
assert 'read_only=?' in srv, 'channel_update não persiste read_only'
assert 'renderPinnedResults' in a and 'pinsDialog' in h, 'viewer de fixadas ausente'
assert 'editMessageDialog' in h and 'submitEditMessage' in a, 'editor interno de mensagens ausente'
assert 'serverSupportsReadOnlyChannels' in a and 'somente leitura' in a, 'UI read-only ausente'
print('==> v0.7.42 pins/edit/read-only/category delete: OK')
PY40

# v0.7.44: edição de anexos da mensagem
python3 - <<'PY'
from pathlib import Path
app=Path('public/app.js').read_text(encoding='utf-8')
html=Path('public/index.html').read_text(encoding='utf-8')
srv=Path('server/build-opencall-local-server-appimage-0.7.1-guild-leave-delete.sh').read_text(encoding='utf-8')
assert 'editMessageAttachments' in html and 'editMessageFilePicker' in html and 'editMessageAttachButton' in html, 'UI de anexos do editor ausente'
assert 'function renderEditMessageAttachments' in app and 'function queueEditFiles' in app, 'lógica de edição de anexos ausente'
assert 'state.editAttachmentsDirty' in app and 'payload.attachments=attachments' in app, 'cliente não controla alteração real dos anexos'
assert 'message_attachment_edit' in app, 'cliente não detecta feature de edição de anexos'
assert 'VERSION="0.7.1"' in srv and 'SERVER_VERSION = "0.7.1"' in srv, 'servidor 0.7.0 ausente'
assert '"message_attachment_edit":True' in srv, 'feature flag message_attachment_edit ausente'
assert 'replace_attachments="attachments" in m' in srv, 'chat_edit não diferencia edição de texto/anexos'
assert 'DELETE FROM message_attachments WHERE message_id=?' in srv, 'servidor não substitui anexos'
assert 'allowed_media_ids' in srv and 'owner_user_id' in srv, 'validação de propriedade dos anexos ausente'
print('==> v0.7.44 attachment edit: OK')
PY


# v0.7.45: servidor público padrão + identidade social/amigos/DM global
python3 - <<'PY45'
from pathlib import Path
import json
app=Path('public/app.js').read_text(encoding='utf-8')
html=Path('public/index.html').read_text(encoding='utf-8')
srv=Path('server/build-opencall-local-server-appimage-0.7.1-guild-leave-delete.sh').read_text(encoding='utf-8')
pkg=json.loads(Path('electron/package.json').read_text(encoding='utf-8'))
assert pkg['version'] in ('0.7.46','0.7.47','0.7.48','0.7.49','0.7.58','0.7.59','0.7.60','0.7.61')
assert 'DEFAULT_SIGNALING_URL = "wss://sultech.tailc76287.ts.net:8443/ws"' in app
assert 'friendsButton' in html and 'friendsDialog' in html and 'friendSearchInput' in html
assert 'publicUserId' in app and 'friend_request' in app and 'friend_accept' in app and 'friends_list' in app
assert 'user_tag TEXT' in srv and 'idx_users_display_tag' in srv and 'friend_requests' in srv and 'friendships' in srv
assert 'if t=="friend_search"' in srv and 'if t=="friend_request"' in srv and 'if t=="friend_accept"' in srv
assert '"public_user_tags":True' in srv and '"friends":True' in srv and '"global_dms":True' in srv
assert '"home_server_auto_join": False' in srv and '"registration_mode": "open"' in srv
print('==> v0.7.45 identidade Nome#0000 / amigos / DMs globais / servidor padrão: OK')
PY45


# v0.7.46: tutorial de conexão + primeiro cadastro
python3 - <<'PY46'
from pathlib import Path
import json
app=Path('public/app.js').read_text(encoding='utf-8')
html=Path('public/index.html').read_text(encoding='utf-8')
css=Path('public/styles.css').read_text(encoding='utf-8')
pkg=json.loads(Path('electron/package.json').read_text(encoding='utf-8'))
assert pkg['version'] in ('0.7.46','0.7.47','0.7.48','0.7.49','0.7.58','0.7.59','0.7.60','0.7.61')
assert 'data-tab="tutorial"' in html and 'data-page="tutorial"' in html, 'aba Tutorial ausente'
assert 'tutorialCurrentConnection' in html and 'tutorialOpenConnectionButton' in html and 'tutorialUsePublicButton' in html, 'controles do tutorial ausentes'
assert 'Servidor de conexão' in html and 'Comunidades / servidores internos' in html, 'distinção host/comunidade ausente'
assert 'wss://sultech.tailc76287.ts.net:8443/ws' in html, 'servidor público não aparece no tutorial'
assert 'ws://192.168.1.50:8765/ws' in html, 'exemplo de servidor privado local ausente'
assert 'TUTORIAL_SEEN_PREFIX' in app and 'maybeOpenTutorialAfterRegistration' in app, 'first-run tutorial ausente'
assert 'state.authMode!=="register"' in app and 'openSettings("tutorial")' in app, 'tutorial não abre após cadastro'
assert ('openConnectionManager()' in app or 'selectSettingsTab("connection")' in app) and 'DEFAULT_SIGNALING_URL' in app, 'atalhos para conexão ausentes'
assert '.tutorial-step' in css and '.tutorial-flow' in css, 'estilos do tutorial ausentes'
print('==> v0.7.46 tutorial de conexão / primeiro cadastro: OK')
PY46


# v0.7.47: vários servidores físicos/hosts salvos + sessão isolada por host
python3 - <<'PY47'
from pathlib import Path
a=Path('public/app.js').read_text(encoding='utf-8')
h=Path('public/index.html').read_text(encoding='utf-8')
assert 'CONNECTION_PROFILES_KEY' in a and 'opencall-v0747-connection-profiles' in a
assert 'CONNECTION_AUTH_PREFIX' in a and 'connectionAuthKey' in a and 'authTokenForUrl' in a
assert 'saveAuthTokenForUrl(settings.signalingUrl,m.auth_token)' in a, 'token ainda não é salvo por host'
assert 'function switchConnectionProfile' in a and 'function renderConnectionProfiles' in a
assert 'normalizeSignalingUrl' in a and 'ensureConnectionProfile' in a
assert 'connectionProfileList' in h and 'connectionAddForm' in h
assert 'data-tab="servers"' in h and 'Servidores de conexão' in h
assert 'authChangeConnectionButton' in h and 'authConnectionUrl' in h
assert 'localStorage.setItem(AUTH_KEY,m.auth_token)' not in a, 'token global antigo ainda é gravado'
print('==> v0.7.47 multi-host + auth por conexão: OK')
PY47


# v0.7.48: chamadas privadas de DM + câmera + compartilhamento de tela
python3 - <<'PY48'
from pathlib import Path
import json
root=Path('.')
a=(root/'public/app.js').read_text(encoding='utf-8')
h=(root/'public/index.html').read_text(encoding='utf-8')
srv=(root/'server/build-opencall-local-server-appimage-0.7.1-guild-leave-delete.sh').read_text(encoding='utf-8')
pkg=json.loads((root/'electron/package.json').read_text(encoding='utf-8'))
assert pkg['version'] in ('0.7.48','0.7.49','0.7.58','0.7.59','0.7.60','0.7.61')
for x in ('dmVoiceCallButton','dmVideoCallButton','dmScreenCallButton','dmIncomingCallDialog'):
    assert x in h and x in a, f'UI DM call ausente: {x}'
for x in ('startDmCall','onDmCallInvite','onDmCallJoined','dm_call_signal','dm_call_state','dm_call_speaking'):
    assert x in a, f'cliente DM call ausente: {x}'
assert 'state.dmCallThreadId?"dm_call_signal":"voice_signal"' in a, 'signaling de voz não separa DM/canal'
assert 'state.dmCallThreadId?"dm_call_state":"voice_state"' in a, 'estado de voz não separa DM/canal'
assert 'dm_screen_start' in a and 'dm_screen_signal' in a and 'dm_screen_join_approved' in a, 'screen share DM cliente ausente'
for x in ('dm_call_rooms','dm_call_start','dm_call_join','dm_call_leave','dm_call_signal','dm_screen_sessions','dm_screen_start','dm_screen_join','dm_screen_signal','dm_screen_stop'):
    assert x in srv, f'protocolo servidor DM call ausente: {x}'
assert '"dm_calls":True' in srv and '"dm_screen_share":True' in srv
print('==> v0.7.48 DM voice/video/screen: OK')
PY48


# v0.7.49: menu de contexto de comunidade + hosts dentro das Configurações
python3 - <<'PY49'
from pathlib import Path
import json
root=Path('.')
a=(root/'public/app.js').read_text(encoding='utf-8')
h=(root/'public/index.html').read_text(encoding='utf-8')
c=(root/'public/styles.css').read_text(encoding='utf-8')
srv=(root/'server/build-opencall-local-server-appimage-0.7.1-guild-leave-delete.sh').read_text(encoding='utf-8')
pkg=json.loads((root/'electron/package.json').read_text(encoding='utf-8'))
assert pkg['version'] in ('0.7.58','0.7.59','0.7.60','0.7.61')
assert 'id="connectionManagerButton"' not in h, 'botão de hosts ainda ocupa a barra lateral'
assert 'id="connectionManagerDialog"' not in h, 'gerenciador de hosts ainda é modal separado'
assert 'data-tab="servers"' in h and 'data-page="servers"' in h, 'aba Servidores das Configurações ausente'
assert 'connectionProfileList' in h and 'connectionAddForm' in h, 'gerenciador de hosts não foi incorporado às Configurações'
assert 'Configurações → Servidores' in h, 'Tutorial ainda aponta para o botão antigo da barra'
assert 'guildContextMenu' in h and 'openGuildContextMenu' in a, 'menu de contexto de comunidade ausente'
assert 'Sair do servidor' in a and 'Excluir servidor' in a, 'ações de saída/exclusão ausentes'
assert 'type:deleting?"guild_delete":"guild_leave"' in a, 'cliente não envia ações de guild'
assert '.guild-context-menu' in c, 'estilo do menu de contexto ausente'
assert 'if t=="guild_leave"' in srv and 'if t=="guild_delete"' in srv, 'servidor sem leave/delete de guild'
assert 'guild_departures' in srv, 'saída não é persistida; usuário voltaria no auto-join'
assert 'guild_owner_must_delete' in srv and 'guild_delete_forbidden' in srv, 'proteções de proprietário ausentes'
assert '"guild_leave_delete":True' in srv, 'feature flag guild_leave_delete ausente'
print('==> v0.7.49 menu de servidor / sair-excluir / hosts nas Configurações: OK')
PY49


# v0.7.58: Home/Amigos como área separada + servidores fixos na rail
python3 - <<'PY50'
from pathlib import Path
import json
root=Path('.')
a=(root/'public/app.js').read_text(encoding='utf-8')
h=(root/'public/index.html').read_text(encoding='utf-8')
c=(root/'public/styles.css').read_text(encoding='utf-8')
pkg=json.loads((root/'electron/package.json').read_text(encoding='utf-8'))
assert pkg['version'] in ('0.7.58','0.7.59','0.7.60','0.7.61')
for x in ('homeButton','guildSidebarContent','homeSidebarContent','friendsView','friendsTabOnline','friendsTabAll','friendsTabPending','friendsTabAdd','friendsHomeList','friendsHomeSearchForm'):
    assert f'id="{x}"' in h, f'UI Home/Amigos ausente: {x}'
assert 'function openFriendsHome' in a and 'function renderFriendsHome' in a and 'function updateSidebarMode' in a
assert 'homeContextActive' in a and 'state.currentView==="friends"' in a
assert 'els.homeButton.onclick=()=>openFriendsHome("all")' in a
assert 'els.pendingFriendsButton.onclick=()=>openFriendsHome("pending")' in a
assert '.friends-home-view' in c and '.app-shell.home-context' in c and '.home-sidebar-content' in c
assert 'server-bubble' in h and 'id="guildRail"' in h, 'servidores não permanecem na rail lateral'
print('==> v0.7.58 Home/Amigos separado + servidores na lateral: OK')
PY50

# v0.7.58 - hardware encode VA-API Chromium 152
grep -q "AcceleratedVideoEncoder" electron/main.cjs
grep -q "hardware-video-device-path" electron/main.cjs
grep -q "effectiveVideoCodec" public/app.js
grep -q "6939" public/app.js
grep -q "67df" public/app.js
echo "[ok] v0.7.58 VA-API hardware encode + media GPU routing"

# v0.7.58 - escolha hardware/software para encoder
python3 - <<'PY56'
from pathlib import Path
import json
m=Path('electron/main.cjs').read_text(encoding='utf-8')
a=Path('public/app.js').read_text(encoding='utf-8')
h=Path('public/index.html').read_text(encoding='utf-8')
p=json.loads(Path('electron/package.json').read_text())
assert p['version'] in ('0.7.58','0.7.59','0.7.60','0.7.61')
assert 'encoderMode' in m and "['auto', 'hardware', 'software']" in m
assert "disable-features', 'AcceleratedVideoEncoder'" in m
assert 'encoderModeSelect' in h and 'Hardware / VA-API' in h and 'Software / CPU' in h
assert 'encoderMode:els.encoderModeSelect.value' in a
assert 'profile.encoderMode==="software"' in a
print('==> v0.7.58 encoder hardware/software selecionável: OK')
PY56


echo "==> Validando v0.7.58 qualidade de transmissão"
python - <<'PY2'
from pathlib import Path
app=Path('public/app.js').read_text()
html=Path('public/index.html').read_text()
assert 'screenQualityModeSelect' in html
assert 'streamSetupQualityMode' in html
assert 'maintain-resolution' in app
assert 'maintain-framerate' in app
assert 'contentHint=mode==="quality"?"detail":"motion"' in app
assert 'screenQualityMode:normalizeScreenQualityMode' in app
print('==> v0.7.58 qualidade máxima / resolução fixa: OK')
PY2


# v0.7.59 - estatísticas WebRTC no terminal
python3 - <<'PY59'
from pathlib import Path
import json
m=Path('electron/main.cjs').read_text(); p=Path('electron/preload.cjs').read_text(); a=Path('public/app.js').read_text()
pkg=json.loads(Path('electron/package.json').read_text())
assert pkg['version'] in ('0.7.59','0.7.60','0.7.61')
assert "desktop:webrtc-stats" in m and "desktop:webrtc-stats" in p and 'logWebrtcStats' in p
assert 'collectScreenPeerDiagnostics' in a and 'startScreenPeerDiagnostics' in a and 'startRemoteFrameTimingDiag' in a
for key in ['framesEncoded','framesSent','framesReceived','framesDecoded','framesDropped','packetsLost','nackCount','pliCount','roundTripTime','qpSum','repeatEst','presentGaps']:
    assert key in a, f'estatística ausente: {key}'
assert 'requestVideoFrameCallback' in a and 'rtcVideoTiming' in a
print('==> v0.7.59 diagnóstico WebRTC TX/RX no terminal: OK')
PY59


# v0.7.60 - viewer fullscreen estável + zero-copy selecionável
python3 - <<'PY60'
from pathlib import Path
import json
m=Path('electron/main.cjs').read_text(); p=Path('electron/preload.cjs').read_text(); a=Path('public/app.js').read_text(); h=Path('public/index.html').read_text(); c=Path('public/styles.css').read_text()
pkg=json.loads(Path('electron/package.json').read_text())
assert pkg['version'] in ('0.7.60','0.7.61')
assert 'zeroCopyMode' in m and "['auto', 'safe', 'zero-copy']" in m
assert "disable-zero-copy" in m and "enable-zero-copy" in m
assert 'zeroCopyModeSelect' in h and 'Cópia segura' in h and 'Zero-copy' in h
assert 'zeroCopyMode:els.zeroCopyModeSelect.value' in a
assert 'desktop:set-viewer-fullscreen' in m and 'setViewerFullscreen' in p
assert 'window.openCallDesktop?.setViewerFullscreen' in a and 'setViewerFullscreenState' in a
assert '.pinned-stream.viewer-fullscreen' in c
print('==> v0.7.60 fullscreen viewer estável + zero-copy selecionável: OK')
PY60


# v0.7.61 - chamada privada integrada à conversa (rebuild direto da 0.7.60)
python3 - <<'PY61'
from pathlib import Path
import json
a=Path('public/app.js').read_text(); h=Path('public/index.html').read_text(); c=Path('public/styles.css').read_text(); m=Path('electron/main.cjs').read_text()
pkg=json.loads(Path('electron/package.json').read_text())
assert pkg['version']=='0.7.61' and "APP_VERSION = '0.7.61'" in m
assert 'id="dmCallHost"' in h and 'dm-call-host' in c
assert 'function mountCallUiInDm()' in a and 'function restoreCallUiHome()' in a
assert 'switchView("dm");mountCallUiInDm()' in a
assert 'Conversa privada · chamada ativa' in a
assert 'dmCallHost.append(els.callStage,els.callControls)' in a
assert 'state.dmCallThreadId===tid' in a
assert 'zeroCopyModeSelect' in h and 'zeroCopyMode' in m  # preserva a 0.7.60
assert 'decoderModeSelect' not in h  # não herdar a antiga 0.7.61 descartada
print('==> v0.7.61 DM call + conversa integrada, base 0.7.60: OK')
PY61
