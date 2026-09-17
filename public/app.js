"use strict";

const $ = id => document.getElementById(id);
const qsa = sel => Array.from(document.querySelectorAll(sel));
const STORAGE_KEY = "opencall-v060-settings";
const DEFAULT_STUN_URL = "stun:stun.l.google.com:19302";
const DEFAULT_SIGNALING_URL = "wss://2d-instalacoes.tailc76287.ts.net:8443/ws";
const AUTH_KEY = "opencall-v060-auth-token"; // legado: migrado para token por servidor na v0.7.47
const CONNECTION_PROFILES_KEY = "opencall-v0747-connection-profiles";
const CONNECTION_AUTH_PREFIX = "opencall-v0747-auth:";
const CONNECTION_ACCOUNT_PREFIX = "opencall-v0747-account:";
const DEVICE_KEY = "opencall-v060-device";
const FP_KEY = "opencall-v060-fingerprint";
const TUTORIAL_SEEN_PREFIX = "opencall-v0746-tutorial-seen:";
const EMOJIS = [
  "😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🫣","🤭","🫢","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🤢","🤮","🤧","😷","🤒","🤕",
  "👍","👎","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉","👆","👇","☝️","✋","🤚","🖐️","🖖","👋","🤝","👏","🙌","🫶","🙏","✍️","💪","🫡","👀","🧠","❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹","💯","💢","💥","💫","💦","💨","🔥","✨","⭐","🌟","⚡","🎉","🎊","✅","❌","⚠️","❓","❗",
  "💀","☠️","👻","👽","🤖","🤡","😈","💩","🐱","🐶","🐸","🐵","🦊","🐺","🐼","🐧","🦆","🦖","🐉","🍕","🍔","🍟","🌭","🍿","☕","🥤","🍺","🎮","🕹️","🎧","🎙️","📷","🖥️","💻","⌨️","🖱️","📱","🚀","🏎️","⚽","🏀","🎯","🏆","🥇","🎵","🎶"
];
const ALL_PERMS = ["manage_server","manage_channels","manage_roles","manage_users","manage_messages","kick","ban","timeout","pin","mention_everyone","upload_files","speak","stream","camera","create_invite","view_admin","delete_others_messages"];
const STREAM_VOLUME_KEY = "opencall-stream-volumes-v1";
const SCREEN_RESOLUTIONS = {
  "720p": { width: 1280, height: 720, label: "720p (1280×720)" },
  "1080p": { width: 1920, height: 1080, label: "1080p (1920×1080)" },
  "1440p": { width: 2560, height: 1440, label: "1440p / 2K (2560×1440)" },
  "2160p": { width: 3840, height: 2160, label: "4K (3840×2160)" },
};
const SCREEN_PROFILE_DEFAULT = { resolution:"1080p", fps:60, bitrateMbps:8 };
const SCREEN_QUALITY_DEFAULT = "quality";
function normalizeScreenQualityMode(value){return ["quality","balanced","smooth"].includes(value)?value:SCREEN_QUALITY_DEFAULT}
function screenQualityModeLabel(value=settings?.screenQualityMode||SCREEN_QUALITY_DEFAULT){value=normalizeScreenQualityMode(value);return value==="quality"?"Qualidade máxima":value==="smooth"?"Fluidez":"Equilibrado"}
function clampNumber(v,min,max,fallback){v=Number(v);return Number.isFinite(v)?Math.min(max,Math.max(min,v)):fallback}
function legacyScreenProfile(value){
  const map={
    "2500000:30":{resolution:"720p",fps:30,bitrateMbps:2.5},
    "5000000:30":{resolution:"1080p",fps:30,bitrateMbps:5},
    "8000000:60":{resolution:"1080p",fps:60,bitrateMbps:8},
    "10000000:60":{resolution:"1080p",fps:60,bitrateMbps:10},
  };
  return map[value]||null;
}
function normalizeScreenProfile(profile={}){
  const resolution=SCREEN_RESOLUTIONS[profile.resolution]?profile.resolution:SCREEN_PROFILE_DEFAULT.resolution;
  return {resolution,fps:Math.round(clampNumber(profile.fps,1,120,SCREEN_PROFILE_DEFAULT.fps)),bitrateMbps:Math.round(clampNumber(profile.bitrateMbps,.5,100,SCREEN_PROFILE_DEFAULT.bitrateMbps)*10)/10};
}
function screenProfileLabel(profile=screenProfileFromSettings()){
  profile=normalizeScreenProfile(profile);const r=SCREEN_RESOLUTIONS[profile.resolution];return `${r.label} · ${profile.fps} FPS · ${profile.bitrateMbps} Mbps`;
}

const els = Object.fromEntries([
  "app","homeButton","guildRail","createGuildButton","openSettingsRail","guildName","connectionStatus","guildMenuButton","globalSearchButton","channelTree","guildSidebarContent","homeSidebarContent","homeDmSearchButton","friendsButton","friendRequestBadge","pendingFriendsButton","pendingFriendsCount","newDmButton","dmList","voiceMiniPanel","voiceMiniChannel","miniMuteButton","miniDeafenButton","miniLeaveButton","selfAvatar","selfName","selfStatus","selfMuteButton","selfDeafenButton","openSettingsButton","viewIcon","viewTitle","viewSubtitle","dmVoiceCallButton","dmVideoCallButton","dmScreenCallButton","dmOpenCallButton","notificationButton","pinsButton","membersToggleButton","adminButton","reconnectButton","friendsView","friendsTabOnline","friendsTabAll","friendsTabPending","friendsTabAdd","friendsPendingBadge","friendsBrowsePanel","friendsListSearch","friendsHomeHeading","friendsHomeList","friendsHomeSearchPanel","friendsHomeSearchForm","friendsHomeSearchInput","friendsHomeSearchResult","chatView","messageScroller","channelWelcome","welcomeTitle","welcomeText","messageList","replyBar","replyText","cancelReplyButton","uploadTray","typingText","chatForm","attachButton","screenshotButton","chatInput","emojiButton","gifButton","sendButton","composeHint","messageCounter","emojiPicker","callView","callStage","pinnedStreamPanel","remoteScreenVideo","streamOwnerLabel","streamStateLabel","fullscreenStreamButton","closePinnedStream","localScreenPreviewWrap","localScreenPreview","hideLocalPreviewButton","voiceGrid","callEmpty","joinVoiceButton","callMuteButton","callDeafenButton","cameraButton","screenShareButton","callLeaveButton","callControls","dmView","dmCallHost","dmScroller","dmMessageList","dmReplyBar","dmUploadTray","dmForm","dmAttachButton","dmInput","dmEmojiButton","dmGifButton","dmEmojiPicker","dmIncomingCallDialog","dmIncomingCallSubtitle","dmIncomingCallName","dmIncomingCallInfo","dmIncomingCallDecline","dmIncomingCallAccept","memberPanel","memberCount","memberList","dropOverlay","toastStack","filePicker","gifPicker","avatarPicker","imageViewerDialog","imageViewerTitle","imageViewerMeta","imageViewerDownload","imageViewerClose","imageViewerImage","videoViewerDialog","videoViewerTitle","videoViewerMeta","videoViewerDownload","videoViewerClose","videoViewerVideo","avatarCropDialog","avatarCropStage","avatarCropCanvas","avatarCropZoom","avatarCropReset","avatarCropCancel","avatarCropApply","avatarFrameDialog","avatarFrameStage","avatarFrameImage","avatarFrameZoom","avatarFrameReset","avatarFrameCancel","avatarFrameApply","authDialog","loginTab","registerTab","authForm","displayNameField","authDisplayName","authUsername","authPassword","authError","authSubmit","settingsDialog","tutorialCurrentConnection","tutorialOpenConnectionButton","tutorialUsePublicButton","guildContextMenu","connectionManagerCurrent","connectionSearchInput","connectionProfileList","connectionAddForm","connectionNameInput","connectionUrlInput","authConnectionName","authConnectionUrl","authChangeConnectionButton","settingsAvatar","changeAvatarButton","adjustAvatarButton","removeAvatarButton","profileDisplayName","profileStatus","profileCustomStatus","saveProfileButton","audioInputSelect","audioOutputSelect","refreshDevicesButton","testOutputButton","noiseSuppressionMode","noiseSuppressionStatus","voiceThreshold","voiceThresholdValue","pushToTalkToggle","pushToTalkKey","cameraSelect","videoCodecSelect","screenQualityModeSelect","screenResolutionSelect","screenFpsInput","screenBitrateInput","gpuRenderer","desktopSettingsTab","desktopOnlyNotice","encoderGpuSelect","decoderGpuSelect","encoderModeSelect","zeroCopyModeSelect","gpuBackendSelect","hardwareAccelerationToggle","refreshGpuButton","applyGpuButton","desktopGpuApplied","desktopGpuEnv","desktopGpuEncodeStatus","desktopGpuDecodeStatus","desktopGpuDetails","desktopNotifications","notifyMentions","notifyStreams","requestNotificationPermission","signalingUrl","stunUrl","turnUrl","turnUsername","turnPassword","saveConnectionButton","accountUsername","accountId","oldPassword","newPassword","changePasswordButton","logoutButton","adminDialog","adminGuildName","adminStats","newCategoryName","createCategoryButton","adminCategoryList","newChannelName","newChannelType","newChannelCategory","createChannelButton","adminChannelList","newRoleName","createRoleButton","rolePermissionEditor","adminRoleList","inviteHours","inviteUses","createInviteButton","inviteResult","adminMemberList","adminLogList","createGuildDialog","createGuildForm","newGuildName","joinGuildDialog","joinGuildForm","inviteCodeInput","newDmDialog","dmGroupName","dmUserPicker","createGroupDmButton","friendsDialog","friendSearchForm","friendSearchInput","friendSearchResult","friendsList","incomingFriendRequests","outgoingFriendRequests","searchDialog","searchForm","searchInput","searchResults","pinsDialog","pinsTitle","pinsList","editMessageDialog","editMessageForm","editMessageInput","editMessageCounter","editMessageCancel","editMessageAttachments","editMessageAttachButton","editMessageFilePicker","editMessageAttachmentHint","userDialog","userDialogName","userDialogAvatar","userDialogPublicId","userDialogStatus","userVolumeSlider","userVolumeValue","userMuteLocalButton","userDmButton","userAddFriendButton","userBlockButton","userTimeoutButton","userKickButton","userBanButton","streamSetupDialog","streamSetupForm","streamSetupResolution","streamSetupFps","streamSetupBitrate","streamSetupQualityMode","streamSetupAudio","streamSetupSummary","streamSetupCancel","desktopSourceDialog","desktopSourceCancel","desktopSourceRefresh","desktopSourceHint","shareAudioOptions","shareSystemAudioToggle","shareAudioIsolationStatus","desktopSourceGrid","floatingStreamDock","floatingStreamDrag","floatingStreamViewers","floatingStreamOpen","floatingStreamHide","floatingStreamVideoButton","floatingStreamVideo","floatingStreamState","floatingStreamStop","floatingStreamRestore","screenContextMenu","screenContextTitle","screenContextSubtitle","hostQualityMenu","hostResolutionSelect","hostFpsInput","hostBitrateInput","hostQualityApply","hostQualitySummary","viewerVolumeMenu","streamVolumeSlider","streamVolumeValue","streamMuteToggle","streamFullscreenToggle"
].map(id => [id,$(id)]));

function randomId(bytes=12){const a=new Uint8Array(bytes);crypto.getRandomValues(a);return Array.from(a,b=>b.toString(16).padStart(2,"0")).join("");}
function stableValue(key,prefix){let v=localStorage.getItem(key);if(!v){v=`${prefix}-${randomId(10)}`;localStorage.setItem(key,v)}return v}
const deviceId=stableValue(DEVICE_KEY,"device");
const fingerprint=stableValue(FP_KEY,"fp");
function safeText(v){return String(v??"")}
function initials(name){return safeText(name).trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase().slice(0,2)||"?"}
function publicUserId(u={}){const name=safeText(u.display_name||u.username||"Usuário");const raw=safeText(u.user_tag||"");return raw?`${name}#${raw.padStart(4,"0")}`:name}
function escapeHtml(v){return safeText(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}
function formatBytes(n){n=Number(n)||0;if(n<1024)return `${n} B`;const u=["KB","MB","GB","TB"];let i=-1;do{n/=1024;i++}while(n>=1024&&i<u.length-1);return `${n.toFixed(n>=100?0:n>=10?1:2)} ${u[i]}`}
function formatTime(sec){try{return new Intl.DateTimeFormat("pt-BR",{hour:"2-digit",minute:"2-digit"}).format(new Date(Number(sec)*1000))}catch{return ""}}
function toast(msg,type="info",ms=3600){const n=document.createElement("div");n.className=`toast ${type}`;n.textContent=msg;els.toastStack.appendChild(n);setTimeout(()=>n.remove(),ms)}

function loadSettings(){let s={};try{s=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")}catch{}
  const migrated=normalizeScreenProfile(s.screenProfile||legacyScreenProfile(s.screenQuality)||SCREEN_PROFILE_DEFAULT);
  return {signalingUrl:s.signalingUrl||DEFAULT_SIGNALING_URL,stunUrl:s.stunUrl||DEFAULT_STUN_URL,turnUrl:s.turnUrl||"",turnUsername:s.turnUsername||"",turnPassword:s.turnPassword||"",audioInput:s.audioInput||"",audioOutput:s.audioOutput||"",cameraId:s.cameraId||"",videoCodec:s.videoCodec||"auto",screenQualityMode:normalizeScreenQualityMode(s.screenQualityMode),screenProfile:migrated,voiceThreshold:Number(s.voiceThreshold||10),pushToTalk:Boolean(s.pushToTalk),desktopNotifications:Boolean(s.desktopNotifications),notifyMentions:s.notifyMentions!==false,notifyStreams:Boolean(s.notifyStreams),shareSystemAudio:s.shareSystemAudio!==false,noiseSuppressionMode:["off","webrtc","rnnoise"].includes(s.noiseSuppressionMode)?s.noiseSuppressionMode:"webrtc"};
}
let settings=loadSettings();
function saveSettings(){settings.screenProfile=normalizeScreenProfile(settings.screenProfile);localStorage.setItem(STORAGE_KEY,JSON.stringify(settings))}
function normalizeSignalingUrl(value){
  let raw=safeText(value).trim();if(!raw)throw new Error("Informe o endereço do servidor.");
  if(/^https?:\/\//i.test(raw))raw=raw.replace(/^http:/i,"ws:").replace(/^https:/i,"wss:");
  if(!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)){
    const local=/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(raw);
    raw=`${local?"ws":"wss"}://${raw}`;
  }
  const u=new URL(raw);if(!["ws:","wss:"].includes(u.protocol))throw new Error("Use ws://, wss://, http:// ou https://.");
  if(!u.hostname)throw new Error("Servidor inválido.");if(!u.pathname||u.pathname==="/")u.pathname="/ws";u.hash="";return u.toString();
}
function connectionKeyPart(url){let normalized=safeText(url).trim();try{normalized=normalizeSignalingUrl(normalized)}catch{}return encodeURIComponent(normalized)}
function connectionAuthKey(url){return `${CONNECTION_AUTH_PREFIX}${connectionKeyPart(url)}`}
function connectionAccountKey(url){return `${CONNECTION_ACCOUNT_PREFIX}${connectionKeyPart(url)}`}
function authTokenForUrl(url,{migrateLegacy=false}={}){let token=localStorage.getItem(connectionAuthKey(url))||"";if(!token&&migrateLegacy){const legacy=localStorage.getItem(AUTH_KEY)||"";if(legacy){token=legacy;localStorage.setItem(connectionAuthKey(url),legacy);localStorage.removeItem(AUTH_KEY)}}return token}
function saveAuthTokenForUrl(url,token){if(token)localStorage.setItem(connectionAuthKey(url),token);else localStorage.removeItem(connectionAuthKey(url))}
function savedAccountForUrl(url){try{return JSON.parse(localStorage.getItem(connectionAccountKey(url))||"null")}catch{return null}}
function saveAccountForUrl(url,profile){if(!profile)return;localStorage.setItem(connectionAccountKey(url),JSON.stringify({display_name:profile.display_name||profile.username||"Conta",username:profile.username||"",public_id:publicUserId(profile),user_id:profile.user_id||null}))}
function defaultConnectionProfile(){return {id:"public",name:"OpenCall Público",url:DEFAULT_SIGNALING_URL,builtin:true,created_at:0}}
function loadConnectionProfiles(){let list=[];try{list=JSON.parse(localStorage.getItem(CONNECTION_PROFILES_KEY)||"[]")}catch{}if(!Array.isArray(list))list=[];const out=[],seen=new Set();const add=(item)=>{try{const url=normalizeSignalingUrl(item?.url||"");if(seen.has(url))return;seen.add(url);out.push({id:safeText(item?.id)||`host-${randomId(6)}`,name:safeText(item?.name).trim()||new URL(url).hostname,url,builtin:Boolean(item?.builtin),created_at:Number(item?.created_at)||Date.now(),last_used:Number(item?.last_used)||0})}catch{}};add(defaultConnectionProfile());for(const item of list)add(item);try{const current=normalizeSignalingUrl(settings.signalingUrl);if(!seen.has(current))add({id:`host-${randomId(6)}`,name:"Servidor atual",url:current,last_used:Date.now()})}catch{}return out}
let connectionProfiles=loadConnectionProfiles();
function saveConnectionProfiles(){localStorage.setItem(CONNECTION_PROFILES_KEY,JSON.stringify(connectionProfiles))}
function currentConnectionProfile(){let current=settings.signalingUrl;try{current=normalizeSignalingUrl(current)}catch{}return connectionProfiles.find(x=>x.url===current)||{id:"current",name:"Servidor atual",url:current,builtin:false}}
function ensureConnectionProfile(url,name="Servidor personalizado"){url=normalizeSignalingUrl(url);let profile=connectionProfiles.find(x=>x.url===url);if(!profile){profile={id:`host-${randomId(6)}`,name:safeText(name).trim()||new URL(url).hostname,url,builtin:false,created_at:Date.now(),last_used:Date.now()};connectionProfiles.push(profile)}else if(name&&profile.name==="Servidor atual")profile.name=safeText(name).trim()||profile.name;saveConnectionProfiles();return profile}
function updateAuthConnectionUi(){const profile=currentConnectionProfile();if(els.authConnectionName)els.authConnectionName.textContent=profile.name||"Servidor atual";if(els.authConnectionUrl)els.authConnectionUrl.textContent=settings.signalingUrl||DEFAULT_SIGNALING_URL}
function renderConnectionProfiles(){
  if(!els.connectionProfileList)return;const q=safeText(els.connectionSearchInput?.value).trim().toLowerCase(),current=currentConnectionProfile();els.connectionProfileList.replaceChildren();
  if(els.connectionManagerCurrent)els.connectionManagerCurrent.innerHTML=`<strong>${escapeHtml(current.name||"Servidor atual")}</strong><span>${escapeHtml(settings.signalingUrl||DEFAULT_SIGNALING_URL)}</span>`;
  const filtered=connectionProfiles.filter(p=>!q||`${p.name} ${p.url}`.toLowerCase().includes(q));
  for(const profile of filtered){const card=document.createElement("div");const isCurrent=profile.url===current.url;card.className=`connection-profile-card ${isCurrent?"current":""}`;const main=document.createElement("div");main.className="connection-profile-main";const account=savedAccountForUrl(profile.url),hasSession=Boolean(authTokenForUrl(profile.url));main.innerHTML=`<strong>${escapeHtml(profile.name)}${profile.builtin?' <span class="connection-builtin">· padrão</span>':''}</strong><span>${escapeHtml(profile.url)}</span><small>${isCurrent?"● conectado/agora":"○ salvo"}${account?` · ${hasSession?"sessão salva":"última conta"}: ${escapeHtml(account.public_id||account.display_name||account.username||"")}`:" · sem conta salva"}</small>`;const actions=document.createElement("div");actions.className="connection-profile-actions";const connectBtn=document.createElement("button");connectBtn.className=isCurrent?"secondary-btn":"primary-btn";connectBtn.type="button";connectBtn.textContent=isCurrent?"Atual":"Conectar";connectBtn.disabled=isCurrent;connectBtn.onclick=()=>switchConnectionProfile(profile);actions.appendChild(connectBtn);
    if(!profile.builtin){const rename=document.createElement("button");rename.className="secondary-btn";rename.type="button";rename.textContent="Editar";rename.onclick=()=>editConnectionProfile(profile);const remove=document.createElement("button");remove.className="danger-btn";remove.type="button";remove.textContent="Remover";remove.disabled=isCurrent;remove.onclick=()=>removeConnectionProfile(profile);actions.append(rename,remove)}card.append(main,actions);els.connectionProfileList.appendChild(card)}
  if(!filtered.length){const empty=document.createElement("div");empty.className="friend-empty";empty.textContent="Nenhum servidor salvo corresponde à busca.";els.connectionProfileList.appendChild(empty)}
}
function openConnectionManager(){if(els.settingsDialog?.open){selectSettingsTab("servers");renderConnectionProfiles();return}openSettings("servers");renderConnectionProfiles()}
function clearServerScopedState(){clearAvatarMediaCache();cleanupVoice(false);cleanupScreen(false);state.clientId=null;state.uploadToken="";state.serverVersion="";state.features={};state.rtcConfig=null;state.connected=false;state.authenticated=false;state.profile=null;state.guilds=[];state.guildId=null;state.structure={guild:null,categories:[],channels:[],roles:[]};state.permissions=new Set();state.presence=[];state.currentView="chat";state.channelId=null;state.dmThreadId=null;state.messages=new Map();state.dmMessages=new Map();state.dmThreads=[];state.friends=[];state.friendIncoming=[];state.friendOutgoing=[];state.friendSearchResult=null;state.unread=new Map();state.typing=new Map();state.replyTo=null;state.dmReplyTo=null;renderGuildRail();renderChannels();renderMembers();renderDmList();updateSelfUI();els.guildName.textContent="OpenCall";els.viewTitle.textContent="Conectando…";els.viewSubtitle.textContent="Servidor de conexão"}
function switchConnectionProfile(profile){let url;try{url=normalizeSignalingUrl(profile.url)}catch(e){toast(e.message||String(e),"error");return}const same=url===settings.signalingUrl;if(same&&state.connected){toast(`Você já está em ${profile.name}.`,"info");return}disconnect(true);clearServerScopedState();settings.signalingUrl=url;saveSettings();profile.last_used=Date.now();saveConnectionProfiles();if(els.settingsDialog.open)els.settingsDialog.close();setConnection(`conectando a ${profile.name}…`);setTimeout(connect,120)}
function editConnectionProfile(profile){const oldUrl=profile.url;const name=prompt("Nome do servidor:",profile.name);if(name===null)return;const raw=prompt("Endereço WebSocket / HTTPS:",profile.url);if(raw===null)return;try{const url=normalizeSignalingUrl(raw),duplicate=connectionProfiles.find(x=>x!==profile&&x.url===url);if(duplicate)throw new Error("Esse servidor já está salvo.");profile.name=safeText(name).trim()||new URL(url).hostname;profile.url=url;saveConnectionProfiles();if(oldUrl===settings.signalingUrl){settings.signalingUrl=url;saveSettings()}renderConnectionProfiles();toast("Servidor atualizado.","success")}catch(e){toast(e.message||String(e),"error")}}
function removeConnectionProfile(profile){if(profile.builtin)return;if(profile.url===settings.signalingUrl){toast("Conecte a outro servidor antes de remover este.","error");return}if(!confirm(`Remover “${profile.name}” da lista? A conta no servidor não será apagada.`))return;connectionProfiles=connectionProfiles.filter(x=>x.id!==profile.id);saveConnectionProfiles();renderConnectionProfiles()}
function screenProfileFromSettings(){return normalizeScreenProfile(settings.screenProfile||SCREEN_PROFILE_DEFAULT)}
function voiceStateIcons(u){const v=u?.voice||{};return `${v.muted?"🔇":""}${v.deafened?"🎧":""}`}
function voiceAudioConstraints({deviceId,noiseMode=settings.noiseSuppressionMode||"webrtc"}={}){
  const base={deviceId:deviceId?{exact:deviceId}:undefined,echoCancellation:noiseMode!=="off",noiseSuppression:noiseMode==="webrtc",autoGainControl:noiseMode!=="off",channelCount:{ideal:1},sampleRate:{ideal:48000}};
  if(noiseMode==="webrtc"&&navigator.mediaDevices?.getSupportedConstraints?.().voiceIsolation)base.voiceIsolation=true;
  return base;
}
let rnnoiseAssetsPromise=null;
function decodeBase64Bytes(value){
  const raw=atob(String(value||""));
  const out=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
  return out;
}
function bytesToBase64(bytes){
  let out="";const CHUNK=0x8000;
  for(let i=0;i<bytes.length;i+=CHUNK)out+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+CHUNK)));
  return btoa(out);
}
function javascriptDataUrl(source){
  const bytes=new TextEncoder().encode(String(source||""));
  return `data:text/javascript;base64,${bytesToBase64(bytes)}`;
}
async function loadRnnoiseAssets(){
  if(!rnnoiseAssetsPromise)rnnoiseAssetsPromise=(async()=>{
    if(!window.openCallDesktop?.getRnnoiseWasmAssets)throw new Error("Bridge RNNoise do Electron indisponível");
    const bundled=await window.openCallDesktop.getRnnoiseWasmAssets();
    if(!bundled?.workletSource||!bundled?.wasmBase64)throw new Error("Runtime RNNoise empacotado está incompleto");
    const wasmBytes=decodeBase64Bytes(bundled.wasmBase64);
    if(wasmBytes.length<50000||wasmBytes[0]!==0||wasmBytes[1]!==97||wasmBytes[2]!==115||wasmBytes[3]!==109)throw new Error("RNNoise WASM empacotado é inválido");
    return {workletSource:bundled.workletSource,wasmBytes};
  })().catch(err=>{rnnoiseAssetsPromise=null;throw err});
  return rnnoiseAssetsPromise;
}
function stopManagedVoiceStream(stream){
  if(!stream)return;
  const cleanup=stream.__opencallCleanup;
  if(typeof cleanup==="function"){try{cleanup()}catch{};return}
  try{stream.getTracks().forEach(t=>t.stop())}catch{}
}
async function createRnnoiseStream(rawStream){
  const AudioCtx=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtx||!window.AudioWorkletNode)throw new Error("AudioWorklet não está disponível neste Chromium");
  const ctx=new AudioCtx({sampleRate:48000,latencyHint:"interactive"});
  let source=null,node=null,dest=null,cleaned=false;
  try{
    const assets=await loadRnnoiseAssets();
    if(ctx.state==="closed")throw new Error("AudioContext foi fechado antes de carregar RNNoise");

    // Em páginas file:// o Chromium pode recusar blob: em AudioWorklet.addModule().
    // data: é carregado como módulo sem depender de CORS/file:// e o worklet não
    // possui imports externos.
    const workletUrl=javascriptDataUrl(assets.workletSource);
    await ctx.audioWorklet.addModule(workletUrl);
    if(ctx.state==="closed")throw new Error("AudioContext foi fechado durante o carregamento do RNNoise");

    const wasmBuffer=assets.wasmBytes.buffer.slice(assets.wasmBytes.byteOffset,assets.wasmBytes.byteOffset+assets.wasmBytes.byteLength);
    node=new AudioWorkletNode(ctx,"opencall-rnnoise",{
      channelCountMode:"explicit",channelCount:1,channelInterpretation:"speakers",
      numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],
      processorOptions:{wasmBytes:wasmBuffer}
    });

    await new Promise((resolve,reject)=>{
      let done=false;
      const timer=setTimeout(()=>{if(!done){done=true;reject(new Error("RNNoise AudioWorklet não confirmou inicialização"))}},2500);
      node.port.onmessage=({data})=>{
        if(done)return;
        if(data?.type==="ready") {done=true;clearTimeout(timer);resolve();return}
        if(data?.type==="error") {done=true;clearTimeout(timer);reject(new Error(data.message||"RNNoise AudioWorklet falhou"))}
      };
      node.onprocessorerror=()=>{if(!done){done=true;clearTimeout(timer);reject(new Error("RNNoise AudioWorklet encontrou erro de processamento"))}};
    });

    if(ctx.state!=="running")await ctx.resume();
    if(ctx.state!=="running")throw new Error(`AudioContext ficou ${ctx.state}`);
    source=ctx.createMediaStreamSource(rawStream);
    dest=ctx.createMediaStreamDestination();
    try{dest.channelCount=1;dest.channelCountMode="explicit"}catch{}
    source.connect(node);node.connect(dest);
    const out=new MediaStream(dest.stream.getAudioTracks());
    const cleanup=()=>{
      if(cleaned)return;cleaned=true;
      try{node?.port?.postMessage({type:"stop"})}catch{}
      try{source?.disconnect()}catch{}try{node?.disconnect()}catch{}
      try{out.getTracks().forEach(t=>{if(t.readyState!=="ended")t.stop()})}catch{}
      try{rawStream.getTracks().forEach(t=>{if(t.readyState!=="ended")t.stop()})}catch{}
      try{ctx.close()}catch{}
    };
    Object.defineProperty(out,"__opencallCleanup",{value:cleanup,configurable:true});
    const rawTrack=rawStream.getAudioTracks()[0];if(rawTrack)rawTrack.addEventListener("ended",()=>cleanup(),{once:true});
    return out;
  }catch(err){
    try{node?.port?.postMessage({type:"stop"})}catch{}
    try{source?.disconnect()}catch{}try{node?.disconnect()}catch{}
    try{rawStream.getTracks().forEach(t=>t.stop())}catch{}
    try{ctx.close()}catch{}
    throw err;
  }
}
async function stopRnnoiseBridge(){/* legado LADSPA removido: RNNoise agora é WASM por stream */}
async function openVoiceMicrophoneStream(){
  const mode=settings.noiseSuppressionMode||"webrtc";
  if(mode==="rnnoise"){
    try{
      const raw=await navigator.mediaDevices.getUserMedia({audio:voiceAudioConstraints({deviceId:settings.audioInput,noiseMode:"rnnoise"}),video:false});
      const stream=await createRnnoiseStream(raw);
      if(els.noiseSuppressionStatus)els.noiseSuppressionStatus.textContent="RNNoise ativo dentro do OpenCall (WASM + AudioWorklet).";
      return stream;
    }catch(err){
      console.warn("RNNoise WASM fallback",err);
      toast(`RNNoise WASM indisponível (${err.message||err}). Usando supressão WebRTC.`,"info",5000);
    }
  }
  const noiseMode=mode==="off"?"off":"webrtc";
  if(els.noiseSuppressionStatus)els.noiseSuppressionStatus.textContent=noiseMode==="off"?"Supressão desligada.":"Supressão WebRTC ativa (com voiceIsolation quando suportado).";
  return navigator.mediaDevices.getUserMedia({audio:voiceAudioConstraints({deviceId:settings.audioInput,noiseMode}),video:false});
}

const state={
  ws:null,clientId:null,uploadToken:"",serverVersion:"",features:{},rtcConfig:null,connected:false,authenticated:false,profile:null,
  guilds:[],guildId:null,structure:{guild:null,categories:[],channels:[],roles:[]},permissions:new Set(),presence:[],
  currentView:"chat",friendsMode:"all",channelId:null,dmThreadId:null,messages:new Map(),dmMessages:new Map(),dmThreads:[],friends:[],friendIncoming:[],friendOutgoing:[],friendSearchResult:null,unread:new Map(),typing:new Map(),replyTo:null,dmReplyTo:null,editingMessage:null,editingAttachments:[],editPendingFiles:[],editReplaceKey:null,editAttachmentsDirty:false,
  pendingFiles:[],activeUploads:new Map(),authMode:"login",manualDisconnect:false,reconnectTimer:null,reconnectAttempt:0,
  voiceChannelId:null,voiceJoining:false,voiceStream:null,cameraStream:null,voicePeers:new Map(),voiceMuted:false,voiceDeafened:false,voiceCamera:false,voiceSpeaking:false,speakingTimer:null,audioContext:null,analyser:null,
  dmCallThreadId:null,dmCallJoining:false,dmCallParticipants:new Map(),dmCallPendingVideo:false,dmCallPendingScreen:false,incomingDmCall:null,
  screenStream:null,screenSessionCode:null,screenPeers:new Map(),viewerPeer:null,viewingHostId:null,viewingSessionCode:null,screenScope:null,showLocalPreview:false,viewerFullscreen:false,floatingStreamHidden:false,floatingStreamPos:null,streamVolumes:new Map(JSON.parse(localStorage.getItem(STREAM_VOLUME_KEY)||"[]")),streamLastNonZero:new Map(),
  peerVolumes:new Map(JSON.parse(localStorage.getItem("opencall-peer-volumes")||"[]")),selectedUser:null,previousStreams:new Set(),mutedChannels:new Set(JSON.parse(localStorage.getItem("opencall-muted-channels")||"[]")),mutedGuilds:new Set(JSON.parse(localStorage.getItem("opencall-muted-guilds")||"[]")),pendingInvite:new URLSearchParams(location.search).get("invite")||"",
  desktop:{available:Boolean(window.openCallDesktop),gpus:[],profile:null,diagnostics:null,sourceResolve:null,platform:"",nativeDisplayPickerPreferred:false,sessionType:"",desktopEnvironment:"",systemAudioActive:false,systemAudioInfo:null},
  avatarCrop:{file:null,dataUrl:"",image:null,imgW:0,imgH:0,baseScale:1,zoom:1,x:0,y:0,dragging:false,startX:0,startY:0,baseX:0,baseY:0},
  avatarFrame:{zoom:1,x:0,y:0,dragging:false,startX:0,startY:0,baseX:0,baseY:0},
};

function serverHttpBase(){try{const u=new URL(settings.signalingUrl);return `${u.protocol==="wss:"?"https:":"http:"}//${u.host}`}catch{return "https://2d-instalacoes.tailc76287.ts.net:8443"}}
function mediaUrl(id,download=false){if(!id||!state.uploadToken)return "";return `${serverHttpBase()}/media/${encodeURIComponent(id)}?token=${encodeURIComponent(state.uploadToken)}${download?"&download=true":""}`}
const avatarMediaCache=new Map();
function avatarCacheKey(mediaId){return safeText(mediaId)}
function clearAvatarMediaCache(){for(const entry of avatarMediaCache.values()){if(entry?.url)try{URL.revokeObjectURL(entry.url)}catch{}if(entry?.previewUrl)try{URL.revokeObjectURL(entry.previewUrl)}catch{}}avatarMediaCache.clear()}
function primeAvatarCache(mediaId,blob){if(!mediaId||!blob)return null;const key=avatarCacheKey(mediaId),old=avatarMediaCache.get(key);if(old?.url)try{URL.revokeObjectURL(old.url)}catch{}const entry={blob,mime:(blob.type||"").toLowerCase(),url:URL.createObjectURL(blob),promise:null,previewUrl:old?.previewUrl||""};avatarMediaCache.set(key,entry);return entry}
function loadAvatarMedia(mediaId){if(!mediaId||!state.uploadToken)return Promise.resolve(null);const key=avatarCacheKey(mediaId),cached=avatarMediaCache.get(key);if(cached?.url)return Promise.resolve(cached);if(cached?.promise)return cached.promise;const holder={url:"",blob:null,mime:"",previewUrl:"",promise:null};holder.promise=(async()=>{const res=await fetch(mediaUrl(mediaId),{cache:"force-cache"});if(!res.ok)throw new Error(`HTTP ${res.status}`);const blob=await res.blob();return primeAvatarCache(mediaId,blob)})().catch(err=>{avatarMediaCache.delete(key);throw err});avatarMediaCache.set(key,holder);return holder.promise}
function preloadAvatarMedia(items=[]){const ids=new Set();for(const item of items||[]){const id=item?.avatar_media_id||item?.media_id;if(id)ids.add(safeText(id))}for(const id of ids)loadAvatarMedia(id).catch(()=>{})}
function clearAvatarVisual(node){for(const child of Array.from(node.children)){if(child.classList?.contains("presence-dot"))continue;child.remove()}}
function setAvatarFallback(node,name){clearAvatarVisual(node);const span=document.createElement("span");span.className="avatar-content";span.textContent=initials(name);node.prepend(span)}
function applyAvatarCached(node,entry,frameSource,key){if(!node||node.dataset.avatarKey!==key||!entry?.url)return;clearAvatarVisual(node);node.classList.add("has-media");const img=document.createElement("img");img.className="avatar-content";img.src=entry.url;img.alt="";img.decoding="async";img.loading="eager";try{img.fetchPriority="high"}catch{}applyAvatarFrameElement(img,frameSource);img.onerror=()=>{if(node.dataset.avatarKey===key){node.classList.remove("has-media");setAvatarFallback(node,node.dataset.avatarName||"?")}};node.prepend(img)}
function avatarFrameValues(src={}){
  const zoom=Math.max(0.5,Math.min(4,Number(src?.avatar_zoom??1)||1));
  const x=Math.max(-100,Math.min(100,Number(src?.avatar_x??0)||0));
  const y=Math.max(-100,Math.min(100,Number(src?.avatar_y??0)||0));
  return {zoom,x,y};
}
function applyAvatarFrameElement(el,src={}){
  const f=avatarFrameValues(src);
  el.style.transform=`translate(${f.x}%, ${f.y}%) scale(${f.zoom})`;
  el.style.transformOrigin='center center';
}
function setAvatar(node,mediaId,name="?",frameSource={}){
  if(!node)return;const key=avatarCacheKey(mediaId);node.dataset.avatarKey=key;node.dataset.avatarName=safeText(name);node.classList.toggle('has-media',Boolean(mediaId&&state.uploadToken));
  if(!mediaId||!state.uploadToken){node.classList.remove('has-media');setAvatarFallback(node,name);return}
  const cached=avatarMediaCache.get(key);if(cached?.url){applyAvatarCached(node,cached,frameSource,key);return}
  setAvatarFallback(node,name);loadAvatarMedia(mediaId).then(entry=>applyAvatarCached(node,entry,frameSource,key)).catch(()=>{if(node.dataset.avatarKey===key){node.classList.remove('has-media');setAvatarFallback(node,name)}})
}
async function setProfileAvatarViewer(node,mediaId,name="?",frameSource={}){
  if(!node)return;
  node.replaceChildren();node.classList.toggle('has-media',Boolean(mediaId&&state.uploadToken));
  if(!mediaId||!state.uploadToken){const span=document.createElement("span");span.textContent=initials(name);node.appendChild(span);return;}
  try{
    const entry=await loadAvatarMedia(mediaId);
    if(!entry)throw new Error('avatar indisponível');
    const blob=entry.blob;
    if((entry.mime||blob.type||'').toLowerCase()==='image/gif'){
      const img=document.createElement('img');img.src=entry.url;img.alt='';img.className='profile-avatar-viewer-gif';applyAvatarFrameElement(img,frameSource);img.onerror=()=>setAvatar(node,mediaId,name,frameSource);node.appendChild(img);return;
    }
    if(entry.previewUrl){const img=document.createElement('img');img.src=entry.previewUrl;img.alt='';img.className='profile-avatar-viewer-canvas';applyAvatarFrameElement(img,frameSource);node.appendChild(img);return;}
    const bmp=await createImageBitmap(blob);
    const src=document.createElement('canvas');src.width=bmp.width;src.height=bmp.height;
    const sctx=src.getContext('2d',{willReadFrequently:true});sctx.drawImage(bmp,0,0);
    const data=sctx.getImageData(0,0,src.width,src.height).data;
    let minX=src.width,minY=src.height,maxX=-1,maxY=-1;
    for(let y=0;y<src.height;y++){for(let x=0;x<src.width;x++){const a=data[(y*src.width+x)*4+3];if(a>12){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}}}
    if(maxX<minX||maxY<minY)throw new Error('avatar vazio');
    const bw=maxX-minX+1,bh=maxY-minY+1;
    const out=document.createElement('canvas');out.width=256;out.height=256;out.className='profile-avatar-viewer-canvas';
    const ctx=out.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    const scale=Math.max(out.width/bw,out.height/bh);
    const dw=bw*scale,dh=bh*scale,dx=(out.width-dw)/2,dy=(out.height-dh)/2;
    ctx.drawImage(src,minX,minY,bw,bh,dx,dy,dw,dh);
    try{const previewBlob=await new Promise(r=>out.toBlob(r,'image/png',0.92));if(previewBlob){entry.previewUrl=URL.createObjectURL(previewBlob);const img=document.createElement('img');img.src=entry.previewUrl;img.alt='';img.className='profile-avatar-viewer-canvas';applyAvatarFrameElement(img,frameSource);try{bmp.close?.()}catch{}node.appendChild(img);return;}}catch{}
    applyAvatarFrameElement(out,frameSource);
    try{bmp.close?.()}catch{}
    node.appendChild(out);
  }catch(err){console.warn('Falha ao renderizar preview do avatar',err);setAvatar(node,mediaId,name,frameSource)}
}
function signalingHostname(){try{return new URL(settings.signalingUrl).hostname}catch{return ""}}
function deriveStun(){const host=signalingHostname();if(!host)return "";const port=Number(state.rtcConfig?.turn_port||3478)||3478;return `stun:${host}:${port}`}
function automaticTurnConfig(){
  const cfg=state.rtcConfig||{};if(!cfg.turn_enabled||!cfg.turn_username||!cfg.turn_password)return null;
  const host=signalingHostname();if(!host)return null;const port=Number(cfg.turn_port||3478)||3478;
  return {urls:[`turn:${host}:${port}?transport=udp`,`turn:${host}:${port}?transport=tcp`],username:safeText(cfg.turn_username),credential:safeText(cfg.turn_password)};
}
function iceServers(){
  const out=[];const stun=settings.stunUrl.trim()||DEFAULT_STUN_URL;if(stun)out.push({urls:stun});
  if(settings.turnUrl.trim()){const x={urls:settings.turnUrl.trim()};if(settings.turnUsername)x.username=settings.turnUsername;if(settings.turnPassword)x.credential=settings.turnPassword;out.push(x)}
  else{const auto=automaticTurnConfig();if(auto)out.push(auto)}
  return out;
}
function currentGuild(){return state.guilds.find(g=>Number(g.id)===Number(state.guildId))||null}
function currentChannel(){return state.structure.channels.find(c=>Number(c.id)===Number(state.channelId))||null}
function hasPerm(p){return state.permissions.has(p)}
function currentTextChannel(){const ch=state.structure?.channels?.find(c=>Number(c.id)===Number(state.channelId));return ch?.type==="text"?ch:null}
function canWriteReadOnlyChannel(ch=currentTextChannel()){if(!ch?.read_only)return true;return hasPerm("manage_server")||hasPerm("manage_channels")}
function serverSupportsReadOnlyChannels(){return state.features?.read_only_channels===true||versionAtLeast(state.serverVersion,"0.6.7")}
function updateChannelComposerAccess(){
  const ch=currentTextChannel();const blocked=Boolean(ch?.read_only&&!canWriteReadOnlyChannel(ch));
  els.chatInput.disabled=blocked;els.sendButton.disabled=blocked;els.attachButton.disabled=blocked;els.screenshotButton.disabled=blocked;els.emojiButton.disabled=blocked;els.gifButton.disabled=blocked;
  els.chatForm.closest(".composer-shell")?.classList.toggle("read-only",blocked);
  if(blocked){els.chatInput.placeholder="Somente leitura · apenas administradores podem escrever";els.composeHint.textContent="🔒 Canal somente leitura · apenas administradores podem enviar mensagens";cancelReply()}
  else if(ch){els.chatInput.placeholder=`Mensagem em #${ch.name}`;els.composeHint.textContent="Enter envia · Shift+Enter quebra linha"}
}
function currentPresenceByUser(uid){return state.presence.find(u=>Number(u.user_id)===Number(uid))||null}
function currentPresenceByClient(cid){return state.presence.find(u=>u.client_id===cid)||null}

function send(payload,{silent=false}={}){if(!state.ws||state.ws.readyState!==WebSocket.OPEN){if(!silent)toast("Servidor desconectado.","error");return false}if(state.ws.bufferedAmount>1024*1024){if(!silent)toast("Conexão congestionada. Tente novamente.","error");return false}try{state.ws.send(JSON.stringify(payload));return true}catch(e){console.warn("Falha no envio",e);if(!silent)toast("Falha ao enviar ao servidor.","error");return false}}
function setConnection(text,online=false){els.connectionStatus.textContent=text;els.connectionStatus.style.color=online?"#55dca8":""}
function versionAtLeast(current,minimum){
  const a=String(current||"").split(".").map(x=>Number.parseInt(x,10)||0);
  const b=String(minimum||"").split(".").map(x=>Number.parseInt(x,10)||0);
  for(let i=0;i<Math.max(a.length,b.length);i++){const av=a[i]||0,bv=b[i]||0;if(av>bv)return true;if(av<bv)return false}
  return true;
}
function serverSupportsCategoryDelete(){return state.features?.category_delete===true||versionAtLeast(state.serverVersion,"0.6.5")}
function serverSupportsGuildLeaveDelete(){return state.features?.guild_leave_delete===true||versionAtLeast(state.serverVersion,"0.7.1")}
function authToken(){return authTokenForUrl(settings.signalingUrl,{migrateLegacy:true})}
function requireAuthDialog(){updateAuthConnectionUi();if(!els.authDialog.open)els.authDialog.showModal()}

function connect(){
  clearTimeout(state.reconnectTimer);state.reconnectTimer=null;
  if(state.ws&&[WebSocket.OPEN,WebSocket.CONNECTING].includes(state.ws.readyState))return;
  setConnection("conectando…");
  let ws;try{ws=new WebSocket(settings.signalingUrl)}catch(e){toast("URL de signaling inválida.","error");return}
  state.ws=ws;state.manualDisconnect=false;
  ws.onopen=()=>{state.reconnectAttempt=0;setConnection("registrando…")};
  ws.onmessage=async ev=>{let m;try{m=JSON.parse(ev.data)}catch{return}try{await handleMessage(m)}catch(err){console.error(err);toast(`Erro: ${err.message||err}`,"error")}};
  ws.onerror=()=>setConnection("erro de conexão");
  ws.onclose=()=>{if(state.ws===ws)state.ws=null;state.connected=false;state.authenticated=false;state.clientId=null;setConnection("desconectado");cleanupVoice(false);cleanupScreen(false);if(!state.manualDisconnect)scheduleReconnect()};
}
function scheduleReconnect(){if(state.reconnectTimer)return;const delay=Math.min(12000,900*Math.pow(1.65,state.reconnectAttempt++));state.reconnectTimer=setTimeout(()=>{state.reconnectTimer=null;connect()},delay);setConnection(`reconectando em ${(delay/1000).toFixed(1)}s`)}
function disconnect(manual=true){state.manualDisconnect=manual;clearTimeout(state.reconnectTimer);if(state.ws){state.ws.onclose=null;try{state.ws.close()}catch{}}state.ws=null;state.connected=false;setConnection("desconectado")}

async function handleMessage(m){
  switch(m.type){
    case "connected": state.clientId=m.client_id;send({type:"hello",device_id:deviceId,device_name:window.openCallDesktop?"OpenCall Desktop":(navigator.platform||"OpenCall Web"),fingerprint,auth_token:authToken()});break;
    case "hello_ok": state.connected=true;state.serverVersion=m.server_version||"";state.uploadToken=m.upload_token||"";state.features=m.features||{};setConnection(`servidor ${state.serverVersion}`,true);break;
    case "auth_required": state.authenticated=false;requireAuthDialog();break;
    case "auth_ok": state.authenticated=true;state.rtcConfig=m.rtc_config||state.rtcConfig;state.profile=m.profile||state.profile;preloadAvatarMedia([state.profile]);if(m.auth_token)saveAuthTokenForUrl(settings.signalingUrl,m.auth_token);saveAccountForUrl(settings.signalingUrl,state.profile);if(els.authDialog.open)els.authDialog.close();updateSelfUI();send({type:"dm_list"});send({type:"friends_list"});if(state.pendingInvite){send({type:"invite_accept",code:state.pendingInvite});state.pendingInvite="";history.replaceState({},"",location.pathname);}maybeOpenTutorialAfterRegistration();break;
    case "auth_error": showAuthError(m.error);break;
    case "bootstrap": {const first=state.homeInitializedFor!==state.clientId;applyBootstrap(m);if(first){state.homeInitializedFor=state.clientId;openFriendsHome("all")}break;}
    case "structure_changed": send({type:"bootstrap",guild_id:state.guildId});break;
    case "category_deleted":
      toast(`Categoria “${m.name||"categoria"}” excluída${Number(m.channels_moved||0)?` · ${m.channels_moved} canal(is) movido(s) para OUTROS`:""}.`,"success",5000);
      send({type:"bootstrap",guild_id:state.guildId});
      break;
    case "guild_left":
      finishGuildAction(m);toast(`Você saiu de “${m.name||"servidor"}”.`,"success",5000);break;
    case "guild_deleted":
      finishGuildAction(m);toast(`Servidor “${m.name||"servidor"}” excluído.`,"success",5000);break;
    case "presence_update": if(Number(m.guild_id)===Number(state.guildId)){const old=state.presence;state.presence=m.users||[];preloadAvatarMedia(state.presence);notifyNewStreams(old,state.presence);renderMembers();renderChannels();renderCall();}break;
    case "chat_history": preloadAvatarMedia((m.messages||[]).map(x=>x.sender));state.messages.set(Number(m.channel_id),m.messages||[]);if(Number(m.channel_id)===Number(state.channelId))renderChat(true);break;
    case "chat_message": preloadAvatarMedia([m.sender]);receiveChatMessage(m);break;
    case "chat_updated": updateChatMessage(m.message);break;
    case "chat_typing": receiveTyping(m);break;
    case "chat_search_results": renderSearchResults(m.messages||[]);break;
    case "pins_result": renderPinnedResults(m.messages||[],m.channel_id);break;
    case "dm_list": state.dmThreads=m.threads||[];preloadAvatarMedia(state.dmThreads.flatMap(t=>t.members||[]));renderDmList();break;
    case "dm_opened": upsertDmThread(m.thread);openDm(m.thread.id);break;
    case "dm_history": preloadAvatarMedia((m.messages||[]).map(x=>x.sender));state.dmMessages.set(m.thread_id,m.messages||[]);if(state.dmThreadId===m.thread_id)renderDm(true);break;
    case "dm_message": preloadAvatarMedia([m.sender]);receiveDmMessage(m);break;
    case "friends_state": state.friends=m.friends||[];state.friendIncoming=m.incoming||[];state.friendOutgoing=m.outgoing||[];preloadAvatarMedia([...state.friends,...state.friendIncoming,...state.friendOutgoing]);renderFriends();renderFriendsHome();if(state.friendSearchResult){renderFriendSearchResult(state.friendSearchResult);renderFriendsHomeSearchResult(state.friendSearchResult)}renderDmList();break;
    case "friend_search_result": state.friendSearchResult=m.user||null;preloadAvatarMedia(m.user?[m.user]:[]);renderFriendSearchResult(m.user||null);renderFriendsHomeSearchResult(m.user||null);break;
    case "friends_changed": send({type:"friends_list"});break;
    case "friend_request_received": toast(`Pedido de amizade de ${publicUserId(m.user||{})}.`,"info",6000);send({type:"friends_list"});break;
    case "dm_call_invite": onDmCallInvite(m);break;
    case "dm_call_joined": await onDmCallJoined(m);break;
    case "dm_call_participant_joined": await onDmCallParticipantJoined(m);break;
    case "dm_call_participant_left": onDmCallParticipantLeft(m);break;
    case "dm_call_state": onDmCallState(m);break;
    case "dm_call_speaking": onDmCallSpeaking(m);break;
    case "dm_call_signal": if(m.thread_id===state.dmCallThreadId)await handleVoiceSignal(m.from_id,m.payload||{});break;
    case "dm_call_declined": toast(`${publicUserId(m.user||{})||"Usuário"} recusou a chamada.`,"info",4500);break;
    case "dm_call_ended": if(state.incomingDmCall?.thread?.id===m.thread_id){state.incomingDmCall=null;if(els.dmIncomingCallDialog.open)els.dmIncomingCallDialog.close();toast("A chamada foi encerrada.","info")}break;
    case "dm_call_left": if(m.thread_id===state.dmCallThreadId){cleanupVoice(false);if(state.dmThreadId===m.thread_id)openDm(m.thread_id)}break;
    case "voice_joined": await onVoiceJoined(m);break;
    case "voice_move_requested": if(Number(m.guild_id)===Number(state.guildId))openVoiceChannel(Number(m.channel_id));break;
    case "voice_participant_joined": await onVoiceParticipantJoined(m);break;
    case "voice_participant_left": onVoiceParticipantLeft(m);break;
    case "voice_state": onVoiceState(m);break;
    case "voice_speaking": onVoiceSpeaking(m);break;
    case "voice_signal": await handleVoiceSignal(m.from_id,m.payload||{});break;
    case "voice_left":
      // Ignora ACK atrasado de uma call anterior (importante ao trocar canal -> DM).
      if(state.voiceChannelId&&(!m.channel_id||Number(m.channel_id)===Number(state.voiceChannelId))){if(state.screenStream||state.screenSessionCode)stopScreenShare(true);if(state.viewingHostId||state.viewerPeer)closeScreenViewer(true);cleanupVoice(false);renderCall();renderChannels();}break;
    case "dm_screen_created": state.screenScope="dm";state.screenSessionCode=m.code;renderCall();updateFloatingStreamDock();toast("Sua tela está ao vivo na DM.","success");break;
    case "dm_screen_viewer_joined": if(state.screenStream&&m.thread_id===state.dmCallThreadId)await createScreenOffer(m.viewer_id);updateFloatingStreamDock();break;
    case "dm_screen_viewer_left": closeScreenHostPeer(m.viewer_id);updateFloatingStreamDock();break;
    case "dm_screen_join_approved": if(m.thread_id===state.dmCallThreadId){state.dmAvailableScreen={threadId:m.thread_id,hostId:m.host_id,code:m.code};state.screenScope="dm";state.viewingHostId=m.host_id;state.viewingSessionCode=m.code;ensureScreenViewerPeer(m.host_id);showPinnedScreen();renderCall();}break;
    case "dm_screen_signal": if(m.thread_id===state.dmCallThreadId)await handleScreenSignal(m.from_id,m.payload||{});break;
    case "dm_screen_left": closeScreenViewer(false);break;
    case "dm_screen_ended": if(m.code===state.dmAvailableScreen?.code)state.dmAvailableScreen=null;if(m.code===state.screenSessionCode)stopScreenShare(false);if(m.code===state.viewingSessionCode)closeScreenViewer(false);renderCall();break;
    case "session_created": state.screenScope="voice";state.screenSessionCode=m.code;renderCall();updateFloatingStreamDock();toast("Sua transmissão está ao vivo.","success");break;
    case "viewer_joined": if(state.screenStream)await createScreenOffer(m.viewer_id);updateFloatingStreamDock();break;
    case "viewer_left": closeScreenHostPeer(m.viewer_id);updateFloatingStreamDock();break;
    case "join_approved": state.viewingHostId=m.host_id;state.viewingSessionCode=m.code;ensureScreenViewerPeer(m.host_id);showPinnedScreen();break;
    case "signal": await handleScreenSignal(m.from_id,m.payload||{});break;
    case "left_session": closeScreenViewer();break;
    case "session_ended": if(m.code===state.screenSessionCode){stopScreenShare(false)}if(m.code===state.viewingSessionCode)closeScreenViewer();break;
    case "invite_created": els.inviteResult.textContent=`Código: ${m.code} · Link: ${location.origin}${location.pathname}?invite=${encodeURIComponent(m.code)} · válido ${m.hours?m.hours+"h":"sem expiração"}`;toast("Convite criado.","success");break;
    case "admin_stats": renderAdminStats(m.stats||{});renderAdminRoles(m.roles||[]);break;
    case "admin_log": renderAdminLog(m.entries||[]);break;
    case "profile_updated": toast("Perfil atualizado.","success");send({type:"bootstrap",guild_id:state.guildId});break;
    case "password_changed": toast("Senha alterada.","success");els.oldPassword.value="";els.newPassword.value="";break;
    case "moderation_event": toast(`Moderação: ${m.action}${m.reason?" · "+m.reason:""}`,"error",6500);send({type:"bootstrap",guild_id:state.guildId});break;
    case "error": handleServerError(m.error);document.getElementById("guildActionDialog")?.reportServerError?.(m.error);break;
    case "pong":break;
    default: console.debug("Mensagem não tratada",m);
  }
}

function showAuthError(e){const map={invalid_username:"Usuário: 3–32 caracteres, letras/números/._-",weak_password:"A senha precisa ter pelo menos 6 caracteres.",username_taken:"Esse usuário já existe.",bad_credentials:"Usuário ou senha incorretos."};els.authError.textContent=map[e]||safeText(e)}
function handleServerError(e){const map={forbidden:"Você não tem permissão para isso.",timed_out:"Você está em timeout neste servidor.",invalid_invite:"Convite inválido ou expirado.",banned:"Você foi banido deste servidor.",session_not_found:"A transmissão não está mais disponível.",chat_rate_limited:"Você está enviando mensagens rápido demais.",not_guild_member:"Você não participa deste servidor.",auth_required:"Faça login primeiro.",category_not_found:"Essa categoria não existe mais.",read_only_channel:"Este canal é somente leitura. Apenas administradores podem escrever.",dm_screen_busy:"Outra pessoa já está compartilhando a tela nesta DM.",guild_owner_must_delete:"O dono não pode sair do próprio servidor. Use Excluir servidor.",guild_not_found:"Esse servidor não existe mais.",guild_delete_forbidden:"Somente o dono pode excluir este servidor."};if(e==="dm_screen_busy"&&state.screenScope==="dm"&&state.screenStream)stopScreenShare(false);toast(map[e]||`Servidor: ${e}`,"error")}

function applyBootstrap(m){
  state.guilds=m.guilds||[];state.guildId=Number(m.current_guild_id||state.guilds[0]?.id||0)||null;state.structure=m.structure||{guild:null,categories:[],channels:[],roles:[]};state.profile=m.profile||state.profile;preloadAvatarMedia([state.profile]);state.unread=new Map(Object.entries(m.unread||{}).map(([k,v])=>[Number(k),Number(v)]));
  const g=currentGuild();state.permissions=new Set(g?.permissions||[]);els.guildName.textContent=state.structure.guild?.name||g?.name||"OpenCall";els.adminButton.classList.toggle("hidden",!hasPerm("view_admin"));
  if(!state.channelId||!state.structure.channels.some(c=>c.type==="text"&&Number(c.id)===Number(state.channelId))){state.channelId=Number(state.structure.channels.find(c=>c.type==="text")?.id||0)||null}
  renderGuildRail();renderChannels();renderMembers();updateSelfUI();fillSettingsUI();renderAdminStructure();send({type:"get_presence",guild_id:state.guildId});send({type:"dm_list"});send({type:"friends_list"});if(state.channelId)openTextChannel(state.channelId);else if(!state.guilds.length){els.viewTitle.textContent="Sem servidor";els.viewSubtitle.textContent="Entre por convite ou crie seu próprio servidor";els.welcomeTitle.textContent="Bem-vindo ao OpenCall";els.welcomeText.textContent="Use a seta ao lado do nome do servidor para entrar com um convite, ou o botão + para criar um servidor.";toast("Sua conta ainda não participa de nenhum servidor. Use um convite ou crie um servidor.","info",6000)}
}

function closeGuildContextMenu(){
  const menu=els.guildContextMenu;if(!menu)return;menu.classList.add("hidden");menu.setAttribute("aria-hidden","true");menu.replaceChildren()
}
function guildOwner(g){const owner=g?.owner_user_id??(Number(g?.id)===Number(state.guildId)?state.structure?.guild?.owner_user_id:null);return owner!=null?Number(owner)>0&&Number(owner)===Number(state.profile?.user_id):safeText(g?.role_name).toLowerCase()==="dono"}
function finishGuildAction(m){
  const id=Number(m.guild_id),dialog=document.getElementById("guildActionDialog");
  if(Number(dialog?.dataset.guildId)===id)dialog.close();
  closeGuildContextMenu();
  if(id===Number(state.guildId)&&!state.dmCallThreadId){cleanupVoice(false);cleanupScreen(false)}
  state.guilds=state.guilds.filter(g=>Number(g.id)!==id);renderGuildRail();
}
function guildContextAction(label,{danger=false,disabled=false,onClick}={}){const b=document.createElement("button");b.type="button";b.className=`guild-context-item${danger?" danger":""}`;b.textContent=label;b.disabled=disabled;b.onclick=()=>{closeGuildContextMenu();if(!disabled)onClick?.()};return b}
function toggleGuildMuted(g){const id=Number(g.id);if(state.mutedGuilds.has(id))state.mutedGuilds.delete(id);else state.mutedGuilds.add(id);localStorage.setItem("opencall-muted-guilds",JSON.stringify(Array.from(state.mutedGuilds)));renderGuildRail();toast(state.mutedGuilds.has(id)?`${g.name}: notificações silenciadas`:`${g.name}: notificações reativadas`)}
function leaveGuild(g){if(!serverSupportsGuildLeaveDelete()){toast(`Sair de servidores requer OpenCall Server 0.7.1+. Servidor atual: ${state.serverVersion||"antigo"}.`,"error",8000);return}if(guildOwner(g)){toast("O dono não pode sair do próprio servidor. Exclua o servidor ou transfira a propriedade em uma versão futura.","error",7000);return}openGuildActionDialog(g,false)}
function deleteGuild(g){if(!serverSupportsGuildLeaveDelete()){toast(`Excluir servidores requer OpenCall Server 0.7.1+. Servidor atual: ${state.serverVersion||"antigo"}.`,"error",8000);return}if(!guildOwner(g)){toast("Somente o dono pode excluir este servidor.","error");return}openGuildActionDialog(g,true)}
function openGuildActionDialog(g,deleting){
  document.getElementById("guildActionDialog")?.remove();
  const host=settings.signalingUrl,token=state.uploadToken,id=Number(g.id),name=safeText(g.name);
  const dialog=document.createElement("dialog");dialog.id="guildActionDialog";dialog.className="modal auth-modal";
  dialog.dataset.guildId=String(id);
  dialog.setAttribute("aria-labelledby","guildActionTitle");dialog.setAttribute("aria-describedby","guildActionDescription");
  dialog.innerHTML='<form class="modal-body form-grid"><h2 id="guildActionTitle"></h2><p id="guildActionDescription"></p><label>Digite o nome do servidor para confirmar<input autocomplete="off" spellcheck="false"></label><p class="form-error" role="alert"></p><div><button type="button">Cancelar</button> <button type="submit" class="danger-btn"></button></div></form>';
  const form=dialog.querySelector("form"),input=dialog.querySelector("input"),cancel=dialog.querySelector('[type="button"]'),submit=dialog.querySelector('[type="submit"]'),error=dialog.querySelector(".form-error");
  dialog.querySelector("h2").textContent=deleting?`Excluir “${name}”?`:`Sair de “${name}”?`;
  dialog.querySelector("p").textContent=deleting?"Esta ação é permanente e apaga canais, mensagens, cargos e convites para todos.":"Você precisará de um novo convite para entrar novamente.";
  dialog.querySelector("label").hidden=!deleting;input.disabled=!deleting;
  submit.textContent=deleting?"Excluir permanentemente":"Sair do servidor";
  submit.disabled=deleting;
  let pending=false,timer;
  dialog.reportServerError=code=>{
    if(!pending||!["guild_owner_must_delete","guild_not_found","guild_delete_forbidden","not_guild_member","forbidden"].includes(code))return;
    clearTimeout(timer);pending=false;input.disabled=!deleting;submit.disabled=deleting&&input.value!==name;
    submit.textContent=deleting?"Excluir permanentemente":"Sair do servidor";
    error.textContent=`O servidor recusou a operação (${code}).`;
  };
  input.oninput=()=>{submit.disabled=pending||(deleting&&input.value!==name);error.textContent=""};
  cancel.onclick=()=>dialog.close();dialog.onclose=()=>{clearTimeout(timer);dialog.remove()};
  form.onsubmit=e=>{
    e.preventDefault();
    if(pending)return;
    if(deleting&&input.value!==name)return;
    if(host!==settings.signalingUrl||token!==state.uploadToken){error.textContent="A conexão mudou. Feche esta janela e tente novamente.";return}
    if(send({type:deleting?"guild_delete":"guild_leave",guild_id:id})){
      pending=true;submit.disabled=true;input.disabled=true;submit.textContent="Aguardando servidor…";
      error.textContent="";
      timer=setTimeout(()=>{error.textContent="O servidor ainda não confirmou. Feche esta janela e reconecte para verificar o resultado antes de tentar novamente.";submit.textContent="Sem confirmação"},15000);
    }
    else error.textContent="Não foi possível enviar. Verifique a conexão e tente novamente.";
  };
  document.body.appendChild(dialog);dialog.showModal();cancel.focus();
}
function openGuildContextMenu(e,g){
  e.preventDefault();e.stopPropagation();closeGuildContextMenu();const menu=els.guildContextMenu;if(!menu)return;
  const title=document.createElement("div");title.className="guild-context-title";title.innerHTML=`<strong>${escapeHtml(g.name)}</strong><span>ID ${Number(g.id)}</span>`;menu.appendChild(title);
  menu.appendChild(guildContextAction(state.mutedGuilds.has(Number(g.id))?"Reativar notificações":"Silenciar servidor",{onClick:()=>toggleGuildMuted(g)}));
  if(Number(g.id)===Number(state.guildId)&&hasPerm("view_admin"))menu.appendChild(guildContextAction("Configurações do servidor",{onClick:()=>openAdmin()}));
  const sep=document.createElement("div");sep.className="guild-context-separator";menu.appendChild(sep);
  if(guildOwner(g))menu.appendChild(guildContextAction("Excluir servidor",{danger:true,onClick:()=>deleteGuild(g)}));
  else menu.appendChild(guildContextAction("Sair do servidor",{danger:true,onClick:()=>leaveGuild(g)}));
  document.body.appendChild(menu);menu.classList.remove("hidden");menu.setAttribute("aria-hidden","false");
  const r=menu.getBoundingClientRect(),pad=8;let left=Math.min(e.clientX,window.innerWidth-r.width-pad),top=Math.min(e.clientY,window.innerHeight-r.height-pad);left=Math.max(pad,left);top=Math.max(pad,top);menu.style.left=`${left}px`;menu.style.top=`${top}px`
}
function homeContextActive(){return state.currentView==="friends"||state.currentView==="dm"||(state.currentView==="call"&&Boolean(state.dmCallThreadId))}
function updateSidebarMode(){
  const home=homeContextActive();
  els.guildSidebarContent?.classList.toggle("hidden",home);
  els.homeSidebarContent?.classList.toggle("hidden",!home);
  els.guildMenuButton?.classList.toggle("hidden",home);
  els.homeButton?.classList.toggle("active",home);
  els.app?.classList.toggle("home-context",home);
  if(home)els.guildName.textContent="Mensagens diretas";
  else els.guildName.textContent=state.structure.guild?.name||currentGuild()?.name||"OpenCall";
}
function decorateCommunityRail(){
  for(const [i,button] of Array.from(els.guildRail.children).entries()){
    const guild=state.guilds[i];if(!guild?.icon_media_id)continue;
    const image=document.createElement('img');image.src=mediaUrl(guild.icon_media_id);image.alt=guild.name;image.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:inherit';button.replaceChildren(image);
  }
}
new MutationObserver(()=>{if(Array.from(els.guildRail.children).some((b,i)=>state.guilds[i]?.icon_media_id&&!b.querySelector('img')))decorateCommunityRail()}).observe(els.guildRail,{childList:true});
function selectGuild(id){
  closeGuildContextMenu();
  if(Number(id)===Number(state.guildId)){
    const channel=state.structure.channels.find(c=>c.type==="text"&&Number(c.id)===Number(state.channelId))||state.structure.channels.find(c=>c.type==="text");
    state.dmThreadId=null;switchView("chat");
    if(channel)openTextChannel(channel.id);
  }
  send({type:"guild_select",guild_id:id});
}
function renderGuildRail(){els.guildRail.replaceChildren();const home=homeContextActive();els.homeButton?.classList.toggle("active",home);for(const g of state.guilds){const b=document.createElement("button");b.className=`server-bubble ${!home&&Number(g.id)===Number(state.guildId)?"active":""}`;b.textContent=initials(g.name)+(state.mutedGuilds.has(Number(g.id))?"🔕":"");b.title=`${g.name}${state.mutedGuilds.has(Number(g.id))?" · notificações silenciadas":""}`;b.onclick=()=>selectGuild(g.id);b.oncontextmenu=e=>openGuildContextMenu(e,g);els.guildRail.appendChild(b)}}
function renderChannels(){
  els.channelTree.replaceChildren();const cats=state.structure.categories||[];const channels=state.structure.channels||[];
  for(const cat of cats){const section=document.createElement("section");section.className="category";const head=document.createElement("div");head.className="category-head";head.innerHTML=`<span>${escapeHtml(cat.name)}</span>${hasPerm("manage_channels")?"<button title='Criar canal'>＋</button>":""}`;if(hasPerm("manage_channels")){head.querySelector("button").onclick=()=>{els.newChannelCategory.value=cat.id;openAdmin("channels")}}section.appendChild(head);
    for(const ch of channels.filter(c=>Number(c.category_id)===Number(cat.id))){section.appendChild(channelButton(ch));if(ch.type==="voice"){const wrap=document.createElement("div");wrap.className="voice-users-inline";for(const u of state.presence.filter(u=>Number(u.voice?.channel_id)===Number(ch.id))){const r=document.createElement("div");r.className=`voice-user-inline ${u.voice?.speaking?"speaking":""}`;r.dataset.voiceClient=safeText(u.client_id||"");r.dataset.voiceUser=safeText(u.user_id||"");const a=document.createElement("span");a.className="avatar mini-avatar";setAvatar(a,u.avatar_media_id,u.display_name,u);const n=document.createElement("span");n.textContent=u.display_name;const flags=document.createElement("span");flags.className="voice-state-flags";flags.textContent=voiceStateIcons(u);flags.title=u.voice?.deafened?"Ensurdecido":u.voice?.muted?"Microfone mutado":"";const live=document.createElement("span");if(u.stream){live.className="live-tag";live.textContent="AO VIVO"}r.append(a,n,flags,live);r.onclick=()=>{openVoiceChannel(ch.id);if(u.stream&&u.client_id!==state.clientId)watchScreen(u.client_id)};wrap.appendChild(r)}section.appendChild(wrap)}}els.channelTree.appendChild(section)}
  const uncategorized=channels.filter(c=>!c.category_id);if(uncategorized.length){const s=document.createElement("section");s.className="category";s.innerHTML='<div class="category-head"><span>OUTROS</span></div>';uncategorized.forEach(c=>s.appendChild(channelButton(c)));els.channelTree.appendChild(s)}
}
function channelButton(ch){const b=document.createElement("button");b.className=`channel-row ${Number(ch.id)===Number(state.channelId)&&state.currentView!=="dm"?"active":""}`;const unread=state.unread.get(Number(ch.id))||0,muted=state.mutedChannels.has(Number(ch.id));b.innerHTML=`<span class="channel-icon">${ch.type==="voice"?"🔊":"#"}</span><span class="channel-name">${escapeHtml(ch.name)}</span>${ch.type==="text"&&ch.read_only?'<span class="read-only-badge" title="Somente leitura">🔒</span>':""}${muted?'<span title="Silenciado">🔕</span>':""}${unread?`<span class="unread-badge">${Math.min(99,unread)}</span>`:""}`;b.onclick=()=>ch.type==="voice"?openVoiceChannel(ch.id):openTextChannel(ch.id);b.oncontextmenu=e=>{e.preventDefault();const id=Number(ch.id);if(state.mutedChannels.has(id))state.mutedChannels.delete(id);else state.mutedChannels.add(id);localStorage.setItem("opencall-muted-channels",JSON.stringify(Array.from(state.mutedChannels)));renderChannels();toast(state.mutedChannels.has(id)?`#${ch.name} silenciado`:`#${ch.name} reativado`)};return b}

function renderMembers(){
  els.memberList.replaceChildren();els.memberCount.textContent=String(state.presence.length);const online=state.presence.filter(u=>u.status!=="offline"),offline=state.presence.filter(u=>u.status==="offline");
  for(const [label,list] of [[`ONLINE — ${online.length}`,online],[`OFFLINE — ${offline.length}`,offline]]){if(!list.length)continue;const h=document.createElement("div");h.className="member-group-label";h.textContent=label;els.memberList.appendChild(h);for(const u of list){const b=document.createElement("button");b.className=`member-row ${u.voice?.speaking?"speaking":""}`;b.dataset.voiceClient=safeText(u.client_id||"");b.dataset.voiceUser=safeText(u.user_id||"");const av=document.createElement("span");av.className="avatar member-avatar";setAvatar(av,u.avatar_media_id,u.display_name,u);const dot=document.createElement("i");dot.className=`presence-dot ${u.status}`;av.appendChild(dot);const cp=document.createElement("span");cp.className="member-copy";const st=u.custom_status||u.role_name||"Membro";cp.innerHTML=`<strong>${escapeHtml(u.display_name||u.username)}</strong><span>${escapeHtml(publicUserId(u))} · ${escapeHtml(st)}</span>`;const flags=document.createElement("span");flags.className="member-voice-state";flags.textContent=voiceStateIcons(u);const live=document.createElement("span");if(u.stream){live.className="member-live";live.textContent="AO VIVO"}b.append(av,cp,flags,live);b.onclick=()=>openUserDialog(u);els.memberList.appendChild(b)}}
}

function updateSelfUI(){const p=state.profile;if(!p){els.selfName.textContent="Sem conta";els.selfStatus.textContent="offline";return}els.selfName.textContent=p.display_name||p.username;els.selfStatus.textContent=`${publicUserId(p)} · ${p.custom_status||p.status||"online"}`;const presenceSelf=state.presence.find(u=>Number(u.user_id)===Number(p.user_id));const avatarSource=presenceSelf||p;setAvatar(els.selfAvatar,avatarSource.avatar_media_id||p.avatar_media_id,p.display_name||p.username,avatarSource);els.accountUsername.textContent=publicUserId(p);els.accountId.textContent=`@${p.username} · ID ${p.user_id}`}

const AVATAR_CROP_STAGE_SIZE=320;
const AVATAR_CROP_MASK_RATIO=0.76;
function avatarCropGeometry(){
  const c=state.avatarCrop;
  const stageSize=AVATAR_CROP_STAGE_SIZE;
  const maskSize=stageSize*AVATAR_CROP_MASK_RATIO;
  const scale=c.baseScale*c.zoom;
  return {stageSize,maskSize,scale,drawW:c.imgW*scale,drawH:c.imgH*scale};
}
function clampAvatarCrop(){
  const c=state.avatarCrop;if(!c.image||!c.imgW||!c.imgH)return;
  const g=avatarCropGeometry();
  // Crop livre: permite reposicionar a foto mesmo abaixo do zoom de "cobertura".
  // Mantemos apenas um limite generoso para a imagem não sumir totalmente do editor.
  const minVisible=Math.max(24,g.maskSize*0.12);
  const maxX=Math.max(g.maskSize/2,(g.drawW+g.maskSize)/2-minVisible);
  const maxY=Math.max(g.maskSize/2,(g.drawH+g.maskSize)/2-minVisible);
  c.x=Math.max(-maxX,Math.min(maxX,c.x));
  c.y=Math.max(-maxY,Math.min(maxY,c.y));
}
function renderAvatarCrop(){
  const c=state.avatarCrop;if(!c.image||!els.avatarCropCanvas)return;
  clampAvatarCrop();
  const g=avatarCropGeometry();
  const canvas=els.avatarCropCanvas;
  if(canvas.width!==AVATAR_CROP_STAGE_SIZE)canvas.width=AVATAR_CROP_STAGE_SIZE;
  if(canvas.height!==AVATAR_CROP_STAGE_SIZE)canvas.height=AVATAR_CROP_STAGE_SIZE;
  const ctx=canvas.getContext('2d');
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,AVATAR_CROP_STAGE_SIZE,AVATAR_CROP_STAGE_SIZE);
  ctx.fillStyle='#080c11';ctx.fillRect(0,0,AVATAR_CROP_STAGE_SIZE,AVATAR_CROP_STAGE_SIZE);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  const dx=AVATAR_CROP_STAGE_SIZE/2+c.x-g.drawW/2;
  const dy=AVATAR_CROP_STAGE_SIZE/2+c.y-g.drawH/2;
  try{ctx.drawImage(c.image,dx,dy,g.drawW,g.drawH)}catch(err){console.error('avatar draw failed',err);toast('Falha ao desenhar a prévia do avatar.','error')}
  els.avatarCropZoom.value=String(c.zoom);
}
function resetAvatarCrop(){
  const c=state.avatarCrop;if(!c.image)return;
  const maskSize=AVATAR_CROP_STAGE_SIZE*AVATAR_CROP_MASK_RATIO;
  c.baseScale=Math.max(maskSize/Math.max(1,c.imgW),maskSize/Math.max(1,c.imgH));
  c.zoom=0.90;c.x=0;c.y=0;
  els.avatarCropZoom.min='0.65';els.avatarCropZoom.max='4';els.avatarCropZoom.value='0.90';
  renderAvatarCrop();
}
function clearAvatarCrop(){
  const old=state.avatarCrop?.image;
  try{old?.close?.()}catch{}
  state.avatarCrop={file:null,dataUrl:"",image:null,imgW:0,imgH:0,baseScale:1,zoom:1,x:0,y:0,dragging:false,startX:0,startY:0,baseX:0,baseY:0};
  const canvas=els.avatarCropCanvas;
  if(canvas){canvas.width=AVATAR_CROP_STAGE_SIZE;canvas.height=AVATAR_CROP_STAGE_SIZE;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height)}
}
function closeAvatarCropper(){if(els.avatarCropDialog.open)els.avatarCropDialog.close();else clearAvatarCrop()}
async function decodeAvatarFile(file){
  if(typeof createImageBitmap==='function'){
    try{
      const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
      if(bitmap?.width&&bitmap?.height)return bitmap;
      try{bitmap?.close?.()}catch{}
    }catch(err){console.warn('createImageBitmap avatar fallback',err)}
  }
  const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(r.error||new Error('Falha ao ler a imagem.'));r.readAsDataURL(file)});
  const img=new Image();
  img.src=dataUrl;
  if(typeof img.decode==='function')await img.decode();else await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Não foi possível decodificar a imagem.'))});
  if(!img.naturalWidth||!img.naturalHeight)throw new Error('A imagem não possui dimensões válidas.');
  return img;
}
async function openAvatarCropper(file){
  if(!file)return;
  if(!safeText(file.type).startsWith('image/'))throw new Error('O arquivo escolhido não é uma imagem válida.');
  clearAvatarCrop();
  const decoded=await decodeAvatarFile(file);
  const w=Number(decoded.width||decoded.naturalWidth||0),h=Number(decoded.height||decoded.naturalHeight||0);
  if(!w||!h){try{decoded.close?.()}catch{};throw new Error('A imagem não possui dimensões válidas.');}
  state.avatarCrop.file=file;state.avatarCrop.image=decoded;state.avatarCrop.imgW=w;state.avatarCrop.imgH=h;
  els.avatarCropCanvas.width=AVATAR_CROP_STAGE_SIZE;els.avatarCropCanvas.height=AVATAR_CROP_STAGE_SIZE;
  resetAvatarCrop();
  els.avatarCropDialog.showModal();
  requestAnimationFrame(renderAvatarCrop);
}
async function applyAvatarCrop(){
  const c=state.avatarCrop;if(!c.file||!c.image)return;
  clampAvatarCrop();
  const g=avatarCropGeometry();
  const size=512;
  const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.clearRect(0,0,size,size);
  // Reproduz exatamente o enquadramento visto dentro do círculo no editor.
  const cropLeft=AVATAR_CROP_STAGE_SIZE/2-g.maskSize/2;
  const cropTop=AVATAR_CROP_STAGE_SIZE/2-g.maskSize/2;
  const dx=AVATAR_CROP_STAGE_SIZE/2+c.x-g.drawW/2;
  const dy=AVATAR_CROP_STAGE_SIZE/2+c.y-g.drawH/2;
  const outScale=size/g.maskSize;
  ctx.drawImage(c.image,(dx-cropLeft)*outScale,(dy-cropTop)*outScale,g.drawW*outScale,g.drawH*outScale);
  const blob=await new Promise(r=>canvas.toBlob(r,'image/png',0.95));
  if(!blob)throw new Error('Falha ao gerar o avatar.');
  const out=new File([blob],'avatar.png',{type:'image/png'});
  closeAvatarCropper();
  await uploadAvatar(out,false);
}

function renderAvatarFrameEditor(){
  const f=state.avatarFrame;if(!els.avatarFrameImage)return;
  els.avatarFrameImage.style.transform=`translate(${f.x}%, ${f.y}%) scale(${f.zoom})`;
  els.avatarFrameZoom.value=String(f.zoom);
}
function openAvatarFrameEditor(){
  const p=state.profile;if(!p?.avatar_media_id)return toast('Escolha uma foto de perfil primeiro.','error');
  const f=avatarFrameValues(p);state.avatarFrame={zoom:f.zoom,x:f.x,y:f.y,dragging:false,startX:0,startY:0,baseX:0,baseY:0};
  els.avatarFrameImage.src=mediaUrl(p.avatar_media_id);
  els.avatarFrameDialog.showModal();requestAnimationFrame(renderAvatarFrameEditor);
}
function resetAvatarFrameEditor(){state.avatarFrame.zoom=1;state.avatarFrame.x=0;state.avatarFrame.y=0;renderAvatarFrameEditor()}
function applyAvatarFrameEditor(){
  if(!state.profile)return;state.profile.avatar_zoom=state.avatarFrame.zoom;state.profile.avatar_x=state.avatarFrame.x;state.profile.avatar_y=state.avatarFrame.y;
  setProfileAvatarViewer(els.settingsAvatar,state.profile.avatar_media_id,state.profile.display_name,state.profile);
  setAvatar(els.selfAvatar,state.profile.avatar_media_id,state.profile.display_name,state.profile);
  saveProfile();els.avatarFrameDialog.close();
}

function updateNavigationChrome(){
  const home=homeContextActive();
  els.notificationButton?.classList.toggle("hidden",home);
  els.membersToggleButton?.classList.toggle("hidden",home);
  if(home)els.adminButton?.classList.add("hidden");else els.adminButton?.classList.toggle("hidden",!hasPerm("view_admin"));
  if(state.currentView==="friends"||state.currentView==="dm")els.pinsButton?.classList.add("hidden");
}
function switchView(name){closeEmojiPickers();if(name!=="dm")restoreCallUiHome();state.currentView=name;els.friendsView?.classList.toggle("hidden",name!=="friends");els.chatView.classList.toggle("hidden",name!=="chat");els.callView.classList.toggle("hidden",name!=="call");els.dmView.classList.toggle("hidden",name!=="dm");updateSidebarMode();updateNavigationChrome();updateDmCallToolbar();renderGuildRail();renderChannels();renderDmList();updateFloatingStreamDock()}
function openTextChannel(id){const ch=state.structure.channels.find(c=>Number(c.id)===Number(id));if(!ch||ch.type!=="text")return;state.channelId=Number(id);state.dmThreadId=null;switchView("chat");els.viewIcon.textContent="#";els.viewTitle.textContent=ch.name;els.viewSubtitle.textContent=(ch.topic||"Canal de texto")+(ch.read_only?" · 🔒 somente leitura":"");els.welcomeTitle.textContent=`Bem-vindo ao #${ch.name}`;els.welcomeText.textContent=ch.topic||"Este é o começo deste canal.";els.pinsButton.classList.remove("hidden");updateChannelComposerAccess();state.unread.set(Number(id),0);send({type:"channel_read",channel_id:id});send({type:"get_chat_history",channel_id:id,limit:120});renderChannels();renderChat(true)}
function openVoiceChannel(id,{autoJoin=true}={}){const ch=state.structure.channels.find(c=>Number(c.id)===Number(id));if(!ch||ch.type!=="voice")return;state.channelId=Number(id);switchView("call");els.viewIcon.textContent="🔊";els.viewTitle.textContent=ch.name;els.viewSubtitle.textContent=ch.topic||"Canal de voz WebRTC";els.pinsButton.classList.add("hidden");renderCall();if(autoJoin&&Number(state.voiceChannelId)!==Number(id)&&!state.voiceJoining){queueMicrotask(()=>joinVoice(Number(id)))}else if(!state.voiceChannelId)els.joinVoiceButton.textContent=`Entrar em ${ch.name}`}

// -----------------------------------------------------------------------------
// Chat persistente, respostas, reações, edição, exclusão, pins e busca
// -----------------------------------------------------------------------------
function receiveChatMessage(m){const cid=Number(m.channel_id);const list=state.messages.get(cid)||[];if(!list.some(x=>x.id===m.id)){list.push(m);state.messages.set(cid,list)}if(state.currentView==="chat"&&Number(state.channelId)===cid){renderChat(true);send({type:"channel_read",channel_id:cid})}else if(Number(m.sender?.user_id)!==Number(state.profile?.user_id)){state.unread.set(cid,(state.unread.get(cid)||0)+1);renderChannels()}notifyForMessage(m)}
function updateChatMessage(m){if(!m)return;const cid=Number(m.channel_id),list=state.messages.get(cid)||[];const i=list.findIndex(x=>x.id===m.id);if(i>=0)list[i]=m;else list.push(m);state.messages.set(cid,list);if(state.currentView==="chat"&&Number(state.channelId)===cid)renderChat(false)}
function renderChat(scroll=false){const list=state.messages.get(Number(state.channelId))||[];els.channelWelcome.classList.toggle("hidden",list.length>0);els.messageList.replaceChildren();for(const m of list)els.messageList.appendChild(messageNode(m));if(scroll)requestAnimationFrame(()=>els.messageScroller.scrollTop=els.messageScroller.scrollHeight)}
function linkifyMentions(text){const safe=escapeHtml(text);return safe.replace(/@([A-Za-z0-9_.-]+)/g,'<span class="mention">@$1</span>').replace(/\n/g,"<br>")}
function messageNode(m){const row=document.createElement("article");row.className="message";row.dataset.id=m.id;const av=document.createElement("span");av.className="avatar message-avatar";setAvatar(av,m.sender?.avatar_media_id,m.sender?.display_name||m.sender?.username,m.sender||{});const main=document.createElement("div");main.className="message-main";
  if(m.reply){const rp=document.createElement("div");rp.className="reply-preview";rp.textContent=`↪ ${m.reply.display_name}: ${m.reply.content?.slice(0,100)||"mensagem"}`;main.appendChild(rp)}
  const meta=document.createElement("div");meta.className="message-meta";meta.innerHTML=`<span class="message-author">${escapeHtml(m.sender?.display_name||m.sender?.username||"Usuário")}</span><span class="message-time">${formatTime(m.created_at)}</span>${m.edited_at?'<span class="message-edited">(editada)</span>':""}${m.pinned?'<span class="pinned-marker">📌 fixada</span>':""}`;main.appendChild(meta);
  const content=document.createElement("div");content.className="message-content";content.innerHTML=m.deleted?"<em>Mensagem removida</em>":linkifyMentions(m.content||"");main.appendChild(content);if(!m.deleted&&m.attachments?.length)main.appendChild(renderAttachments(m.attachments));if(m.reactions?.length){const rr=document.createElement("div");rr.className="reaction-row";for(const r of m.reactions){const b=document.createElement("button");const mine=(r.user_ids||[]).includes(Number(state.profile?.user_id));b.className=`reaction-pill ${mine?"mine":""}`;b.textContent=`${r.emoji} ${r.count}`;b.onclick=()=>send({type:"chat_react",message_id:m.id,emoji:r.emoji});rr.appendChild(b)}main.appendChild(rr)}
  if(!m.deleted){const act=document.createElement("div");act.className="message-actions";const buttons=[["☺","Reagir",()=>quickReaction(m)]];
  if(canWriteReadOnlyChannel())buttons.unshift(["↩","Responder",()=>setReply(m)]);
  if(hasPerm("pin"))buttons.push(["📌",m.pinned?"Desafixar":"Fixar",()=>send({type:"chat_pin",message_id:m.id})]);
  if(Number(m.sender?.user_id)===Number(state.profile?.user_id)&&canWriteReadOnlyChannel())buttons.push(["✎","Editar",()=>editMessage(m)]);if(Number(m.sender?.user_id)===Number(state.profile?.user_id)||hasPerm("delete_others_messages"))buttons.push(["🗑","Excluir",()=>send({type:"chat_delete",message_id:m.id})]);for(const [txt,title,fn] of buttons){const b=document.createElement("button");b.textContent=txt;b.title=title;b.onclick=fn;act.appendChild(b)}row.appendChild(act)}row.append(av,main);return row}
function openImageViewer(a){
  if(!a?.media_id||!els.imageViewerDialog||!els.imageViewerImage)return;
  const src=mediaUrl(a.media_id);if(!src)return;
  els.imageViewerTitle.textContent=a.name||"Imagem";
  els.imageViewerMeta.textContent=[a.mime_type||"imagem",a.size?formatBytes(a.size):""].filter(Boolean).join(" · ");
  els.imageViewerDownload.href="#";
  els.imageViewerDownload.download="";
  els.imageViewerDownload.onclick=e=>{e.preventDefault();e.stopPropagation();downloadAttachment(a)};
  els.imageViewerImage.alt=a.name||"imagem";
  els.imageViewerImage.src=src;
  els.imageViewerImage.onload=()=>{const w=els.imageViewerImage.naturalWidth,h=els.imageViewerImage.naturalHeight;if(w&&h){const base=[a.mime_type||"imagem",a.size?formatBytes(a.size):""].filter(Boolean);base.push(`${w}×${h}`);els.imageViewerMeta.textContent=base.join(" · ")}};
  if(!els.imageViewerDialog.open)els.imageViewerDialog.showModal();
}
function closeImageViewer(){if(!els.imageViewerDialog)return;if(els.imageViewerDialog.open)els.imageViewerDialog.close();if(els.imageViewerImage){els.imageViewerImage.onload=null;els.imageViewerImage.removeAttribute("src")}}
function isVideoAttachment(a){const mime=safeText(a?.mime_type).toLowerCase();if(mime.startsWith("video/"))return true;const name=safeText(a?.name).toLowerCase();return /\.(mp4|webm|ogv|ogg|mov|m4v|mkv)$/i.test(name)}
function formatDuration(sec){sec=Number(sec);if(!Number.isFinite(sec)||sec<0)return "";const s=Math.floor(sec%60),m=Math.floor(sec/60)%60,h=Math.floor(sec/3600);return h?`${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${m}:${String(s).padStart(2,"0")}`}
function openVideoViewer(a){
  if(!a?.media_id||!els.videoViewerDialog||!els.videoViewerVideo)return;
  const src=mediaUrl(a.media_id);if(!src)return;
  closeImageViewer();
  els.videoViewerTitle.textContent=a.name||"Vídeo";
  const base=[a.mime_type||"vídeo",a.size?formatBytes(a.size):""].filter(Boolean);
  els.videoViewerMeta.textContent=base.join(" · ");
  els.videoViewerDownload.onclick=e=>{e.preventDefault();e.stopPropagation();downloadAttachment(a)};
  const v=els.videoViewerVideo;
  v.pause();v.removeAttribute("src");v.load();
  v.onloadedmetadata=()=>{const details=[...base];if(v.videoWidth&&v.videoHeight)details.push(`${v.videoWidth}×${v.videoHeight}`);const d=formatDuration(v.duration);if(d)details.push(d);els.videoViewerMeta.textContent=details.join(" · ")};
  v.onerror=()=>{const err=v.error;console.warn("video viewer",err);toast("Não foi possível reproduzir esse formato de vídeo no Chromium. Você ainda pode baixá-lo.","error",5000)};
  v.src=src;v.load();
  if(!els.videoViewerDialog.open)els.videoViewerDialog.showModal();
}
function closeVideoViewer(){if(!els.videoViewerDialog)return;const v=els.videoViewerVideo;if(v){v.pause();v.onloadedmetadata=null;v.onerror=null;v.removeAttribute("src");v.load()}if(els.videoViewerDialog.open)els.videoViewerDialog.close()}
async function downloadAttachment(a){
  const url=mediaUrl(a?.media_id,true);if(!url)return;
  try{
    if(window.openCallDesktop?.downloadFile){
      await window.openCallDesktop.downloadFile(url,a?.name||"arquivo");
      toast(`Download iniciado: ${a?.name||"arquivo"}`,"success",2500);
      return;
    }
    // Fallback web: cria um link efêmero; no Electron nunca passa por aqui.
    const link=document.createElement("a");link.href=url;link.download=a?.name||"arquivo";link.rel="noopener";link.style.display="none";document.body.appendChild(link);link.click();link.remove();
  }catch(err){console.error("download attachment:",err);toast(`Falha ao baixar ${a?.name||"arquivo"}: ${err.message||err}`,"error",5000)}
}
function renderAttachments(atts){
  const wrap=document.createElement("div");wrap.className="message-attachments";
  for(const a of atts){
    if(a.kind==="image"||safeText(a.mime_type).startsWith("image/")){
      const img=document.createElement("img");img.className="message-image";img.src=mediaUrl(a.media_id);img.alt=a.name||"imagem";img.loading="lazy";img.tabIndex=0;img.setAttribute("role","button");img.setAttribute("aria-label",`Abrir ${a.name||"imagem"} no OpenCall`);img.onclick=()=>openImageViewer(a);img.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openImageViewer(a)}};wrap.appendChild(img);continue;
    }
    if(isVideoAttachment(a)){
      const card=document.createElement("button");card.type="button";card.className="file-card video-file-card";card.innerHTML=`<span class="video-play-glyph">▶</span><span class="file-copy"><strong>${escapeHtml(a.name||"Vídeo")}</strong><span>${formatBytes(a.size)} · ${escapeHtml(a.mime_type||"vídeo")} · reproduzir no OpenCall</span></span><span>↗</span>`;card.onclick=e=>{e.preventDefault();e.stopPropagation();openVideoViewer(a)};wrap.appendChild(card);continue;
    }
    const link=document.createElement("button");link.type="button";link.className="file-card";link.innerHTML=`<span class="file-icon">${fileGlyph(a.name)}</span><span class="file-copy"><strong>${escapeHtml(a.name)}</strong><span>${formatBytes(a.size)} · ${escapeHtml(a.mime_type||"arquivo")}</span></span><span>↓</span>`;link.onclick=e=>{e.preventDefault();e.stopPropagation();downloadAttachment(a)};wrap.appendChild(link);
  }
  return wrap
}
function fileGlyph(name){const ext=safeText(name).split(".").pop().toUpperCase().slice(0,4);return ext&&ext!==safeText(name).toUpperCase()?ext:"FILE"}
function setReply(m){state.replyTo=m;els.replyText.textContent=`Respondendo a ${m.sender?.display_name||m.sender?.username}: ${(m.content||"arquivo").slice(0,120)}`;els.replyBar.classList.remove("hidden");els.chatInput.focus()}
function cancelReply(){state.replyTo=null;els.replyBar.classList.add("hidden")}
function quickReaction(m){const e=prompt("Emoji para reagir:","👍");if(e)send({type:"chat_react",message_id:m.id,emoji:e.trim().slice(0,16)})}
function editableAttachmentRecord(a){return {...a,_editKey:randomId(10)}}
function cleanEditableAttachment(a){return {media_id:a.media_id,name:a.name,mime_type:a.mime_type,size:a.size,kind:a.kind}}
function editAttachmentSupported(){return Boolean(state.features?.message_attachment_edit)}
function renderEditMessageAttachments(){
  if(!els.editMessageAttachments)return;
  els.editMessageAttachments.replaceChildren();
  const supported=editAttachmentSupported();
  const pendingAdds=state.editPendingFiles.filter(x=>!x.replaceKey&&!x.cancelled).length;
  const total=state.editingAttachments.length+pendingAdds;
  els.editMessageAttachButton.disabled=!supported||total>=4;
  els.editMessageAttachmentHint.textContent=supported
    ?`Até 4 anexos. Você pode manter, remover ou trocar um arquivo antes de salvar. (${total}/4)`
    :"Este servidor permite editar apenas o texto. Atualize para o servidor OpenCall 0.6.8 para trocar ou remover anexos.";
  for(const a of state.editingAttachments){
    const card=document.createElement("div");card.className="edit-attachment-card";
    const copy=document.createElement("div");copy.className="edit-attachment-copy";copy.innerHTML=`<strong>${escapeHtml(a.name||"arquivo")}</strong><span>${formatBytes(a.size||0)} · ${escapeHtml(a.mime_type||"arquivo")}</span>`;
    const actions=document.createElement("div");actions.className="edit-attachment-actions";
    const replace=document.createElement("button");replace.type="button";replace.textContent="Trocar";replace.disabled=!supported;replace.onclick=()=>{state.editReplaceKey=a._editKey;els.editMessageFilePicker.multiple=false;els.editMessageFilePicker.value="";els.editMessageFilePicker.click()};
    const remove=document.createElement("button");remove.type="button";remove.textContent="Remover";remove.className="danger";remove.disabled=!supported;remove.onclick=()=>{for(const item of state.editPendingFiles){if(item.replaceKey===a._editKey)item.cancelled=true}state.editingAttachments=state.editingAttachments.filter(x=>x._editKey!==a._editKey);state.editAttachmentsDirty=true;renderEditMessageAttachments()};
    actions.append(replace,remove);card.append(copy,actions);els.editMessageAttachments.appendChild(card);
  }
  for(const item of state.editPendingFiles){
    if(item.cancelled)continue;
    const card=document.createElement("div");card.className="edit-attachment-card pending";
    const copy=document.createElement("div");copy.className="edit-attachment-copy";let status=item.status==="done"?"Pronto":item.status==="error"?`Erro: ${item.error||"falha"}`:item.status==="paused"?"Pausado":`${item.progress||0}%`;const replacing=item.replaceKey?"Substituindo anexo":"Novo anexo";copy.innerHTML=`<strong>${escapeHtml(item.file.name)}</strong><span>${replacing} · ${formatBytes(item.file.size)} · ${escapeHtml(status)}</span><div class="upload-progress"><i style="width:${item.progress||0}%"></i></div>`;
    const actions=document.createElement("div");actions.className="edit-attachment-actions";
    if(!["done","error"].includes(item.status)){const pause=document.createElement("button");pause.type="button";pause.textContent=item.paused?"▶":"Ⅱ";pause.title=item.paused?"Retomar":"Pausar";pause.onclick=()=>{item.paused=!item.paused;renderEditMessageAttachments()};actions.appendChild(pause)}
    const cancel=document.createElement("button");cancel.type="button";cancel.textContent="×";cancel.className="danger";cancel.title="Cancelar upload";cancel.onclick=()=>{item.cancelled=true;state.editPendingFiles=state.editPendingFiles.filter(x=>x!==item);renderEditMessageAttachments()};actions.appendChild(cancel);
    card.append(copy,actions);els.editMessageAttachments.appendChild(card);
  }
}
async function queueEditFiles(files,replaceKey=null){
  if(!editAttachmentSupported()){toast("O servidor precisa ser atualizado para 0.6.8 para editar anexos.","error");return}
  const input=Array.from(files||[]);if(!input.length)return;
  const pendingAdds=state.editPendingFiles.filter(x=>!x.replaceKey&&!x.cancelled).length;
  const slots=Math.max(0,4-state.editingAttachments.length-pendingAdds);
  const chosen=replaceKey?input.slice(0,1):input.slice(0,slots);
  if(!replaceKey&&input.length>slots)toast("Uma mensagem aceita no máximo 4 anexos.","error");
  for(const file of chosen){
    if(file.size>10*1024*1024*1024){toast(`${file.name}: máximo 10 GB.`,"error");continue}
    const item={id:randomId(6),file,status:"queued",progress:0,record:null,error:"",paused:false,cancelled:false,startAt:performance.now(),lastAt:performance.now(),lastBytes:0,speed:0,eta:0,replaceKey};
    state.editPendingFiles.push(item);renderEditMessageAttachments();
    uploadQueuedItem(item,renderEditMessageAttachments).then(()=>{
      if(item.status==="done"&&item.record&&!item.cancelled){
        const rec=editableAttachmentRecord(item.record);
        if(item.replaceKey){const i=state.editingAttachments.findIndex(a=>a._editKey===item.replaceKey);if(i>=0){state.editingAttachments[i]=rec;state.editAttachmentsDirty=true}}
        else if(state.editingAttachments.length<4){state.editingAttachments.push(rec);state.editAttachmentsDirty=true}
      }
      state.editPendingFiles=state.editPendingFiles.filter(x=>x!==item);renderEditMessageAttachments();
    })
  }
}
function resetEditMessageState(){for(const item of state.editPendingFiles)item.cancelled=true;state.editingMessage=null;state.editingAttachments=[];state.editPendingFiles=[];state.editReplaceKey=null;state.editAttachmentsDirty=false;if(els.editMessageFilePicker){els.editMessageFilePicker.value="";els.editMessageFilePicker.multiple=true}}
function editMessage(m){
  if(!m||m.deleted)return;if(!canWriteReadOnlyChannel()){toast("Este canal é somente leitura.","error");return}
  state.editingMessage=m;state.editingAttachments=(m.attachments||[]).slice(0,4).map(editableAttachmentRecord);state.editPendingFiles=[];state.editReplaceKey=null;state.editAttachmentsDirty=false;els.editMessageInput.value=m.content||"";els.editMessageCounter.textContent=`${els.editMessageInput.value.length}/4000`;renderEditMessageAttachments();
  if(!els.editMessageDialog.open)els.editMessageDialog.showModal();requestAnimationFrame(()=>{els.editMessageInput.focus();els.editMessageInput.setSelectionRange(els.editMessageInput.value.length,els.editMessageInput.value.length)})
}
function closeEditMessage(){if(els.editMessageDialog.open)els.editMessageDialog.close();else resetEditMessageState()}
function submitEditMessage(){
  const m=state.editingMessage;if(!m)return;
  const content=els.editMessageInput.value.trim();
  if(state.editPendingFiles.some(x=>!["done","error"].includes(x.status)&&!x.cancelled)){toast("Aguarde os anexos terminarem de enviar.","error");return}
  const attachments=state.editingAttachments.map(cleanEditableAttachment);
  if(!content&&!attachments.length){toast("A mensagem não pode ficar vazia.","error");return}
  const payload={type:"chat_edit",message_id:m.id,content};if(editAttachmentSupported()&&state.editAttachmentsDirty)payload.attachments=attachments;send(payload);closeEditMessage()
}
function submitChat(){if(!canWriteReadOnlyChannel()){toast("Este canal é somente leitura. Apenas administradores podem enviar mensagens.","error");return}const content=els.chatInput.value.trim();if(!content&&!state.pendingFiles.length)return;if(!state.channelId)return;const ready=state.pendingFiles.filter(x=>x.status==="done"&&x.record).map(x=>x.record);const uploading=state.pendingFiles.some(x=>x.status!=="done");if(uploading){toast("Conclua ou remova os anexos pendentes.","error");return}if(!send({type:"chat_send",channel_id:state.channelId,content,attachments:ready,reply_to:state.replyTo?.id||""}))return;els.chatInput.value="";state.pendingFiles=[];renderUploadTray();cancelReply();autoResize(els.chatInput);updateCounter()}
function sendTyping(active){if(!state.channelId||state.currentView!=="chat"||!canWriteReadOnlyChannel())return;send({type:"chat_typing",channel_id:state.channelId,active},{silent:true})}
function receiveTyping(m){const cid=Number(m.channel_id);if(!state.typing.has(cid))state.typing.set(cid,new Map());const map=state.typing.get(cid);const uid=Number(m.sender?.user_id);if(m.active){map.set(uid,{name:m.sender?.display_name||"alguém",ts:Date.now()});setTimeout(()=>{if(Date.now()-(map.get(uid)?.ts||0)>4000){map.delete(uid);renderTyping()}},4500)}else map.delete(uid);renderTyping()}
function renderTyping(){const map=state.typing.get(Number(state.channelId));if(!map||!map.size){els.typingText.textContent="";return}const names=Array.from(map.values()).map(x=>x.name);els.typingText.textContent=names.length===1?`${names[0]} está digitando…`:`${names.slice(0,2).join(" e ")} estão digitando…`}

function openSearch(){if(!state.channelId)return;els.searchInput.value="";els.searchResults.replaceChildren();els.searchDialog.showModal();els.searchInput.focus()}
function showPins(){if(!state.channelId)return;const ch=currentTextChannel();els.pinsTitle.textContent=ch?`#${ch.name}`:"Canal atual";els.pinsList.replaceChildren();const loading=document.createElement("div");loading.className="pins-empty";loading.textContent="Carregando mensagens fixadas…";els.pinsList.appendChild(loading);if(!els.pinsDialog.open)els.pinsDialog.showModal();send({type:"get_pins",channel_id:state.channelId})}
function renderPinnedResults(msgs,channelId=null){
  if(channelId&&Number(channelId)!==Number(state.channelId))return;els.pinsList.replaceChildren();
  if(!msgs.length){const empty=document.createElement("div");empty.className="pins-empty";empty.textContent="Nenhuma mensagem fixada neste canal.";els.pinsList.appendChild(empty);return}
  for(const m of msgs){const node=messageNode(m);node.classList.add("pinned-result-message");els.pinsList.appendChild(node)}
}
function renderSearchResults(msgs){els.searchResults.replaceChildren();for(const m of msgs){const d=document.createElement("div");d.className="search-result";d.innerHTML=`<strong>${escapeHtml(m.sender?.display_name||m.sender?.username)} · ${formatTime(m.created_at)}</strong><p>${escapeHtml(m.content||"[anexo]")}</p>`;d.onclick=()=>{els.searchDialog.close();const target=els.messageList.querySelector(`[data-id="${CSS.escape(m.id)}"]`);target?.scrollIntoView({behavior:"smooth",block:"center"})};els.searchResults.appendChild(d)}}

// -----------------------------------------------------------------------------
// Upload de mídia/arquivos com progresso e retomada por chunks
// -----------------------------------------------------------------------------
function attachmentKind(file){return file.type.startsWith("image/")&&file.size<=8*1024*1024?"image":"file"}
async function queueFiles(files){if(state.currentView==="chat"&&!canWriteReadOnlyChannel()){toast("Este canal é somente leitura. Apenas administradores podem anexar arquivos.","error");return}for(const file of Array.from(files||[]).slice(0,Math.max(0,4-state.pendingFiles.length))){if(file.size>10*1024*1024*1024){toast(`${file.name}: máximo 10 GB.`,"error");continue}const item={id:randomId(6),file,status:"queued",progress:0,record:null,error:"",paused:false,cancelled:false,startAt:performance.now(),lastAt:performance.now(),lastBytes:0,speed:0,eta:0};state.pendingFiles.push(item);renderUploadTray();uploadQueuedItem(item)}renderUploadTray()}
let attachmentUploadTail=Promise.resolve();
function uploadQueuedItem(item,renderFn=renderUploadTray){
  const base=serverHttpBase(),token=state.uploadToken;
  // ponytail: um anexo por vez; paralelizar só com orçamento de banda medido.
  const run=async()=>{try{
    while(item.paused&&!item.cancelled)await new Promise(r=>setTimeout(r,250));
    if(item.cancelled)return;
    if(base!==serverHttpBase()||token!==state.uploadToken)throw new Error("Conexão mudou; envie o anexo novamente.");
    item.status="uploading";renderFn();
    item.record=attachmentKind(item.file)==="image"?await uploadImage(item):await uploadLargeFile(item,renderFn);
    if(item.cancelled)return;
    item.status="done";item.progress=100;
  }catch(err){console.error(err);item.status="error";item.error=err.message||String(err);if(!item.cancelled)toast(`Falha no upload de ${item.file.name}: ${item.error}`,"error",6000)}finally{renderFn()}};
  const result=attachmentUploadTail.then(run);attachmentUploadTail=result.catch(()=>{});return result;
}
async function uploadImage(item){const form=new FormData();form.append("file",item.file,item.file.name);form.append("purpose","chat");const res=await fetch(`${serverHttpBase()}/media`,{method:"POST",headers:{"X-OpenCall-Token":state.uploadToken},body:form,signal:AbortSignal.timeout(120000)});if(!res.ok)throw new Error(await res.text());item.progress=100;return await res.json()}
async function uploadLargeFile(item,renderFn=renderUploadTray){
  const base=serverHttpBase(),token=state.uploadToken;
  const request=async(path,options={})=>{
    if(item.cancelled)throw new Error("Upload cancelado");
    if(base!==serverHttpBase()||token!==state.uploadToken)throw new Error("Conexão mudou; envie o anexo novamente.");
    const res=await fetch(base+path,{...options,headers:{"X-OpenCall-Token":token,...options.headers},signal:AbortSignal.timeout(120000)});
    if(!res.ok)throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  };
  const validOffset=value=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<0||n>item.file.size)throw new Error("Offset de upload inválido");return n};
  const meta=await request("/upload/start",{method:"POST",headers:{"X-OpenCall-File-Name":encodeURIComponent(item.file.name),"X-OpenCall-File-Size":String(item.file.size),"X-OpenCall-File-Type":item.file.type||"application/octet-stream"}});
  if(typeof meta.upload_id!=="string"||!meta.upload_id)throw new Error("ID de upload inválido");
  item.uploadId=meta.upload_id;let offset=validOffset(meta.offset??0),failures=0;
  const offered=Number(meta.chunk_size??8*1024*1024);
  if(!Number.isSafeInteger(offered)||offered<=0)throw new Error("Tamanho de bloco inválido");
  const chunkSize=Math.min(offered,1024*1024),path=`/upload/${encodeURIComponent(item.uploadId)}`;
  item.lastAt=performance.now();item.lastBytes=offset;
  while(offset<item.file.size){
    while(item.paused&&!item.cancelled){item.status="paused";await new Promise(r=>setTimeout(r,250))}
    item.status="uploading";
    const end=Math.min(item.file.size,offset+chunkSize);
    try{
      const j=await request(path+"/chunk",{method:"POST",headers:{"X-OpenCall-Offset":String(offset),"Content-Type":"application/octet-stream"},body:item.file.slice(offset,end)});
      const next=validOffset(j.offset);if(next!==end)throw new Error("Confirmação de bloco inválida");offset=next;
      const now=performance.now(),dt=Math.max(.001,(now-item.lastAt)/1000);
      item.speed=(offset-item.lastBytes)/dt;item.eta=item.speed>0?(item.file.size-offset)/item.speed:0;
      item.lastAt=now;item.lastBytes=offset;item.progress=Math.floor(offset/item.file.size*100);failures=0;renderFn();
    }catch(e){
      if(item.cancelled||base!==serverHttpBase()||token!==state.uploadToken||++failures>4)throw e;
      await new Promise(r=>setTimeout(r,Math.min(4000,500*2**(failures-1))));
      const status=await request(path+`/status?token=${encodeURIComponent(token)}`);offset=validOffset(status.offset);
    }
  }
  return request(path+"/finish",{method:"POST"});
}
function renderUploadTray(){for(const tray of [els.uploadTray,els.dmUploadTray]){tray.replaceChildren();tray.classList.toggle("hidden",!state.pendingFiles.length);for(const item of state.pendingFiles){const c=document.createElement("div");c.className="upload-card";let status=item.status==="done"?"Pronto":item.status==="error"?"Erro":item.status==="paused"?"Pausado":`${item.progress}%`;if(item.speed>0&&!["done","error"].includes(item.status))status+=` · ${formatBytes(item.speed)}/s${item.eta?` · ${Math.ceil(item.eta)}s`:""}`;c.innerHTML=`<strong>${escapeHtml(item.file.name)}</strong><span>${formatBytes(item.file.size)} · ${status}</span><div class="upload-progress"><i style="width:${item.progress}%"></i></div>`;const controls=document.createElement("div");controls.style.display="flex";controls.style.gap="4px";controls.style.marginTop="6px";if(!["done","error"].includes(item.status)){const pause=document.createElement("button");pause.style.position="static";pause.textContent=item.paused?"▶":"Ⅱ";pause.title=item.paused?"Retomar":"Pausar";pause.onclick=()=>{item.paused=!item.paused;renderUploadTray()};controls.appendChild(pause)}const x=document.createElement("button");x.style.position="static";x.textContent="×";x.title="Cancelar/remover";x.onclick=()=>{item.cancelled=true;state.pendingFiles=state.pendingFiles.filter(v=>v!==item);renderUploadTray()};controls.appendChild(x);c.appendChild(controls);tray.appendChild(c)}}}
async function captureScreenshot(){if(!navigator.mediaDevices?.getDisplayMedia)return toast("Captura de tela indisponível.","error");try{const stream=await requestDesktopDisplayMedia({video:true,audio:false});const v=document.createElement("video");v.srcObject=stream;await v.play();await new Promise(r=>setTimeout(r,200));const canvas=document.createElement("canvas");canvas.width=v.videoWidth;canvas.height=v.videoHeight;canvas.getContext("2d").drawImage(v,0,0);stream.getTracks().forEach(t=>t.stop());const blob=await new Promise(r=>canvas.toBlob(r,"image/png"));if(blob)queueFiles([new File([blob],`print-${new Date().toISOString().replace(/[:.]/g,"-")}.png`,{type:"image/png"})])}catch(e){if(e.name!=="NotAllowedError"&&e.name!=="AbortError")toast(`Print: ${e.message||e}`,"error")}}


// -----------------------------------------------------------------------------
// Integração Electron: seletor nativo de fonte de tela + áudio do sistema
// -----------------------------------------------------------------------------
function updateShareAudioPickerUI(audioRequested=true){
  if(!els.shareAudioOptions)return;
  els.shareAudioOptions.classList.toggle("hidden",!audioRequested);
  if(!audioRequested)return;
  els.shareSystemAudioToggle.checked=settings.shareSystemAudio!==false;
  const status=els.shareAudioIsolationStatus;
  status.classList.remove("ok","warn");
  if(!window.openCallDesktop){
    status.classList.add("warn");
    status.querySelector("span:last-child").textContent="Na versão web o navegador decide se o áudio do sistema pode ser capturado.";
    return;
  }
  const platform=state.desktop.platform||navigator.platform.toLowerCase();
  if(platform.includes("linux")){
    status.classList.add("ok");
    status.querySelector("span:last-child").textContent="Linux: o OpenCall cria um barramento PipeWire/PulseAudio separado e mantém a voz da call fora dele.";
  }else if(platform.includes("win")){
    status.classList.add("ok");
    status.querySelector("span:last-child").textContent="Windows: loopback do sistema com restrictOwnAudio; o áudio do próprio OpenCall é excluído.";
  }else{
    status.classList.add("warn");
    status.querySelector("span:last-child").textContent="O isolamento do áudio da call ainda depende do suporte da plataforma.";
  }
}

async function loadDesktopSources(){
  if(!window.openCallDesktop)return [];
  els.desktopSourceHint.textContent="Carregando monitores e janelas…";
  els.desktopSourceGrid.replaceChildren();
  try{
    const sources=await window.openCallDesktop.listDisplaySources();
    els.desktopSourceHint.textContent=`${sources.length} fonte(s) encontrada(s)`;
    for(const src of sources){
      const b=document.createElement("button");b.type="button";b.className="source-card";
      if(src.thumbnail){const img=document.createElement("img");img.className="source-thumb";img.src=src.thumbnail;img.alt="";b.appendChild(img)}
      const copy=document.createElement("span");copy.className="source-card-copy";
      const kind=document.createElement("span");kind.className="source-kind";kind.textContent=src.kind==="screen"?"Monitor":"Janela";
      const name=document.createElement("strong");name.textContent=src.name||"Fonte";copy.append(kind,name);b.appendChild(copy);
      b.onclick=async()=>{try{await window.openCallDesktop.selectDisplaySource(src.id);settings.shareSystemAudio=Boolean(els.shareSystemAudioToggle?.checked);saveSettings();els.desktopSourceDialog.close();const resolve=state.desktop.sourceResolve;state.desktop.sourceResolve=null;resolve?.(src)}catch(err){toast(`Fonte: ${err.message||err}`,"error")}};
      els.desktopSourceGrid.appendChild(b);
    }
    return sources;
  }catch(err){els.desktopSourceHint.textContent="Falha ao listar fontes.";toast(`Captura desktop: ${err.message||err}`,"error");return []}
}
function chooseDesktopSource(audioRequested=true){
  if(!window.openCallDesktop)return Promise.resolve(null);
  updateShareAudioPickerUI(audioRequested);
  if(state.desktop.sourceResolve){state.desktop.sourceResolve(null);state.desktop.sourceResolve=null}
  return new Promise(resolve=>{
    state.desktop.sourceResolve=resolve;
    loadDesktopSources();
    if(!els.desktopSourceDialog.open)els.desktopSourceDialog.showModal();
  });
}

async function findOpenCallSystemAudioInput(info){
  // Chromium normalmente não expõe fontes monitor no Linux. O processo principal
  // cria uma source remapeada que se comporta como microfone e portanto aparece
  // em enumerateDevices().
  let devices=await navigator.mediaDevices.enumerateDevices();
  let hit=devices.find(d=>d.kind==="audioinput"&&/OpenCall[_ ]System[_ ]Audio/i.test(d.label||""));
  if(!hit){
    // Uma permissão de áudio pode ser necessária para liberar labels/deviceIds.
    try{const probe=await navigator.mediaDevices.getUserMedia({audio:true,video:false});probe.getTracks().forEach(t=>t.stop())}catch{}
    devices=await navigator.mediaDevices.enumerateDevices();
    hit=devices.find(d=>d.kind==="audioinput"&&/OpenCall[_ ]System[_ ]Audio/i.test(d.label||""));
  }
  if(!hit)throw new Error(`Fonte virtual ${info?.sourceLabel||"OpenCall System Audio"} não apareceu no Chromium`);
  return hit;
}

async function captureLinuxIsolatedSystemAudio(){
  const info=await window.openCallDesktop.prepareSystemAudio();
  if(!info?.ok)throw new Error(info?.message||"Não foi possível preparar o áudio do sistema");
  state.desktop.systemAudioActive=true;state.desktop.systemAudioInfo=info;
  try{
    // Dá tempo para PipeWire/PulseAudio publicar a source remapeada.
    await new Promise(r=>setTimeout(r,180));
    const device=await findOpenCallSystemAudioInput(info);
    return await navigator.mediaDevices.getUserMedia({
      audio:{deviceId:{exact:device.deviceId},echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:{ideal:2},sampleRate:{ideal:48000}},
      video:false
    });
  }catch(err){
    state.desktop.systemAudioActive=false;state.desktop.systemAudioInfo=null;
    await window.openCallDesktop.stopSystemAudio().catch(()=>{});
    throw err;
  }
}

async function stopDesktopSystemAudio(){
  if(!window.openCallDesktop)return;
  if(state.desktop.systemAudioActive){
    state.desktop.systemAudioActive=false;state.desktop.systemAudioInfo=null;
    try{await window.openCallDesktop.stopSystemAudio()}catch{}
  }
}

async function getDesktopCaptureEnvironment(){
  if(!window.openCallDesktop)return {platform:(navigator.userAgentData?.platform||navigator.platform||"").toLowerCase(),nativeDisplayPickerPreferred:false};
  if(!state.desktop.platform){
    try{
      const info=await window.openCallDesktop.getInfo();
      state.desktop.platform=info?.platform||"";
      state.desktop.nativeDisplayPickerPreferred=Boolean(info?.nativeDisplayPickerPreferred);
      state.desktop.sessionType=info?.sessionType||"";
      state.desktop.desktopEnvironment=info?.desktopEnvironment||"";
    }catch{}
  }
  return {
    platform:(state.desktop.platform||navigator.userAgentData?.platform||navigator.platform||"").toLowerCase(),
    nativeDisplayPickerPreferred:Boolean(state.desktop.nativeDisplayPickerPreferred)
  };
}

async function requestDesktopDisplayMedia(constraints){
  const audioRequested=constraints?.audio!==false&&constraints?.audio!=null;
  const wantsSystemAudio=audioRequested&&settings.shareSystemAudio!==false;
  if(window.openCallDesktop){
    const env=await getDesktopCaptureEnvironment();
    const platform=env.platform;
    // GNOME/KDE em Wayland já têm um seletor seguro via xdg-desktop-portal.
    // Não abrimos o picker do OpenCall antes dele, evitando a confirmação dupla.
    if(!env.nativeDisplayPickerPreferred){
      const source=await chooseDesktopSource(audioRequested);
      if(!source){const err=new DOMException("Seleção cancelada","AbortError");throw err}
    }

    if(platform==="linux"||platform.includes("linux")){
      // No Linux o áudio do desktop não é fornecido como loopback pelo Electron.
      // Capturamos vídeo pelo desktopCapturer e o áudio por uma source virtual
      // PipeWire/PulseAudio que contém os apps do sistema, mas não o OpenCall.
      const display=await navigator.mediaDevices.getDisplayMedia({...constraints,audio:false});
      if(!wantsSystemAudio)return display;
      try{
        const sys=await captureLinuxIsolatedSystemAudio();
        return new MediaStream([...display.getVideoTracks(),...sys.getAudioTracks()]);
      }catch(err){
        toast(`Áudio do sistema indisponível: ${err.message||err}. A tela continuará sem áudio.`,"error",6000);
        return display;
      }
    }

    if(platform==="win32"||platform.includes("win")){
      // Electron 44+ respeita restrictOwnAudio e usa loopbackWithoutChrome,
      // evitando que voz/stream do próprio OpenCall volte para a transmissão.
      return navigator.mediaDevices.getDisplayMedia({...constraints,audio:wantsSystemAudio?{restrictOwnAudio:true}:false});
    }
  }
  return navigator.mediaDevices.getDisplayMedia({...constraints,audio:wantsSystemAudio?constraints.audio:false});
}

// -----------------------------------------------------------------------------
// DMs e grupos privados
// -----------------------------------------------------------------------------
function upsertDmThread(th){const i=state.dmThreads.findIndex(x=>x.id===th.id);if(i>=0)state.dmThreads[i]=th;else state.dmThreads.push(th);renderDmList()}
function renderDmList(){els.dmList.replaceChildren();for(const th of state.dmThreads){const b=document.createElement("button");b.className=`dm-row ${state.currentView==="dm"&&state.dmThreadId===th.id?"active":""}`;const other=th.members?.find(x=>Number(x.user_id)!==Number(state.profile?.user_id))||th.members?.[0];const av=document.createElement("span");av.className="avatar";av.style.width="26px";av.style.height="26px";av.style.borderRadius="9px";setAvatar(av,other?.avatar_media_id,th.display_name||other?.display_name,other||{});const n=document.createElement("span");n.textContent=th.display_name||"Conversa";b.append(av,n);b.onclick=()=>openDm(th.id);els.dmList.appendChild(b)}}
function openDm(tid){const th=state.dmThreads.find(x=>x.id===tid);if(!th){send({type:"dm_list"});return}state.dmThreadId=tid;switchView("dm");const sameCall=Boolean(state.dmCallThreadId&&state.dmCallThreadId===tid);if(sameCall)mountCallUiInDm();else restoreCallUiHome();els.viewIcon.textContent="@";els.viewTitle.textContent=th.display_name||"Mensagem direta";els.viewSubtitle.textContent=sameCall?"Conversa privada · chamada ativa":"Conversa privada · mensagens, arquivos, chamadas e tela";send({type:"dm_history",thread_id:tid});renderDm(true);if(sameCall)renderCall();updateDmCallToolbar()}
function receiveDmMessage(m){if(!state.dmThreads.some(t=>t.id===m.thread_id))send({type:"dm_list"},{silent:true});const l=state.dmMessages.get(m.thread_id)||[];if(!l.some(x=>x.id===m.id))l.push(m);state.dmMessages.set(m.thread_id,l);if(state.currentView==="dm"&&state.dmThreadId===m.thread_id)renderDm(true);else if(Number(m.sender?.user_id)!==Number(state.profile?.user_id))notify("Nova mensagem direta",`${m.sender?.display_name||m.sender?.username}: ${(m.content||"anexo").slice(0,100)}`)}
function renderDm(scroll=false){const list=state.dmMessages.get(state.dmThreadId)||[];els.dmMessageList.replaceChildren();for(const m of list){const clone={...m,channel_id:null,reactions:[],pinned:false};els.dmMessageList.appendChild(dmMessageNode(clone))}if(scroll)requestAnimationFrame(()=>els.dmScroller.scrollTop=els.dmScroller.scrollHeight)}
function dmMessageNode(m){const row=document.createElement("article");row.className="message dm-message";row.dataset.id=m.id;const av=document.createElement("span");av.className="avatar message-avatar";setAvatar(av,m.sender?.avatar_media_id,m.sender?.display_name,m.sender||{});const main=document.createElement("div");main.className="message-main";if(m.reply){const rp=document.createElement("div");rp.className="reply-preview";rp.textContent=`↪ ${m.reply.display_name||"Usuário"}: ${(m.reply.content||"mensagem").slice(0,100)}`;main.appendChild(rp)}const meta=document.createElement("div");meta.className="message-meta";meta.innerHTML=`<span class="message-author">${escapeHtml(m.sender?.display_name||m.sender?.username)}</span><span class="message-time">${formatTime(m.created_at)}</span>${m.edited_at?'<span class="message-edited">(editada)</span>':""}`;const content=document.createElement("div");content.className="message-content";content.innerHTML=m.deleted?"<em>Mensagem removida</em>":linkifyMentions(m.content||"");main.append(meta,content);if(!m.deleted&&m.attachments?.length)main.appendChild(renderAttachments(m.attachments));row.append(av,main);return row}
function submitDm(){const content=els.dmInput.value.trim();if((!content&&!state.pendingFiles.length)||!state.dmThreadId)return;const ready=state.pendingFiles.filter(x=>x.status==="done"&&x.record).map(x=>x.record);if(state.pendingFiles.some(x=>x.status!=="done")){toast("Conclua ou remova os anexos pendentes.","error");return}if(!send({type:"dm_send",thread_id:state.dmThreadId,content,attachments:ready,reply_to:state.dmReplyTo?.id||""}))return;els.dmInput.value="";state.pendingFiles=[];renderUploadTray();autoResize(els.dmInput)}
function openNewDm(){els.dmUserPicker.replaceChildren();els.dmGroupName.value="";const users=state.friends.filter(x=>Number(x.user_id)!==Number(state.profile?.user_id));if(!users.length){const empty=document.createElement("div");empty.className="friend-empty";empty.textContent="Adicione amigos pelo Nome#0000 para iniciar conversas privadas.";els.dmUserPicker.appendChild(empty)}for(const u of users){const l=document.createElement("label");l.className="user-picker-row";const cb=document.createElement("input");cb.type="checkbox";cb.value=u.user_id;const span=document.createElement("span");span.textContent=`${publicUserId(u)} (@${u.username||""})`;l.append(cb,span);els.dmUserPicker.appendChild(l)}els.newDmDialog.showModal()}

// -----------------------------------------------------------------------------
// Amigos e identidade pública Nome#0000
// -----------------------------------------------------------------------------
function friendRelation(userId){const id=Number(userId);if(state.friends.some(x=>Number(x.user_id)===id))return "friend";if(state.friendIncoming.some(x=>Number(x.user_id)===id))return "incoming";if(state.friendOutgoing.some(x=>Number(x.user_id)===id))return "outgoing";return "none"}
function friendRow(user,actions=[]){const row=document.createElement("div");row.className="friend-row";const av=document.createElement("span");av.className="avatar";av.style.width="34px";av.style.height="34px";av.style.borderRadius="11px";setAvatar(av,user.avatar_media_id,user.display_name,user);const copy=document.createElement("div");copy.className="friend-copy";copy.innerHTML=`<strong>${escapeHtml(publicUserId(user))}</strong><span>@${escapeHtml(user.username||"")}</span>`;const act=document.createElement("div");act.className="friend-actions";for(const a of actions){const b=document.createElement("button");b.type="button";b.className=a.danger?"danger-btn":"secondary-btn";b.textContent=a.label;b.onclick=a.onclick;act.appendChild(b)}row.append(av,copy,act);return row}
function renderFriends(){if(!els.friendsList)return;els.friendRequestBadge.textContent=state.friendIncoming.length?String(Math.min(99,state.friendIncoming.length)):"";els.friendRequestBadge.classList.toggle("hidden",!state.friendIncoming.length);els.friendsList.replaceChildren();els.incomingFriendRequests.replaceChildren();els.outgoingFriendRequests.replaceChildren();if(!state.friends.length){const e=document.createElement("div");e.className="friend-empty";e.textContent="Nenhum amigo ainda.";els.friendsList.appendChild(e)}for(const u of state.friends)els.friendsList.appendChild(friendRow(u,[{label:"Mensagem",onclick:()=>{send({type:"dm_create",member_ids:[u.user_id]});if(els.friendsDialog.open)els.friendsDialog.close()}},{label:"Remover",danger:true,onclick:()=>send({type:"friend_remove",user_id:u.user_id})}]));if(!state.friendIncoming.length)els.incomingFriendRequests.innerHTML='<div class="friend-empty">Nenhum pedido recebido.</div>';for(const u of state.friendIncoming)els.incomingFriendRequests.appendChild(friendRow(u,[{label:"Aceitar",onclick:()=>send({type:"friend_accept",user_id:u.user_id})},{label:"Recusar",danger:true,onclick:()=>send({type:"friend_reject",user_id:u.user_id})}]));if(!state.friendOutgoing.length)els.outgoingFriendRequests.innerHTML='<div class="friend-empty">Nenhum pedido enviado.</div>';for(const u of state.friendOutgoing)els.outgoingFriendRequests.appendChild(friendRow(u,[{label:"Cancelar",danger:true,onclick:()=>send({type:"friend_reject",user_id:u.user_id})}]));renderFriendsHome()}
function renderFriendSearchResult(u){els.friendSearchResult.replaceChildren();if(!u){els.friendSearchResult.innerHTML='<div class="friend-empty">Usuário não encontrado. Use exatamente Nome#0000.</div>';return}const rel=friendRelation(u.user_id),actions=[];if(rel==="friend")actions.push({label:"Mensagem",onclick:()=>{send({type:"dm_create",member_ids:[u.user_id]});els.friendsDialog.close()}});else if(rel==="incoming")actions.push({label:"Aceitar",onclick:()=>send({type:"friend_accept",user_id:u.user_id})});else if(rel==="outgoing")actions.push({label:"Pedido enviado",onclick:()=>{}});else actions.push({label:"Adicionar amigo",onclick:()=>send({type:"friend_request",user_id:u.user_id})});els.friendSearchResult.appendChild(friendRow(u,actions))}
function friendLooksOnline(user){const p=state.presence.find(x=>Number(x.user_id)===Number(user?.user_id));return Boolean(p&&safeText(p.status||"online").toLowerCase()!=="offline")}
function setFriendsMode(mode="all"){
  state.friendsMode=["all","online","pending","add"].includes(mode)?mode:"all";
  for(const [b,m] of [[els.friendsTabAll,"all"],[els.friendsTabOnline,"online"],[els.friendsTabPending,"pending"],[els.friendsTabAdd,"add"]])b?.classList.toggle("active",state.friendsMode===m);
  els.friendsBrowsePanel?.classList.toggle("hidden",state.friendsMode==="add");
  els.friendsHomeSearchPanel?.classList.toggle("hidden",state.friendsMode!=="add");
  renderFriendsHome();
}
function friendsHomeActions(user){return [{label:"Mensagem",onclick:()=>send({type:"dm_create",member_ids:[user.user_id]})},{label:"Remover",danger:true,onclick:()=>send({type:"friend_remove",user_id:user.user_id})}]}
function renderFriendsHome(){
  if(!els.friendsHomeList)return;
  const pending=state.friendIncoming.length+state.friendOutgoing.length;
  for(const badge of [els.pendingFriendsCount,els.friendsPendingBadge]){if(!badge)continue;badge.textContent=pending?String(Math.min(99,pending)):"";badge.classList.toggle("hidden",!pending)}
  if(state.currentView!=="friends")return;
  if(state.friendsMode==="add"){renderFriendsHomeSearchResult(state.friendSearchResult);return}
  const query=safeText(els.friendsListSearch?.value).trim().toLowerCase();
  els.friendsHomeList.replaceChildren();
  let entries=[];
  let heading="TODOS";
  if(state.friendsMode==="online"){heading="ONLINE";entries=state.friends.filter(friendLooksOnline)}
  else if(state.friendsMode==="pending"){heading="PENDENTES";entries=[]}
  else entries=state.friends.slice();
  if(query)entries=entries.filter(u=>`${publicUserId(u)} @${u.username||""}`.toLowerCase().includes(query));
  if(els.friendsHomeHeading)els.friendsHomeHeading.textContent=`${heading} — ${state.friendsMode==="pending"?pending:entries.length}`;
  if(state.friendsMode==="pending"){
    if(!pending){els.friendsHomeList.innerHTML='<div class="friends-home-empty"><strong>Nenhum pedido pendente</strong><span>Quando alguém enviar um pedido de amizade, ele aparecerá aqui.</span></div>';return}
    if(state.friendIncoming.length){const h=document.createElement("div");h.className="friend-subheading";h.textContent=`RECEBIDOS — ${state.friendIncoming.length}`;els.friendsHomeList.appendChild(h);for(const u of state.friendIncoming)els.friendsHomeList.appendChild(friendRow(u,[{label:"Aceitar",onclick:()=>send({type:"friend_accept",user_id:u.user_id})},{label:"Recusar",danger:true,onclick:()=>send({type:"friend_reject",user_id:u.user_id})}]))}
    if(state.friendOutgoing.length){const h=document.createElement("div");h.className="friend-subheading";h.textContent=`ENVIADOS — ${state.friendOutgoing.length}`;els.friendsHomeList.appendChild(h);for(const u of state.friendOutgoing)els.friendsHomeList.appendChild(friendRow(u,[{label:"Cancelar",danger:true,onclick:()=>send({type:"friend_reject",user_id:u.user_id})}]))}
    return;
  }
  if(!entries.length){els.friendsHomeList.innerHTML=`<div class="friends-home-empty"><strong>${query?"Nenhum resultado":state.friendsMode==="online"?"Ninguém online por aqui":"Sua lista de amigos está vazia"}</strong><span>${query?"Tente outro nome.":state.friendsMode==="online"?"Amigos online detectados no servidor atual aparecem aqui.":"Use Adicionar amigo e procure alguém por Nome#0000."}</span></div>`;return}
  for(const u of entries){const row=friendRow(u,friendsHomeActions(u));row.classList.add("friends-home-row");const dot=document.createElement("i");dot.className=`friend-presence ${friendLooksOnline(u)?"online":"offline"}`;row.querySelector(".avatar")?.appendChild(dot);els.friendsHomeList.appendChild(row)}
}
function renderFriendsHomeSearchResult(u){
  if(!els.friendsHomeSearchResult)return;els.friendsHomeSearchResult.replaceChildren();
  if(!u){els.friendsHomeSearchResult.innerHTML='<div class="friend-empty">Procure alguém usando exatamente Nome#0000.</div>';return}
  const rel=friendRelation(u.user_id),actions=[];
  if(rel==="friend")actions.push({label:"Mensagem",onclick:()=>send({type:"dm_create",member_ids:[u.user_id]})});
  else if(rel==="incoming")actions.push({label:"Aceitar",onclick:()=>send({type:"friend_accept",user_id:u.user_id})});
  else if(rel==="outgoing")actions.push({label:"Pedido enviado",onclick:()=>{}});
  else actions.push({label:"Adicionar amigo",onclick:()=>send({type:"friend_request",user_id:u.user_id})});
  els.friendsHomeSearchResult.appendChild(friendRow(u,actions));
}
function openFriendsHome(mode="all"){
  send({type:"friends_list"});state.dmThreadId=null;switchView("friends");setFriendsMode(mode);
  els.viewIcon.textContent="👥";els.viewTitle.textContent="Amigos";els.viewSubtitle.textContent="Amigos, solicitações e mensagens diretas";
  if(mode==="add"){state.friendSearchResult=null;els.friendsHomeSearchInput.value="";renderFriendsHomeSearchResult(null)}
}
function openFriends(){openFriendsHome("all")}

// -----------------------------------------------------------------------------
// Chamada privada integrada à conversa (v0.7.61, base v0.7.60)
// -----------------------------------------------------------------------------
function mountCallUiInDm(){
  if(!els.dmCallHost||!els.callStage||!els.callControls)return;
  if(els.callStage.parentElement!==els.dmCallHost)els.dmCallHost.append(els.callStage,els.callControls);
  els.dmCallHost.classList.remove("hidden");
  els.dmView?.classList.add("dm-call-active");
}
function restoreCallUiHome(){
  if(!els.callView||!els.callStage||!els.callControls)return;
  if(els.callStage.parentElement!==els.callView)els.callView.append(els.callStage,els.callControls);
  els.dmCallHost?.classList.add("hidden");
  els.dmView?.classList.remove("dm-call-active");
}

// -----------------------------------------------------------------------------
// Chamadas privadas em DMs (v0.7.48)
// -----------------------------------------------------------------------------
function dmThreadById(tid){return state.dmThreads.find(x=>x.id===tid)||null}
function dmCallActive(){return Boolean(state.dmCallThreadId)}
function activeCall(){return Boolean(state.voiceChannelId||state.dmCallThreadId||state.voiceJoining||state.dmCallJoining)}
function dmCallParticipantByClient(cid){return state.dmCallParticipants.get(safeText(cid))||null}
function updateDmCallToolbar(){
  const inDm=state.currentView==="dm"&&Boolean(state.dmThreadId),same=Boolean(state.dmCallThreadId&&state.dmCallThreadId===state.dmThreadId),any=Boolean(state.dmCallThreadId);
  for(const b of [els.dmVoiceCallButton,els.dmVideoCallButton,els.dmScreenCallButton])b?.classList.toggle("hidden",!inDm||same);
  els.dmOpenCallButton?.classList.toggle("hidden",!inDm||!same);
  if(els.dmOpenCallButton)els.dmOpenCallButton.title=same?"Voltar para a chamada privada":"Voltar para a chamada";
  if(inDm&&same)els.viewSubtitle.textContent="Conversa privada · chamada ativa";
}
async function startDmCall({video=false,screen=false}={}){
  const tid=state.dmThreadId;if(!tid)return toast("Abra uma DM primeiro.","error");if(!state.features?.dm_calls)return toast("Chamadas em DMs exigem OpenCall Server 0.7.0 ou superior.","error",6000);if(screen&&!state.features?.dm_screen_share)return toast("Compartilhamento de tela em DMs exige OpenCall Server 0.7.0 ou superior.","error",6000);
  if(state.dmCallThreadId===tid){state.dmCallPendingVideo=state.dmCallPendingVideo||video;state.dmCallPendingScreen=state.dmCallPendingScreen||screen;openDmCallView();if(video&&!state.voiceCamera)await toggleCamera();if(screen&&!state.screenStream)await startScreenShare();return}
  if(state.voiceChannelId||state.dmCallThreadId){leaveVoice();await new Promise(r=>setTimeout(r,60))}
  state.dmCallJoining=true;state.dmCallPendingVideo=Boolean(video);state.dmCallPendingScreen=Boolean(screen);
  try{await ensureVoiceStream();send({type:"dm_call_start",thread_id:tid,video:Boolean(video)})}catch(e){state.dmCallJoining=false;toast(`Chamada: ${e.message||e}`,"error")}
}
function openDmCallView(){
  const tid=state.dmCallThreadId||state.dmThreadId;const th=dmThreadById(tid);if(tid)state.dmThreadId=tid;
  switchView("dm");mountCallUiInDm();els.viewIcon.textContent="@";els.viewTitle.textContent=th?.display_name||"Mensagem direta";els.viewSubtitle.textContent="Conversa privada · chamada ativa";
  if(tid)send({type:"dm_history",thread_id:tid},{silent:true});renderDm(true);renderCall();updateDmCallToolbar();
}
function onDmCallInvite(m){
  const tid=m.thread?.id;if(!tid||state.dmCallThreadId===tid)return;
  state.incomingDmCall={thread:m.thread,caller:m.caller||{},video:Boolean(m.video)};upsertDmThread(m.thread);
  els.dmIncomingCallName.textContent=publicUserId(m.caller||{})||m.caller?.display_name||"Chamada recebida";
  els.dmIncomingCallInfo.textContent=`${m.thread?.display_name||"Mensagem direta"}${m.video?" · chamada com vídeo":" · chamada de voz"}`;
  els.dmIncomingCallSubtitle.textContent=m.video?"Está chamando por vídeo":"Está ligando para você";
  if(!els.dmIncomingCallDialog.open)els.dmIncomingCallDialog.showModal();
}
async function acceptIncomingDmCall(){
  const incoming=state.incomingDmCall;if(!incoming)return;const tid=incoming.thread?.id;const wantsVideo=Boolean(incoming.video);state.incomingDmCall=null;els.dmIncomingCallDialog.close();
  if(state.voiceChannelId||state.dmCallThreadId){leaveVoice();await new Promise(r=>setTimeout(r,60))}
  state.dmThreadId=tid;state.dmCallJoining=true;state.dmCallPendingVideo=wantsVideo;try{await ensureVoiceStream();send({type:"dm_call_join",thread_id:tid})}catch(e){state.dmCallJoining=false;toast(`Chamada: ${e.message||e}`,"error")}
}
function declineIncomingDmCall(){const x=state.incomingDmCall;if(x?.thread?.id)send({type:"dm_call_decline",thread_id:x.thread.id},{silent:true});state.incomingDmCall=null;if(els.dmIncomingCallDialog.open)els.dmIncomingCallDialog.close()}
async function onDmCallJoined(m){
  state.dmCallJoining=false;state.dmCallThreadId=m.thread_id;state.voiceChannelId=null;state.dmCallParticipants.clear();
  for(const p of m.participants||[]){if(p?.client_id)state.dmCallParticipants.set(safeText(p.client_id),p);const pid=p?.client_id;if(!pid||pid===state.clientId)continue;ensureVoicePeer(pid);await createVoiceOffer(pid)}
  if(state.profile)state.dmCallParticipants.set(safeText(state.clientId),{...state.profile,client_id:state.clientId,voice:{muted:state.voiceMuted,deafened:state.voiceDeafened,camera:state.voiceCamera,speaking:state.voiceSpeaking}});
  openDmCallView();els.voiceMiniPanel.classList.remove("hidden");els.voiceMiniChannel.textContent=`DM · ${dmThreadById(m.thread_id)?.display_name||"privada"}`;toast("Chamada privada conectada.","success");updateDmCallToolbar();
  const wantsVideo=state.dmCallPendingVideo,wantsScreen=state.dmCallPendingScreen;state.dmCallPendingVideo=false;state.dmCallPendingScreen=false;
  if(wantsVideo&&!state.voiceCamera)setTimeout(()=>toggleCamera(),80);if(wantsScreen)setTimeout(()=>startScreenShare(),160);
}
async function onDmCallParticipantJoined(m){const p=m.participant||{};if(m.thread_id!==state.dmCallThreadId||!p.client_id||p.client_id===state.clientId)return;state.dmCallParticipants.set(safeText(p.client_id),p);const rec=ensureVoicePeer(p.client_id);if(!rec.fallbackOfferTimer){rec.fallbackOfferTimer=setTimeout(()=>{rec.fallbackOfferTimer=null;if(!state.voicePeers.has(p.client_id))return;if(rec.pc.signalingState==="stable"&&!rec.pc.localDescription&&!rec.pc.remoteDescription)createVoiceOffer(p.client_id).catch(err=>console.warn("Fallback offer DM",err))},900)}renderCall()}
function onDmCallParticipantLeft(m){if(m.thread_id!==state.dmCallThreadId)return;if(state.dmAvailableScreen?.hostId===m.client_id)state.dmAvailableScreen=null;state.dmCallParticipants.delete(safeText(m.client_id));closeVoicePeer(m.client_id);renderCall()}
function onDmCallState(m){if(m.thread_id!==state.dmCallThreadId)return;const key=safeText(m.client_id),u=state.dmCallParticipants.get(key);if(u)u.voice={...(u.voice||{}),muted:Boolean(m.muted),deafened:Boolean(m.deafened),camera:Boolean(m.camera),speaking:u.voice?.speaking||false};renderCall()}
function onDmCallSpeaking(m){if(m.thread_id!==state.dmCallThreadId)return;const u=state.dmCallParticipants.get(safeText(m.client_id));if(u){u.voice={...(u.voice||{}),speaking:Boolean(m.active)};}updateSpeakingDom(m)}

// -----------------------------------------------------------------------------
// Voz WebRTC, câmera, indicador de fala, volume individual e Push-to-Talk
// -----------------------------------------------------------------------------
async function refreshDevices(requestPermission=false){
  try{if(requestPermission&&navigator.mediaDevices?.getUserMedia){const s=await navigator.mediaDevices.getUserMedia({audio:true,video:true});s.getTracks().forEach(t=>t.stop())}const ds=await navigator.mediaDevices.enumerateDevices();fillDeviceSelect(els.audioInputSelect,ds.filter(x=>x.kind==="audioinput"),settings.audioInput,"Microfone padrão");fillDeviceSelect(els.audioOutputSelect,ds.filter(x=>x.kind==="audiooutput"),settings.audioOutput,"Saída padrão");fillDeviceSelect(els.cameraSelect,ds.filter(x=>x.kind==="videoinput"),settings.cameraId,"Câmera padrão");}
  catch(e){console.warn(e);toast("Não foi possível listar todos os dispositivos. Autorize microfone/câmera.","error")}
}
function fillDeviceSelect(sel,list,current,defaultLabel){sel.replaceChildren();const d=document.createElement("option");d.value="";d.textContent=defaultLabel;sel.appendChild(d);list.forEach((x,i)=>{const o=document.createElement("option");o.value=x.deviceId;o.textContent=x.label||`${defaultLabel} ${i+1}`;o.selected=x.deviceId===current;sel.appendChild(o)});if(current&&!list.some(x=>x.deviceId===current))sel.value=""}
async function applyAudioOutput(audio){if(!audio)return;const id=settings.audioOutput;if(typeof audio.setSinkId==="function"){try{await audio.setSinkId(id||"")}catch(e){console.warn("setSinkId",e)}}}
async function testAudioOutput(){const ctx=new (window.AudioContext||window.webkitAudioContext)();const dest=ctx.createMediaStreamDestination();const osc=ctx.createOscillator();const gain=ctx.createGain();gain.gain.value=.08;osc.frequency.value=520;osc.connect(gain).connect(dest);const a=new Audio();a.srcObject=dest.stream;await applyAudioOutput(a);osc.start();await a.play();setTimeout(()=>{osc.stop();a.pause();ctx.close()},550)}

async function ensureVoiceStream(){if(state.voiceStream)return state.voiceStream;if(!navigator.mediaDevices?.getUserMedia)throw new Error("Microfone indisponível");state.voiceStream=await openVoiceMicrophoneStream();const track=state.voiceStream.getAudioTracks()[0];if(track)track.enabled=!state.voiceMuted&&!settings.pushToTalk;startSpeakingDetector();return state.voiceStream}
async function joinVoice(channelId=state.channelId){const ch=state.structure.channels.find(c=>Number(c.id)===Number(channelId)&&c.type==="voice");if(!ch)return;if(state.voiceJoining)return;if(state.dmCallThreadId){leaveVoice();await new Promise(r=>setTimeout(r,60))}if(state.voiceChannelId&&Number(state.voiceChannelId)!==Number(ch.id)){if(state.screenStream||state.screenSessionCode)stopScreenShare(true);if(state.viewingHostId||state.viewerPeer)closeScreenViewer(true);cleanupVoice(false)}state.voiceJoining=true;openVoiceChannel(ch.id,{autoJoin:false});renderCall();try{await ensureVoiceStream();send({type:"voice_join",channel_id:ch.id,guild_id:state.guildId})}catch(e){state.voiceJoining=false;toast(`Microfone: ${e.message||e}`,"error");renderCall()}}
function leaveVoice(){
  if(state.screenStream||state.screenSessionCode)stopScreenShare(true);
  if(state.viewingHostId||state.viewerPeer)closeScreenViewer(true);
  if(state.dmCallThreadId||state.dmCallJoining)send({type:"dm_call_leave"},{silent:true});else if(state.voiceChannelId||state.voiceJoining)send({type:"voice_leave"},{silent:true});
  cleanupVoice(false);renderCall();renderChannels();updateDmCallToolbar();
}
function cleanupVoice(notify=true){
  state.dmAvailableScreen=null;
  if(notify){if(state.dmCallThreadId)send({type:"dm_call_leave"},{silent:true});else if(state.voiceChannelId)send({type:"voice_leave"},{silent:true})}
  if(state.viewingHostId||state.viewerPeer)closeScreenViewer(notify);
  for(const id of Array.from(state.voicePeers.keys()))closeVoicePeer(id);
  if(state.voiceStream)stopManagedVoiceStream(state.voiceStream);if(state.cameraStream)state.cameraStream.getTracks().forEach(t=>t.stop());
  state.voiceStream=null;state.cameraStream=null;state.voiceChannelId=null;state.voiceJoining=false;state.dmCallThreadId=null;state.dmCallJoining=false;state.dmCallParticipants.clear();state.voiceMuted=false;state.voiceDeafened=false;state.voiceCamera=false;stopSpeakingDetector();stopRnnoiseBridge();els.voiceMiniPanel.classList.add("hidden");restoreCallUiHome();updateDmCallToolbar();
}
function shouldInitiateVoice(peerId){return Boolean(state.clientId&&peerId)&&safeText(state.clientId).localeCompare(safeText(peerId))<0}
async function onVoiceJoined(m){state.voiceJoining=false;state.voiceChannelId=Number(m.channel_id);for(const p of m.participants||[]){const pid=p.client_id;if(!pid||pid===state.clientId)continue;ensureVoicePeer(pid);await createVoiceOffer(pid)}renderCall();renderChannels();els.voiceMiniPanel.classList.remove("hidden");const ch=state.structure.channels.find(c=>Number(c.id)===state.voiceChannelId);els.voiceMiniChannel.textContent=ch?.name||"Canal de voz";toast(`Conectado a ${ch?.name||"voz"}.`,"success")}
async function onVoiceParticipantJoined(m){const p=m.participant||{};if(!p.client_id||p.client_id===state.clientId)return;const rec=ensureVoicePeer(p.client_id);if(!rec.fallbackOfferTimer){rec.fallbackOfferTimer=setTimeout(()=>{rec.fallbackOfferTimer=null;if(!state.voicePeers.has(p.client_id))return;if(rec.pc.signalingState==="stable"&&!rec.pc.localDescription&&!rec.pc.remoteDescription)createVoiceOffer(p.client_id).catch(err=>console.warn("Fallback offer voz",err))},1100)}renderCall();renderChannels()}
function onVoiceParticipantLeft(m){closeVoicePeer(m.client_id);renderCall();renderChannels()}
function onVoiceState(m){const u=state.presence.find(x=>x.client_id===m.client_id||Number(x.user_id)===Number(m.user_id));if(u){u.voice={...(u.voice||{}),channel_id:m.channel_id,muted:Boolean(m.muted),deafened:Boolean(m.deafened),camera:Boolean(m.camera),speaking:u.voice?.speaking||false}}renderCall();renderChannels();renderMembers()}
function updateSpeakingDom(m){const active=Boolean(m.active),cid=safeText(m.client_id||""),uid=safeText(m.user_id||"");const sels=[];if(cid)sels.push(`[data-voice-client="${CSS.escape(cid)}"]`);if(uid)sels.push(`[data-voice-user="${CSS.escape(uid)}"]`);if(sels.length){for(const el of document.querySelectorAll(sels.join(',')))el.classList.toggle('speaking',active)}for(const card of document.querySelectorAll('.voice-card')){if((cid&&card.dataset.voiceClient===cid)||(uid&&card.dataset.voiceUser===uid)){const st=card.querySelector('.voice-card-status');if(st){const u=(cid?voiceParticipantByClient(cid):null)||(state.dmCallThreadId?Array.from(state.dmCallParticipants.values()).find(x=>uid&&safeText(x.user_id)===uid):state.presence.find(x=>uid&&safeText(x.user_id)===uid));st.textContent=u?.voice?.muted?'🔇 microfone desligado':active?'falando':'na chamada'}}}}
function onVoiceSpeaking(m){const u=state.presence.find(x=>x.client_id===m.client_id||Number(x.user_id)===Number(m.user_id));if(u&&u.voice)u.voice.speaking=Boolean(m.active);updateSpeakingDom(m)}
function voiceParticipantByClient(cid){return state.dmCallThreadId?dmCallParticipantByClient(cid):(state.presence.find(u=>u.client_id===cid)||null)}
function localAudioTrack(){return state.voiceStream?.getAudioTracks()[0]||null}
function localCameraTrack(){return state.cameraStream?.getVideoTracks()[0]||null}
function newVoicePeer(peerId){
  const pc=new RTCPeerConnection({iceServers:iceServers(),iceCandidatePoolSize:8,bundlePolicy:"max-bundle"});
  const rec={pc,peerId,pending:[],audio:null,boostAudio:null,remoteVideoStream:new MediaStream(),audioStream:new MediaStream(),makingOffer:false,polite:safeText(state.clientId).localeCompare(safeText(peerId))>0,restartAttempts:0,restartTimer:null,fallbackOfferTimer:null,gainUnavailable:false};
  const mic=localAudioTrack();if(mic)pc.addTrack(mic,state.voiceStream);const cam=localCameraTrack();if(cam)pc.addTrack(cam,state.cameraStream);
  pc.onicecandidate=e=>{if(e.candidate)sendVoicePeerSignal(peerId,{kind:"candidate",candidate:e.candidate.toJSON()})};
  pc.ontrack=async e=>{
    if(e.track.kind==="audio"){
      if(!rec.audioStream.getTracks().some(t=>t.id===e.track.id))rec.audioStream.addTrack(e.track);
      if(!rec.audio){
        // Caminho padrão deliberadamente simples: toca o MediaStream remoto direto no <audio>.
        // O WebAudio/Gain só é criado sob demanda para volumes acima de 100%. Isso evita
        // AudioContext suspenso causar silêncio na call em Chromium/Electron.
        rec.audio=new Audio();rec.audio.autoplay=true;rec.audio.playsInline=true;rec.audio.srcObject=rec.audioStream;
        await applyAudioOutput(rec.audio);applyPeerVolume(peerId);
      }
      try{if(rec.gainCtx?.state==="suspended")await rec.gainCtx.resume();await rec.audio.play()}catch(err){console.warn("Áudio remoto aguardando liberação de reprodução",err)}
      e.track.onunmute=()=>resumeVoicePeerPlayback(rec);
    }else if(e.track.kind==="video"){if(!rec.remoteVideoStream.getTracks().some(t=>t.id===e.track.id))rec.remoteVideoStream.addTrack(e.track);e.track.onended=()=>renderCall()}
    renderCall();
  };
  const recover=()=>{
    const bad=["failed","disconnected"].includes(pc.iceConnectionState)||["failed","disconnected"].includes(pc.connectionState);
    if(!bad||!shouldInitiateVoice(peerId)||rec.restartTimer||rec.restartAttempts>=2)return;
    rec.restartTimer=setTimeout(async()=>{rec.restartTimer=null;if(!state.voicePeers.has(peerId))return;rec.restartAttempts++;try{await createVoiceOffer(peerId,{iceRestart:true})}catch(err){console.warn("ICE restart voz",err)}},700);
  };
  pc.oniceconnectionstatechange=()=>{if(["connected","completed"].includes(pc.iceConnectionState))rec.restartAttempts=0;recover()};
  pc.onconnectionstatechange=()=>{if(pc.connectionState==="closed")closeVoicePeer(peerId);else recover();renderCall()};
  state.voicePeers.set(peerId,rec);return rec
}
async function resumeVoicePeerPlayback(rec){if(!rec)return;try{if(rec.gainCtx?.state==="suspended")await rec.gainCtx.resume()}catch{}try{if(rec.audio?.paused)await rec.audio.play()}catch{}try{if(rec.boostAudio?.paused)await rec.boostAudio.play()}catch{}}
async function unlockRemoteMedia(){for(const rec of state.voicePeers.values())await resumeVoicePeerPlayback(rec);if(els.remoteScreenVideo?.srcObject)try{await els.remoteScreenVideo.play()}catch{}}
function sendVoicePeerSignal(peerId,payload){send({type:state.dmCallThreadId?"dm_call_signal":"voice_signal",target_id:peerId,payload},{silent:true})}
function ensureVoicePeer(peerId){return state.voicePeers.get(peerId)||newVoicePeer(peerId)}
async function createVoiceOffer(peerId,{iceRestart=false}={}){
  const rec=ensureVoicePeer(peerId);if(rec.makingOffer)return;if(rec.pc.signalingState!=="stable"&&!iceRestart)return;rec.makingOffer=true;
  try{const offer=await rec.pc.createOffer(iceRestart?{iceRestart:true}:undefined);await rec.pc.setLocalDescription(offer);sendVoicePeerSignal(peerId,{kind:"description",description:rec.pc.localDescription.toJSON()})}
  finally{rec.makingOffer=false}
}
async function handleVoiceSignal(fromId,p){
  const rec=ensureVoicePeer(fromId);
  if(p.kind==="description"&&p.description){
    const desc=p.description;if(rec.fallbackOfferTimer){clearTimeout(rec.fallbackOfferTimer);rec.fallbackOfferTimer=null}const collision=desc.type==="offer"&&(rec.makingOffer||rec.pc.signalingState!=="stable");
    if(collision&&!rec.polite)return;
    if(collision){try{await rec.pc.setLocalDescription({type:"rollback"})}catch{}}
    await rec.pc.setRemoteDescription(desc);while(rec.pending.length){try{await rec.pc.addIceCandidate(rec.pending.shift())}catch{}}
    if(desc.type==="offer"){const answer=await rec.pc.createAnswer();await rec.pc.setLocalDescription(answer);sendVoicePeerSignal(fromId,{kind:"description",description:rec.pc.localDescription.toJSON()})}
    return;
  }
  if(p.kind==="candidate"&&p.candidate){if(rec.pc.remoteDescription){try{await rec.pc.addIceCandidate(p.candidate)}catch{}}else rec.pending.push(p.candidate)}
}
function closeVoicePeer(id){const rec=state.voicePeers.get(id);if(!rec)return;if(rec.restartTimer)clearTimeout(rec.restartTimer);if(rec.fallbackOfferTimer)clearTimeout(rec.fallbackOfferTimer);try{rec.pc.close()}catch{}if(rec.audio){rec.audio.pause();rec.audio.srcObject=null}if(rec.boostAudio){rec.boostAudio.pause();rec.boostAudio.srcObject=null}if(rec.gainCtx)rec.gainCtx.close().catch(()=>{});state.voicePeers.delete(id)}
async function renegotiateVoice(){for(const id of state.voicePeers.keys())await createVoiceOffer(id)}
function toggleMute(){if(!state.voiceStream)return;state.voiceMuted=!state.voiceMuted;const t=localAudioTrack();if(t)t.enabled=!state.voiceMuted&&!settings.pushToTalk;sendVoiceState();renderCallControls()}
function toggleDeafen(){if(!state.voiceChannelId&&!state.dmCallThreadId)return;state.voiceDeafened=!state.voiceDeafened;for(const [peerId] of state.voicePeers)applyPeerVolume(peerId);sendVoiceState();renderCallControls()}
function sendVoiceState(){send({type:state.dmCallThreadId?"dm_call_state":"voice_state",muted:state.voiceMuted,deafened:state.voiceDeafened,camera:state.voiceCamera},{silent:true})}
async function toggleCamera(){if(!state.voiceChannelId&&!state.dmCallThreadId)return toast("Entre em uma chamada primeiro.","error");if(state.voiceCamera){if(state.cameraStream)state.cameraStream.getTracks().forEach(t=>t.stop());state.cameraStream=null;state.voiceCamera=false;for(const rec of state.voicePeers.values()){const sender=rec.pc.getSenders().find(s=>s.track?.kind==="video");if(sender)try{rec.pc.removeTrack(sender)}catch{}}await renegotiateVoice();sendVoiceState();renderCall();return}try{state.cameraStream=await navigator.mediaDevices.getUserMedia({video:{deviceId:settings.cameraId?{exact:settings.cameraId}:undefined,width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}},audio:false});state.voiceCamera=true;for(const rec of state.voicePeers.values()){const track=localCameraTrack();if(track)rec.pc.addTrack(track,state.cameraStream)}await renegotiateVoice();sendVoiceState();renderCall()}catch(e){toast(`Câmera: ${e.message||e}`,"error")}}
function startSpeakingDetector(){stopSpeakingDetector();const track=localAudioTrack();if(!track)return;try{const ctx=new (window.AudioContext||window.webkitAudioContext)();const src=ctx.createMediaStreamSource(new MediaStream([track]));const an=ctx.createAnalyser();an.fftSize=512;src.connect(an);state.audioContext=ctx;state.analyser=an;const data=new Uint8Array(an.fftSize);state.speakingTimer=setInterval(()=>{an.getByteTimeDomainData(data);let sum=0;for(const x of data){const d=(x-128)/128;sum+=d*d}const rms=Math.sqrt(sum/data.length);const active=!state.voiceMuted&&rms>(settings.voiceThreshold/1000);if(active!==state.voiceSpeaking){state.voiceSpeaking=active;send({type:state.dmCallThreadId?"dm_call_speaking":"voice_speaking",active},{silent:true});updateSpeakingDom({client_id:state.clientId,user_id:state.profile?.user_id,active})}},140)}catch(e){console.warn("analyser",e)}}
function stopSpeakingDetector(){clearInterval(state.speakingTimer);state.speakingTimer=null;if(state.audioContext)state.audioContext.close().catch(()=>{});state.audioContext=null;state.analyser=null;state.voiceSpeaking=false}
function peerVolumeKey(user){return `u:${user?.user_id||user?.client_id||""}`}
function getPeerVolume(user){return Number(state.peerVolumes.get(peerVolumeKey(user))??100)}
async function ensurePeerGain(rec){
  if(!rec?.audio)return false;
  if(rec.gainNode&&rec.boostAudio)return true;
  if(rec.gainUnavailable)return false;
  let ctx=null,boostAudio=null;
  try{
    const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx){rec.gainUnavailable=true;return false}
    ctx=new Ctx({latencyHint:"interactive"});
    const source=ctx.createMediaStreamSource(rec.audioStream);
    const gain=ctx.createGain();
    const dest=ctx.createMediaStreamDestination();
    source.connect(gain).connect(dest);
    boostAudio=new Audio();boostAudio.autoplay=true;boostAudio.playsInline=true;boostAudio.srcObject=dest.stream;
    await applyAudioOutput(boostAudio);
    if(ctx.state!=="running")await ctx.resume();
    if(ctx.state!=="running")throw new Error(`AudioContext não iniciou (${ctx.state})`);
    await boostAudio.play();
    rec.gainCtx=ctx;rec.gainSource=source;rec.gainNode=gain;rec.gainDest=dest;rec.boostAudio=boostAudio;
    return true;
  }catch(err){
    try{boostAudio?.pause();if(boostAudio)boostAudio.srcObject=null}catch{}
    try{await ctx?.close()}catch{}
    rec.gainUnavailable=true;
    console.warn("Gain de volume indisponível; mantendo áudio direto em 100%",err);
    return false;
  }
}
function setPeerPlaybackMode(rec,v){
  if(!rec?.audio)return;
  const deaf=state.voiceDeafened||v===0;
  if(v>100&&rec.gainNode&&rec.boostAudio){
    rec.gainNode.gain.value=Math.max(0,Math.min(2,v/100));
    rec.audio.volume=1;
    rec.audio.muted=true;
    rec.boostAudio.muted=deaf;
  }else{
    rec.audio.volume=Math.min(1,v/100);
    rec.audio.muted=deaf;
    if(rec.boostAudio)rec.boostAudio.muted=true;
  }
}
function setPeerVolume(user,val){
  val=Math.max(0,Math.min(200,Number(val)||0));state.peerVolumes.set(peerVolumeKey(user),val);localStorage.setItem("opencall-peer-volumes",JSON.stringify(Array.from(state.peerVolumes.entries())));
  const rec=user?.client_id?state.voicePeers.get(user.client_id):null;if(!rec?.audio)return;
  if(val>100&&!rec.gainNode&&!rec.gainUnavailable){
    // Mantém o caminho direto tocando em 100% até o boost realmente estar pronto.
    rec.audio.volume=1;rec.audio.muted=state.voiceDeafened;
    ensurePeerGain(rec).then(ok=>{if(ok)setPeerPlaybackMode(rec,getPeerVolume(user));else setPeerPlaybackMode(rec,100)}).catch(()=>setPeerPlaybackMode(rec,100));
    return;
  }
  setPeerPlaybackMode(rec,val);
}
function applyPeerVolume(peerId){
  const user=voiceParticipantByClient(peerId);const rec=state.voicePeers.get(peerId);if(!rec?.audio)return;const v=getPeerVolume(user);
  if(v>100&&!rec.gainNode&&!rec.gainUnavailable){
    // Não silencia o áudio original durante a criação do AudioContext/GainNode.
    rec.audio.volume=1;rec.audio.muted=state.voiceDeafened;
    ensurePeerGain(rec).then(ok=>{if(ok)setPeerPlaybackMode(rec,v);else setPeerPlaybackMode(rec,100)}).catch(()=>setPeerPlaybackMode(rec,100));
    return;
  }
  setPeerPlaybackMode(rec,v);
}

function renderCallControls(){for(const b of [els.callMuteButton,els.miniMuteButton,els.selfMuteButton])b?.classList.toggle("active",state.voiceMuted);for(const b of [els.callDeafenButton,els.miniDeafenButton,els.selfDeafenButton])b?.classList.toggle("active",state.voiceDeafened);els.cameraButton.classList.toggle("active",state.voiceCamera);els.screenShareButton.classList.toggle("active",Boolean(state.screenStream));els.callMuteButton.querySelector("span").textContent=state.voiceMuted?"🔇":"🎙";els.callDeafenButton.querySelector("span").textContent=state.voiceDeafened?"🔇":"🎧"}
function renderCall(){
  renderCallControls();
  const dmMode=Boolean(state.dmCallThreadId),cid=Number(state.channelId);
  const users=dmMode?Array.from(state.dmCallParticipants.values()):state.presence.filter(u=>Number(u.voice?.channel_id)===cid);
  const inThis=dmMode||Number(state.voiceChannelId)===cid;
  const joining=dmMode?state.dmCallJoining:(state.voiceJoining&&Number(state.channelId)===cid);
  els.callControls?.classList?.toggle?.("hidden",!inThis&&!joining);els.callEmpty.classList.toggle("hidden",inThis||joining);els.callEmpty.classList.toggle("compact",!inThis);els.joinVoiceButton.classList.add("hidden");
  const existingCards=new Map(Array.from(els.voiceGrid.children,c=>[c.dataset.voiceClient,c]));
  const retainedCards=new Set();
  if(dmMode){els.callEmpty.querySelector("h2").textContent="Chamada privada";els.callEmpty.querySelector("p").textContent="Aguardando a outra pessoa entrar na chamada."}
  else if(!inThis){els.callEmpty.querySelector("h2").textContent=joining?"Entrando na call…":"Clique em um canal de voz para entrar";els.callEmpty.querySelector("p").textContent=joining?"Preparando microfone e conexão WebRTC…":"Agora, ao clicar no canal de voz, o OpenCall entra direto como o Discord."}
  else{els.callEmpty.querySelector("h2").textContent="Canal de voz";els.callEmpty.querySelector("p").textContent="Aguardando outras pessoas entrarem na call."}
  const display=[...users];
  if(inThis&&state.profile&&!display.some(u=>Number(u.user_id)===Number(state.profile.user_id))){display.push({client_id:state.clientId,user_id:state.profile.user_id,display_name:state.profile.display_name,avatar_media_id:state.profile.avatar_media_id,voice:{channel_id:dmMode?null:cid,muted:state.voiceMuted,deafened:state.voiceDeafened,camera:state.voiceCamera,speaking:state.voiceSpeaking},stream:state.screenStream?{session_code:state.screenSessionCode}:null})}
  for(const u of display){
    const isSelf=Number(u.user_id)===Number(state.profile?.user_id),rec=state.voicePeers.get(u.client_id),voice=u.voice||{};
    const card=existingCards.get(safeText(u.client_id||""))||document.createElement("div");retainedCards.add(card);card.className=`voice-card ${(voice.speaking||(isSelf&&state.voiceSpeaking))?"speaking":""}`;card.dataset.voiceClient=safeText(u.client_id||"");card.dataset.voiceUser=safeText(u.user_id||"");
    for(const child of Array.from(card.children))if(!child.classList.contains("camera-video"))child.remove();
    const camStream=isSelf?state.cameraStream:rec?.remoteVideoStream;
    const hasCamera=Boolean((isSelf?state.voiceCamera:voice.camera)&&camStream?.getVideoTracks().some(t=>t.readyState!=="ended"));
    card.classList.toggle("has-camera",hasCamera);
    let video=card.querySelector(".camera-video");
    if(hasCamera){if(!video){video=document.createElement("video");video.className="camera-video";video.autoplay=true;video.playsInline=true;video.muted=true;card.appendChild(video)}if(video.srcObject!==camStream)video.srcObject=camStream}
    else if(video){video.srcObject=null;video.remove()}
    const center=document.createElement("div");center.className="voice-card-center";const av=document.createElement("span");av.className="avatar voice-card-avatar";setAvatar(av,u.avatar_media_id,u.display_name,u);const name=document.createElement("strong");name.textContent=`${u.display_name||u.username||"Usuário"}${isSelf?" · você":""}`;const status=document.createElement("span");status.className="voice-card-status";status.textContent=voice.muted?"🔇 microfone desligado":voice.speaking?"falando":"na chamada";center.append(av,name,status);card.appendChild(center);
    const hasRemoteDmScreen=dmMode&&!isSelf&&state.dmAvailableScreen?.threadId===state.dmCallThreadId&&state.dmAvailableScreen?.hostId===u.client_id;const hasStream=isSelf?Boolean(state.screenStream):(dmMode?hasRemoteDmScreen:Boolean(u.stream));
    if(hasStream){const live=document.createElement("button");live.className="live-pill";live.textContent="● AO VIVO · Assistir";live.onclick=()=>isSelf?showOwnScreen():(dmMode?watchDmScreen():watchScreen(u.client_id));card.appendChild(live)}
    const foot=document.createElement("div");foot.className="voice-card-footer";foot.innerHTML=`<strong>${escapeHtml(u.display_name||u.username||"Usuário")}</strong><span>${voice.camera?"📷 ":""}${voice.muted?"🔇":"🎙"}${voice.deafened?" 🎧":""}</span>`;if(!isSelf){const more=document.createElement("button");more.textContent="⋯";more.onclick=()=>openUserDialog(u);foot.appendChild(more)}card.appendChild(foot);if(card.parentNode!==els.voiceGrid)els.voiceGrid.appendChild(card)
  }
  for(const card of existingCards.values())if(!retainedCards.has(card)){const video=card.querySelector("video");if(video)video.srcObject=null;card.remove()}
  const active=Boolean(state.voiceChannelId||state.dmCallThreadId);els.voiceMiniPanel.classList.toggle("hidden",!active);if(active){if(dmMode)els.voiceMiniChannel.textContent=`DM · ${dmThreadById(state.dmCallThreadId)?.display_name||"privada"}`;else{const ch=state.structure.channels.find(c=>Number(c.id)===Number(state.voiceChannelId));els.voiceMiniChannel.textContent=ch?.name||"Canal de voz"}}
  updateDmCallToolbar();
}

// Push-to-Talk
function setPttActive(active){if(!settings.pushToTalk||!state.voiceStream||state.voiceMuted)return;const t=localAudioTrack();if(t)t.enabled=active}
window.addEventListener("keydown",e=>{if(settings.pushToTalk&&e.code===(els.pushToTalkKey.value||"Space")&&!e.repeat){if(["INPUT","TEXTAREA"].includes(document.activeElement?.tagName))return;e.preventDefault();setPttActive(true)}});
window.addEventListener("keyup",e=>{if(settings.pushToTalk&&e.code===(els.pushToTalkKey.value||"Space")){e.preventDefault();setPttActive(false)}});

// -----------------------------------------------------------------------------
// Mini transmissão flutuante (Electron / Discord-like)
// -----------------------------------------------------------------------------
function isOwnScreenPinned(){return state.currentView==="call"&&!els.pinnedStreamPanel.classList.contains("hidden")&&els.remoteScreenVideo.srcObject===state.screenStream&&Boolean(state.screenStream)}
function updateFloatingStreamDock(){
  const active=Boolean(state.screenStream);
  if(!active){els.floatingStreamDock.classList.add("hidden");els.floatingStreamRestore.classList.add("hidden");els.floatingStreamVideo.srcObject=null;return}
  const shouldDock=!isOwnScreenPinned();
  if(!shouldDock){els.floatingStreamDock.classList.add("hidden");els.floatingStreamRestore.classList.add("hidden");return}
  els.floatingStreamViewers.textContent=`${state.screenPeers.size} assistindo`;
  els.floatingStreamState.textContent=`WebRTC · ${effectiveVideoCodec()==="auto"?"codec automático":effectiveVideoCodec()} · AO VIVO`;
  if(els.floatingStreamVideo.srcObject!==state.screenStream)els.floatingStreamVideo.srcObject=state.screenStream;
  if(state.floatingStreamHidden){els.floatingStreamDock.classList.add("hidden");els.floatingStreamRestore.classList.remove("hidden")}else{els.floatingStreamDock.classList.remove("hidden");els.floatingStreamRestore.classList.add("hidden")}
}
function openOwnStreamFromDock(){
  if(!state.screenStream)return;
  if(state.dmCallThreadId)openDmCallView();else if(state.voiceChannelId)openVoiceChannel(state.voiceChannelId);else switchView("call");
  showOwnScreen();
  requestAnimationFrame(updateFloatingStreamDock);
}
function hideFloatingStreamDock(){state.floatingStreamHidden=true;updateFloatingStreamDock()}
function restoreFloatingStreamDock(){state.floatingStreamHidden=false;updateFloatingStreamDock()}
function setupFloatingDockDrag(){
  let dragging=false,startX=0,startY=0,startLeft=0,startTop=0;
  els.floatingStreamDrag.addEventListener("pointerdown",e=>{if(e.target.closest("button"))return;const r=els.floatingStreamDock.getBoundingClientRect();dragging=true;startX=e.clientX;startY=e.clientY;startLeft=r.left;startTop=r.top;els.floatingStreamDrag.setPointerCapture?.(e.pointerId);e.preventDefault()});
  els.floatingStreamDrag.addEventListener("pointermove",e=>{if(!dragging)return;const maxL=Math.max(0,innerWidth-els.floatingStreamDock.offsetWidth),maxT=Math.max(0,innerHeight-els.floatingStreamDock.offsetHeight);const left=Math.min(maxL,Math.max(0,startLeft+e.clientX-startX)),top=Math.min(maxT,Math.max(0,startTop+e.clientY-startY));els.floatingStreamDock.style.left=`${left}px`;els.floatingStreamDock.style.top=`${top}px`;els.floatingStreamDock.style.right="auto";els.floatingStreamDock.style.bottom="auto"});
  const finish=e=>{if(!dragging)return;dragging=false;const r=els.floatingStreamDock.getBoundingClientRect();state.floatingStreamPos={left:r.left,top:r.top};localStorage.setItem("opencall-floating-stream-pos",JSON.stringify(state.floatingStreamPos));try{els.floatingStreamDrag.releasePointerCapture?.(e.pointerId)}catch{}};
  els.floatingStreamDrag.addEventListener("pointerup",finish);els.floatingStreamDrag.addEventListener("pointercancel",finish);
  try{const pos=JSON.parse(localStorage.getItem("opencall-floating-stream-pos")||"null");if(pos&&Number.isFinite(pos.left)&&Number.isFinite(pos.top)){state.floatingStreamPos=pos;els.floatingStreamDock.style.left=`${Math.max(0,pos.left)}px`;els.floatingStreamDock.style.top=`${Math.max(0,pos.top)}px`;els.floatingStreamDock.style.right="auto";els.floatingStreamDock.style.bottom="auto"}}catch{}
}

els.avatarCropStage?.addEventListener('pointerdown',e=>{ if(!state.avatarCrop.file)return; state.avatarCrop.dragging=true; state.avatarCrop.startX=e.clientX; state.avatarCrop.startY=e.clientY; state.avatarCrop.baseX=state.avatarCrop.x; state.avatarCrop.baseY=state.avatarCrop.y; els.avatarCropStage.classList.add('dragging'); els.avatarCropStage.setPointerCapture?.(e.pointerId); e.preventDefault(); });
els.avatarCropStage?.addEventListener('pointermove',e=>{if(!state.avatarCrop.dragging)return;const r=els.avatarCropStage.getBoundingClientRect();const k=AVATAR_CROP_STAGE_SIZE/Math.max(1,r.width);state.avatarCrop.x=state.avatarCrop.baseX+(e.clientX-state.avatarCrop.startX)*k;state.avatarCrop.y=state.avatarCrop.baseY+(e.clientY-state.avatarCrop.startY)*k;renderAvatarCrop()});
const finishAvatarDrag=e=>{ if(!state.avatarCrop.dragging)return; state.avatarCrop.dragging=false; els.avatarCropStage.classList.remove('dragging'); try{els.avatarCropStage.releasePointerCapture?.(e.pointerId)}catch{} };
els.avatarCropStage?.addEventListener('pointerup',finishAvatarDrag); els.avatarCropStage?.addEventListener('pointercancel',finishAvatarDrag);
els.avatarCropStage?.addEventListener('wheel',e=>{if(!state.avatarCrop.file)return;e.preventDefault();const factor=e.deltaY<0?1.08:1/1.08;state.avatarCrop.zoom=Math.max(0.65,Math.min(4,state.avatarCrop.zoom*factor));renderAvatarCrop()},{passive:false});

// -----------------------------------------------------------------------------
// Compartilhamento de tela WebRTC (múltiplos transmissores por canal)
// -----------------------------------------------------------------------------
function effectiveVideoCodec(){
  if(settings.videoCodec!=="auto")return settings.videoCodec;
  // Tonga/Polaris usam VCE e oferecem H.264 por hardware. Em "Auto", o WebRTC
  // costuma priorizar VP8; nessas GPUs isso vira encode por software. Quando o
  // usuário escolheu uma dessas AMD como encoder no Desktop/GPU, preferimos H.264.
  const profile=state.desktop?.profile||{};
  if(profile.encoderMode!=="hardware")return "auto";
  const gpu=(state.desktop?.gpus||[]).find(g=>g.id===profile.encoderGpuId);
  if(gpu?.vendor==="1002"&&["6939","67df"].includes(String(gpu.device||"").toLowerCase()))return "H264";
  return "auto";
}
function preferredCodec(pc,sender){const wanted=effectiveVideoCodec();if(wanted==="auto"||!sender?.track||sender.track.kind!=="video")return;try{const caps=RTCRtpSender.getCapabilities?.("video");const codec=caps?.codecs?.find(c=>c.mimeType?.toUpperCase()===`VIDEO/${wanted}`.toUpperCase());if(!codec)return;const trans=pc.getTransceivers().find(t=>t.sender===sender);if(trans?.setCodecPreferences)trans.setCodecPreferences([codec,...caps.codecs.filter(c=>c!==codec)])}catch(e){console.warn(e)}}
function applyScreenTrackQualityHint(track,mode=settings.screenQualityMode){
  if(!track||track.kind!=="video")return;
  mode=normalizeScreenQualityMode(mode);
  try{track.contentHint=mode==="quality"?"detail":"motion"}catch{}
}
const screenSenderUpdates=new WeakMap();
function updateScreenSender(sender,update){
  const previous=screenSenderUpdates.get(sender)||Promise.resolve();
  const next=previous.catch(()=>{}).then(()=>update(sender.getParameters()));
  screenSenderUpdates.set(sender,next);
  return next;
}
async function configureScreenSender(sender,profile=screenProfileFromSettings(),qualityMode=settings.screenQualityMode){
  if(!sender?.track||sender.track.kind!=="video")return;
  profile=normalizeScreenProfile(profile);qualityMode=normalizeScreenQualityMode(qualityMode);const target=SCREEN_RESOLUTIONS[profile.resolution];
  applyScreenTrackQualityHint(sender.track,qualityMode);
  try{
    await updateScreenSender(sender,async p=>{
    if(!p.encodings?.length)p.encodings=[{}];
    const enc=p.encodings[0];
    enc.maxBitrate=Math.round(profile.bitrateMbps*1_000_000);
    enc.maxFramerate=profile.fps;
    const s=sender.track.getSettings?.()||{};
    const srcW=Number(s.width)||target.width,srcH=Number(s.height)||target.height;
    const down=Math.max(1,srcW/Math.max(1,target.width),srcH/Math.max(1,target.height));
    enc.scaleResolutionDownBy=down>1.02?down:1;
    // Áudio de chamada mantém precedência sobre vídeo durante congestionamento.
    enc.priority="medium";enc.networkPriority="medium";
    // Para captura de tela, "maintain-framerate" permite que o Chromium derrube
    // a resolução durante movimento/congestionamento. O modo Qualidade fixa a
    // prioridade em resolução; Fluidez conserva o comportamento antigo.
    p.degradationPreference=qualityMode==="quality"?"maintain-resolution":qualityMode==="smooth"?"maintain-framerate":"balanced";
    await sender.setParameters(p);
    });
  }catch(e){console.warn("Falha ao atualizar parâmetros da transmissão",e)}
}
async function applyScreenProfile(profile,{notify=true,reconfigureCapture=true}={}){
  profile=normalizeScreenProfile(profile);settings.screenProfile=profile;saveSettings();syncScreenProfileControls(profile);
  const target=SCREEN_RESOLUTIONS[profile.resolution];const track=state.screenStream?.getVideoTracks?.()[0];
  let constraintNote="";
  if(track&&reconfigureCapture&&typeof track.applyConstraints==="function"){
    try{
      // Só roda quando o host aperta Aplicar. Não existe polling/reconfiguração contínua.
      await track.applyConstraints({width:{ideal:target.width,max:target.width},height:{ideal:target.height,max:target.height},frameRate:{ideal:profile.fps,max:profile.fps}});
    }catch(e){console.warn("A fonte não aceitou todos os constraints solicitados",e);constraintNote=" · limite da fonte/driver"}
  }
  applyScreenTrackQualityHint(track,settings.screenQualityMode);
  for(const rec of state.screenPeers.values()){
    const sender=rec.pc.getSenders().find(s=>s.track?.kind==="video");
    if(sender)await configureScreenSender(sender,profile,settings.screenQualityMode);
  }
  updateStreamContextQuality();
  if(notify){
    const actual=track?.getSettings?.()||{};const aw=Math.round(Number(actual.width)||0),ah=Math.round(Number(actual.height)||0),af=Math.round(Number(actual.frameRate)||0);
    const actualNote=track&&aw&&ah?` · captura ${aw}×${ah}${af?` @ ${af} FPS`:""}`:"";
    toast(`Transmissão: ${screenProfileLabel(profile)}${actualNote}${constraintNote}`,"success",4800);
  }
}
function syncScreenProfileControls(profile=screenProfileFromSettings()){
  profile=normalizeScreenProfile(profile);
  if(els.screenResolutionSelect)els.screenResolutionSelect.value=profile.resolution;
  if(els.screenFpsInput)els.screenFpsInput.value=String(profile.fps);
  if(els.screenBitrateInput)els.screenBitrateInput.value=String(profile.bitrateMbps);
  if(els.hostResolutionSelect)els.hostResolutionSelect.value=profile.resolution;
  if(els.hostFpsInput)els.hostFpsInput.value=String(profile.fps);
  if(els.hostBitrateInput)els.hostBitrateInput.value=String(profile.bitrateMbps);
  if(els.hostQualitySummary)els.hostQualitySummary.textContent=screenProfileLabel(profile);
}
function readHostScreenProfile(){return normalizeScreenProfile({resolution:els.hostResolutionSelect?.value,fps:els.hostFpsInput?.value,bitrateMbps:els.hostBitrateInput?.value})}
function streamVolumeKey(hostId){return `host:${safeText(hostId||"")}`}
function getStreamVolume(hostId){return Math.max(0,Math.min(100,Number(state.streamVolumes.get(streamVolumeKey(hostId))??100)))}
function setStreamVolume(hostId,value){
  if(!hostId)return;value=Math.max(0,Math.min(100,Number(value)||0));
  const key=streamVolumeKey(hostId);state.streamVolumes.set(key,value);localStorage.setItem(STREAM_VOLUME_KEY,JSON.stringify(Array.from(state.streamVolumes.entries())));
  if(value>0)state.streamLastNonZero.set(key,value);
  if(state.viewingHostId===hostId&&els.remoteScreenVideo.srcObject){els.remoteScreenVideo.volume=value/100;els.remoteScreenVideo.muted=value===0}
  els.streamVolumeSlider.value=String(value);els.streamVolumeValue.textContent=`${Math.round(value)}%`;els.streamMuteToggle.textContent=value===0?"🔊 Ativar áudio":"🔇 Silenciar transmissão";
}
function applyCurrentStreamVolume(){if(!state.viewingHostId)return;setStreamVolume(state.viewingHostId,getStreamVolume(state.viewingHostId))}
function updateStreamContextQuality(){syncScreenProfileControls(screenProfileFromSettings())}
function closeScreenContextMenu(){els.screenContextMenu.classList.add("hidden")}
function placeScreenContextMenu(x,y){
  els.screenContextMenu.classList.remove("hidden");
  const r=els.screenContextMenu.getBoundingClientRect();
  const left=Math.max(6,Math.min(x,innerWidth-r.width-6)),top=Math.max(6,Math.min(y,innerHeight-r.height-6));
  els.screenContextMenu.style.left=`${left}px`;els.screenContextMenu.style.top=`${top}px`;
}
function openScreenContextMenu(event,mode){
  event.preventDefault();event.stopPropagation();
  els.hostQualityMenu.classList.toggle("hidden",mode!=="host");els.viewerVolumeMenu.classList.toggle("hidden",mode!=="viewer");
  if(mode==="host"){els.screenContextTitle.textContent="Sua transmissão";els.screenContextSubtitle.textContent="Resolução, FPS e bitrate enviados aos espectadores";updateStreamContextQuality()}
  else{const host=currentPresenceByClient(state.viewingHostId);els.screenContextTitle.textContent=host?.display_name||"Transmissão";els.screenContextSubtitle.textContent="Volume somente para você";const v=getStreamVolume(state.viewingHostId);els.streamVolumeSlider.value=String(v);els.streamVolumeValue.textContent=`${Math.round(v)}%`;els.streamMuteToggle.textContent=v===0?"🔊 Ativar áudio":"🔇 Silenciar transmissão"}
  placeScreenContextMenu(event.clientX,event.clientY);
}
function viewerFullscreenActive(){
  if(window.openCallDesktop?.setViewerFullscreen)return Boolean(state.viewerFullscreen);
  return document.fullscreenElement===els.pinnedStreamPanel;
}
function updateViewerFullscreenUi(){
  const active=viewerFullscreenActive();
  if(els.fullscreenStreamButton){els.fullscreenStreamButton.textContent="⛶";els.fullscreenStreamButton.title=active?"Sair da tela cheia":"Tela cheia";els.fullscreenStreamButton.setAttribute("aria-label",els.fullscreenStreamButton.title)}
  if(els.streamFullscreenToggle)els.streamFullscreenToggle.textContent=active?"⛶ Sair da tela cheia":"⛶ Abrir em tela cheia";
  els.pinnedStreamPanel.classList.toggle("viewer-fullscreen",active);
}
function setViewerFullscreenState(active){state.viewerFullscreen=Boolean(active);updateViewerFullscreenUi()}
async function toggleViewerFullscreen(){
  if(!state.viewingHostId||!els.remoteScreenVideo.srcObject)return;
  closeScreenContextMenu();
  try{
    if(window.openCallDesktop?.setViewerFullscreen){
      const desired=!viewerFullscreenActive();
      const result=await window.openCallDesktop.setViewerFullscreen(desired);
      setViewerFullscreenState(Boolean(result));
    }else{
      if(document.fullscreenElement===els.pinnedStreamPanel)await document.exitFullscreen();
      else await els.pinnedStreamPanel.requestFullscreen({navigationUI:"hide"});
    }
  }catch(e){toast(`Tela cheia: ${e.message||e}`,"error")}
}
function screenSignalPayload(rec,payload={}){
  return {...payload,screen_protocol:2,stream_host_id:rec.streamHostId,session_code:rec.sessionCode||""};
}
function sendScreenPeerSignal(rec,payload){
  if(!rec?.peerId)return;
  const body=screenSignalPayload(rec,payload);
  if(rec.scope==="dm")send({type:"dm_screen_signal",thread_id:state.dmCallThreadId,target_id:rec.peerId,code:rec.sessionCode||state.screenSessionCode||state.viewingSessionCode||"",payload:body},{silent:true});
  else send({type:"signal",target_id:rec.peerId,payload:body},{silent:true});
}
// v0.7.59 - diagnóstico WebRTC de transmissão no terminal --------------------
const WEBRTC_DIAG_INTERVAL_MS=1000;
function rtcDiagNum(v){v=Number(v);return Number.isFinite(v)?v:null}
function rtcDiagInt(v){const n=rtcDiagNum(v);return n===null?"n/d":String(Math.round(n))}
function rtcDiagMbps(v){const n=rtcDiagNum(v);return n===null?"n/d":`${n.toFixed(n>=10?1:2)}Mbps`}
function rtcDiagMs(v){const n=rtcDiagNum(v);return n===null?"n/d":`${Math.round(n*1000)}ms`}
function rtcDiagPeer(peerId){const v=safeText(peerId||"");return v.length>16?`${v.slice(0,8)}…${v.slice(-5)}`:v}
function sendRtcTerminalDiag(side,rec,line){
  const payload={side,peer:rtcDiagPeer(rec?.peerId),line};
  try{if(window.openCallDesktop?.logWebrtcStats){window.openCallDesktop.logWebrtcStats(payload);return}}catch{}
  console.log(`[WebRTC ${side}]`,payload.peer,line);
}
function rtcDiagDelta(rec,key,value,now){
  if(!rec.rtcDiagPrev)rec.rtcDiagPrev={};
  const n=rtcDiagNum(value),prev=rec.rtcDiagPrev[key];
  rec.rtcDiagPrev[key]={v:n,t:now};
  if(n===null||!prev||prev.v===null)return null;
  return {value:n-prev.v,seconds:Math.max(.001,(now-prev.t)/1000)};
}
function rtcDiagCodec(report,byId){
  const c=report?.codecId?byId.get(report.codecId):null;
  if(!c)return "n/d";
  const mime=safeText(c.mimeType||"").replace(/^video\//i,"")||"?";
  const fmt=safeText(c.sdpFmtpLine||"");
  const profile=(fmt.match(/profile-level-id=([^;]+)/i)||[])[1];
  return profile?`${mime}[${profile}]`:mime;
}
function rtcDiagDupValue(report){
  for(const k of ["framesDuplicated","framesRepeated","duplicateFrames","duplicatedFrames","framesRepeatedByEncoder"]){
    const n=rtcDiagNum(report?.[k]);if(n!==null)return {key:k,value:n};
  }
  return null;
}
function startRemoteFrameTimingDiag(rec){
  const video=els.remoteScreenVideo;
  if(!rec||rec.role!=="viewer"||!video||typeof video.requestVideoFrameCallback!=="function")return;
  rec.rtcVideoTimingToken=(rec.rtcVideoTimingToken||0)+1;
  const token=rec.rtcVideoTimingToken;
  rec.rtcVideoTiming={callbacks:0,repeated:0,presentedGaps:0,lastMediaTime:null,lastPresented:null};
  const loop=(_now,meta={})=>{
    if(rec.rtcVideoTimingToken!==token||state.viewerPeer!==rec)return;
    const d=rec.rtcVideoTiming;d.callbacks++;
    const pf=rtcDiagNum(meta.presentedFrames),mt=rtcDiagNum(meta.mediaTime);
    if(d.lastPresented!==null&&pf!==null){const jump=pf-d.lastPresented;if(jump>1)d.presentedGaps+=jump-1}
    if(d.lastMediaTime!==null&&mt!==null&&Math.abs(mt-d.lastMediaTime)<1e-7)d.repeated++;
    if(pf!==null)d.lastPresented=pf;if(mt!==null)d.lastMediaTime=mt;
    video.requestVideoFrameCallback(loop);
  };
  video.requestVideoFrameCallback(loop);
}
function stopScreenPeerDiagnostics(rec){
  if(!rec)return;
  if(rec.rtcDiagTimer){clearInterval(rec.rtcDiagTimer);rec.rtcDiagTimer=null}
  rec.rtcVideoTimingToken=(rec.rtcVideoTimingToken||0)+1;
}
async function collectScreenPeerDiagnostics(rec){
  if(!rec?.pc||rec.pc.connectionState==="closed"||rec.rtcDiagBusy)return;
  rec.rtcDiagBusy=true;
  try{
    const stats=await rec.pc.getStats(),reports=[];stats.forEach(x=>reports.push(x));const byId=new Map(reports.map(x=>[x.id,x]));
    const now=performance.now();
    const kindOf=x=>safeText(x.kind||x.mediaType||"").toLowerCase();
    const transport=reports.find(x=>x.type==="transport"&&x.selectedCandidatePairId)||null;
    const pair=(transport?.selectedCandidatePairId?byId.get(transport.selectedCandidatePairId):null)||reports.find(x=>x.type==="candidate-pair"&&(x.selected||x.nominated)&&x.state==="succeeded")||null;
    if(rec.role==="host"){
      const out=reports.find(x=>x.type==="outbound-rtp"&&!x.isRemote&&kindOf(x)==="video");if(!out)return;
      const remote=(out.remoteId&&byId.get(out.remoteId))||reports.find(x=>x.type==="remote-inbound-rtp"&&kindOf(x)==="video"&&(x.localId===out.id||x.ssrc===out.ssrc))||null;
      const src=(out.mediaSourceId&&byId.get(out.mediaSourceId))||reports.find(x=>x.type==="media-source"&&kindOf(x)==="video")||null;
      const bytes=rtcDiagDelta(rec,"txBytes",out.bytesSent,now),enc=rtcDiagDelta(rec,"txEncoded",out.framesEncoded,now),sent=rtcDiagDelta(rec,"txSent",out.framesSent,now),qp=rtcDiagDelta(rec,"txQp",out.qpSum,now);
      const bitrate=bytes?bytes.value*8/bytes.seconds/1e6:null,fps=enc?enc.value/enc.seconds:rtcDiagNum(out.framesPerSecond);
      const qpAvg=(qp&&enc&&enc.value>0)?qp.value/enc.value:null,dup=rtcDiagDupValue(out);
      const res=(out.frameWidth&&out.frameHeight)?`${out.frameWidth}x${out.frameHeight}`:"n/d";
      const sourceFps=rtcDiagNum(src?.framesPerSecond),sourceFrames=rtcDiagNum(src?.frames);
      const loss=rtcDiagNum(remote?.packetsLost),rtt=rtcDiagNum(remote?.roundTripTime)??rtcDiagNum(pair?.currentRoundTripTime);
      const avail=rtcDiagNum(pair?.availableOutgoingBitrate);const qlr=safeText(out.qualityLimitationReason||"none");
      const dropEnc=rtcDiagNum(out.framesDroppedByEncoder)??rtcDiagNum(out.framesDiscardedOnSend);
      const line=[`conn=${rec.pc.connectionState}/${rec.pc.iceConnectionState}`,`codec=${rtcDiagCodec(out,byId)}`,`res=${res}`,`fps=${fps===null?"n/d":fps.toFixed(1)}`,`bitrate=${rtcDiagMbps(bitrate)}`,`framesEnc=${rtcDiagInt(out.framesEncoded)}${enc?`(+${Math.round(enc.value)})`:""}`,`framesSent=${rtcDiagInt(out.framesSent)}${sent?`(+${Math.round(sent.value)})`:""}`,`dropEnc=${rtcDiagInt(dropEnc)}`,`dup=${dup?rtcDiagInt(dup.value):"n/d"}`,`key=${rtcDiagInt(out.keyFramesEncoded)}`,`QP=${qpAvg===null?"n/d":qpAvg.toFixed(1)}`,`srcFrames=${rtcDiagInt(sourceFrames)}`,`srcFps=${sourceFps===null?"n/d":sourceFps.toFixed(1)}`,`pktLostRemote=${rtcDiagInt(loss)}`,`NACK=${rtcDiagInt(out.nackCount)}`,`PLI=${rtcDiagInt(out.pliCount)}`,`RTT=${rtcDiagMs(rtt)}`,`availOut=${avail===null?"n/d":rtcDiagMbps(avail/1e6)}`,`limit=${qlr}`].join(" ");
      sendRtcTerminalDiag("TX",rec,line);
    }else{
      const inc=reports.find(x=>x.type==="inbound-rtp"&&!x.isRemote&&kindOf(x)==="video");if(!inc)return;
      const bytes=rtcDiagDelta(rec,"rxBytes",inc.bytesReceived,now),dec=rtcDiagDelta(rec,"rxDecoded",inc.framesDecoded,now),recv=rtcDiagDelta(rec,"rxReceived",inc.framesReceived,now);
      const bitrate=bytes?bytes.value*8/bytes.seconds/1e6:null,fps=dec?dec.value/dec.seconds:rtcDiagNum(inc.framesPerSecond);const dup=rtcDiagDupValue(inc);
      const res=(inc.frameWidth&&inc.frameHeight)?`${inc.frameWidth}x${inc.frameHeight}`:"n/d";
      let playbackDrop=null,totalVideo=null;try{const q=els.remoteScreenVideo?.getVideoPlaybackQuality?.();if(q){playbackDrop=rtcDiagNum(q.droppedVideoFrames);totalVideo=rtcDiagNum(q.totalVideoFrames)}}catch{}
      const timing=rec.rtcVideoTiming||{};
      const line=[`conn=${rec.pc.connectionState}/${rec.pc.iceConnectionState}`,`codec=${rtcDiagCodec(inc,byId)}`,`res=${res}`,`fps=${fps===null?"n/d":fps.toFixed(1)}`,`bitrate=${rtcDiagMbps(bitrate)}`,`framesRecv=${rtcDiagInt(inc.framesReceived)}${recv?`(+${Math.round(recv.value)})`:""}`,`framesDec=${rtcDiagInt(inc.framesDecoded)}${dec?`(+${Math.round(dec.value)})`:""}`,`dropRx=${rtcDiagInt(inc.framesDropped)}`,`dropPlayer=${rtcDiagInt(playbackDrop)}`,`videoFrames=${rtcDiagInt(totalVideo)}`,`dup=${dup?rtcDiagInt(dup.value):"n/d"}`,`repeatEst=${rtcDiagInt(timing.repeated)}`,`presentGaps=${rtcDiagInt(timing.presentedGaps)}`,`key=${rtcDiagInt(inc.keyFramesDecoded)}`,`pktLost=${rtcDiagInt(inc.packetsLost)}`,`jitter=${rtcDiagMs(inc.jitter)}`,`NACK=${rtcDiagInt(inc.nackCount)}`,`PLI=${rtcDiagInt(inc.pliCount)}`,`freeze=${rtcDiagInt(inc.freezeCount)}`].join(" ");
      sendRtcTerminalDiag("RX",rec,line);
    }
  }catch(e){sendRtcTerminalDiag(rec.role==="host"?"TX":"RX",rec,`stats_error=${safeText(e?.message||e)}`)}finally{rec.rtcDiagBusy=false}
}
function startScreenPeerDiagnostics(rec){
  if(!rec||rec.rtcDiagTimer)return;
  rec.rtcDiagPrev={};
  setTimeout(()=>collectScreenPeerDiagnostics(rec),350);
  rec.rtcDiagTimer=setInterval(()=>collectScreenPeerDiagnostics(rec),WEBRTC_DIAG_INTERVAL_MS);
}
// -----------------------------------------------------------------------------
function newScreenPeer(role,peerId,sessionCode=""){
  const pc=new RTCPeerConnection({iceServers:iceServers(),iceCandidatePoolSize:8,bundlePolicy:"max-bundle"});
  // Uma mesma dupla pode manter DUAS conexões de tela simultâneas:
  // A -> B (A host) e B -> A (B host). O stream_host_id separa esses fluxos.
  const streamHostId=role==="host"?state.clientId:peerId;
  const rec={pc,peerId,role,streamHostId,scope:state.screenScope||(safeText(sessionCode).startsWith("DM-")?"dm":"voice"),sessionCode:safeText(sessionCode||""),pending:[],remoteStream:new MediaStream(),restartAttempts:0,restartTimer:null};
  startScreenPeerDiagnostics(rec);
  pc.onicecandidate=e=>{if(e.candidate)sendScreenPeerSignal(rec,{kind:"candidate",candidate:e.candidate.toJSON()})};
  const update=()=>{
    const cs=pc.connectionState,is=pc.iceConnectionState;const connected=["connected","completed"].includes(cs)||["connected","completed"].includes(is);const bad=["failed","disconnected"].includes(cs)||["failed","disconnected"].includes(is);
    if(connected){rec.restartAttempts=0;if(rec.restartTimer){clearTimeout(rec.restartTimer);rec.restartTimer=null}if(role==="host")scheduleScreenKeyFrames(rec)}
    if(role==="viewer"&&state.viewingHostId===peerId)els.streamStateLabel.textContent=connected?"WebRTC conectado":bad?"Reconectando WebRTC…":"Conectando WebRTC…";
    if(bad&&!rec.restartTimer&&rec.restartAttempts<2){rec.restartTimer=setTimeout(()=>{rec.restartTimer=null;rec.restartAttempts++;if(role==="viewer"&&state.viewingHostId===peerId){if(rec.scope==="dm")send({type:"dm_screen_join",thread_id:state.dmCallThreadId,code:rec.sessionCode},{silent:true});else send({type:"join_host",host_id:peerId},{silent:true})}else if(role==="host"&&state.screenPeers.get(peerId)===rec&&state.screenStream){createScreenOffer(peerId).catch(err=>console.warn("Retry transmissão",err))}},900)}
    if(cs==="closed"){role==="host"?closeScreenHostPeer(peerId):closeScreenViewer(false)}
  };
  pc.oniceconnectionstatechange=update;pc.onconnectionstatechange=update;return rec
}
function updateStreamSetupSummary(){const p=normalizeScreenProfile({resolution:els.streamSetupResolution?.value,fps:els.streamSetupFps?.value,bitrateMbps:els.streamSetupBitrate?.value}),q=normalizeScreenQualityMode(els.streamSetupQualityMode?.value||settings.screenQualityMode);if(els.streamSetupSummary)els.streamSetupSummary.textContent=`${screenProfileLabel(p)} · ${screenQualityModeLabel(q)} · ${els.streamSetupAudio?.checked?"com áudio do sistema":"sem áudio do sistema"}`}
function configureScreenShare(){
  const p=screenProfileFromSettings();els.streamSetupResolution.value=p.resolution;els.streamSetupFps.value=p.fps;els.streamSetupBitrate.value=p.bitrateMbps;if(els.streamSetupQualityMode)els.streamSetupQualityMode.value=normalizeScreenQualityMode(settings.screenQualityMode);els.streamSetupAudio.checked=settings.shareSystemAudio!==false;updateStreamSetupSummary();
  return new Promise(resolve=>{state.desktop.streamSetupResolve=resolve;if(!els.streamSetupDialog.open)els.streamSetupDialog.showModal()});
}
async function startScreenShare(){if(state.screenStream){stopScreenShare(true);return}if(!state.voiceChannelId&&!state.dmCallThreadId)return toast("Entre em uma chamada antes de transmitir.","error");const dmMode=Boolean(state.dmCallThreadId);const setup=await configureScreenShare();if(!setup)return;try{await stopDesktopSystemAudio();const profile=normalizeScreenProfile(setup.profile),target=SCREEN_RESOLUTIONS[profile.resolution];settings.screenProfile=profile;settings.screenQualityMode=normalizeScreenQualityMode(setup.qualityMode||settings.screenQualityMode);settings.shareSystemAudio=Boolean(setup.shareSystemAudio);saveSettings();syncScreenProfileControls(profile);const stream=await requestDesktopDisplayMedia({video:{frameRate:{ideal:profile.fps,max:profile.fps},width:{ideal:target.width,max:target.width},height:{ideal:target.height,max:target.height}},audio:setup.shareSystemAudio!==false});state.screenScope=dmMode?"dm":"voice";state.screenStream=stream;state.floatingStreamHidden=false;els.localScreenPreview.srcObject=stream;els.floatingStreamVideo.srcObject=stream;const track=stream.getVideoTracks()[0];if(track){applyScreenTrackQualityHint(track,settings.screenQualityMode);track.addEventListener("ended",()=>stopScreenShare(true),{once:true})}if(dmMode)send({type:"dm_screen_start",thread_id:state.dmCallThreadId});else send({type:"create_session",channel_id:state.voiceChannelId,guild_id:state.guildId});renderCallControls();renderCall();updateFloatingStreamDock();const hasAudio=stream.getAudioTracks().length>0;const actual=track?.getSettings?.()||{};toast(`${hasAudio?"Tela + áudio do sistema":"Tela"} ao vivo · ${screenProfileLabel(profile)}${actual.width&&actual.height?` · fonte ${actual.width}×${actual.height}`:""}`,hasAudio?"success":"info",5000)}catch(e){await stopDesktopSystemAudio();state.screenScope=null;if(e.name!=="NotAllowedError"&&e.name!=="AbortError")toast(`Tela: ${e.message||e}`,"error")}}
function stopScreenShare(notify=true){
  const oldStream=state.screenStream;
  const wasShowingOwnStream=Boolean(oldStream&&els.remoteScreenVideo?.srcObject===oldStream);
  if(notify&&state.screenSessionCode)send({type:state.screenScope==="dm"?"dm_screen_stop":"end_session"},{silent:true});
  if(oldStream)oldStream.getTracks().forEach(t=>t.stop());
  state.screenStream=null;
  state.screenSessionCode=null;
  state.floatingStreamHidden=false;
  els.localScreenPreview.srcObject=null;
  els.floatingStreamVideo.srcObject=null;
  if(wasShowingOwnStream){
    if(viewerFullscreenActive()){if(window.openCallDesktop?.setViewerFullscreen){window.openCallDesktop.setViewerFullscreen(false).catch(()=>{});setViewerFullscreenState(false)}else document.exitFullscreen().catch(()=>{})};
    els.remoteScreenVideo.srcObject=null;
    els.remoteScreenVideo.muted=false;
    els.pinnedStreamPanel.classList.add("hidden");
    els.fullscreenStreamButton?.classList.add("hidden");
    closeScreenContextMenu();
  }
  stopDesktopSystemAudio();
  for(const id of Array.from(state.screenPeers.keys()))closeScreenHostPeer(id);
  els.localScreenPreviewWrap.classList.add("hidden");
  if(!state.viewerPeer)state.screenScope=null;
  renderCallControls();
  renderCall();
  updateFloatingStreamDock();
}
async function requestScreenKeyFrame(rec){
  if(!rec?.pc||rec.role!=="host")return;
  const sender=rec.pc.getSenders().find(s=>s.track?.kind==="video");if(!sender)return;
  try{
    await updateScreenSender(sender,async p=>{
    const count=Math.max(1,p.encodings?.length||1);
    const opts={encodingOptions:Array.from({length:count},()=>({keyFrame:true}))};
    const r=sender.setParameters(p,opts);if(r?.then)await r;
    });
  }catch(e){console.debug("Pedido de keyframe não suportado/adiado",e?.message||e)}
}
function scheduleScreenKeyFrames(rec){
  if(!rec||rec.role!=="host"||rec.keyframeBurstStarted)return;
  rec.keyframeBurstStarted=true;rec.keyframeTimers=[];
  for(const delay of [0,220,700,1500])rec.keyframeTimers.push(setTimeout(()=>requestScreenKeyFrame(rec),delay));
}
function likelyGreenVideoFrame(video){
  try{
    if(!video||video.readyState<2||!video.videoWidth||!video.videoHeight)return true;
    const c=likelyGreenVideoFrame.canvas||(likelyGreenVideoFrame.canvas=document.createElement("canvas"));c.width=32;c.height=18;
    const x=c.getContext("2d",{willReadFrequently:true});x.drawImage(video,0,0,32,18);const d=x.getImageData(0,0,32,18).data;
    let green=0,total=0;for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2];if(g>70&&g>r*2.2&&g>b*2.2)green++;total++}
    return green/Math.max(1,total)>.72;
  }catch{return false}
}
function gateRemoteScreenFirstFrame(rec){
  const video=els.remoteScreenVideo;if(!rec||state.viewerPeer!==rec||!video)return;
  if(rec.firstFrameShown||rec.frameGateStarted)return;
  rec.frameGateStarted=true;
  rec.frameGateToken=(rec.frameGateToken||0)+1;const token=rec.frameGateToken,start=performance.now();
  video.style.opacity="0";video.style.background="#05070a";
  setTimeout(()=>{if(state.viewerPeer===rec&&rec.frameGateToken===token){rec.firstFrameShown=true;video.style.opacity="1"}},5500);
  const check=()=>{
    if(state.viewerPeer!==rec||rec.frameGateToken!==token)return;
    const elapsed=performance.now()-start;
    if(video.readyState>=2&&video.videoWidth&&video.videoHeight&&!likelyGreenVideoFrame(video)){
      rec.firstFrameShown=true;video.style.opacity="1";els.streamStateLabel.textContent="WebRTC conectado";return;
    }
    if(elapsed>5500){rec.firstFrameShown=true;video.style.opacity="1";return}
    els.streamStateLabel.textContent=rec.pc.connectionState==="connected"?"WebRTC conectado · preparando primeiro quadro…":"Conectando WebRTC…";
    if(typeof video.requestVideoFrameCallback==="function")video.requestVideoFrameCallback(()=>check());else setTimeout(check,80);
  };
  setTimeout(check,0);
}
async function createScreenOffer(viewerId){
  if(!state.screenStream)return;closeScreenHostPeer(viewerId);const rec=newScreenPeer("host",viewerId,state.screenSessionCode);state.screenPeers.set(viewerId,rec);
  const videoSenders=[];
  for(const track of state.screenStream.getTracks()){
    const sender=rec.pc.addTrack(track,state.screenStream);
    if(track.kind==="video"){preferredCodec(rec.pc,sender);videoSenders.push(sender)}
  }
  // Não bloquear o SDP esperando setParameters/VA-API. O WebRTC começa a negociar
  // imediatamente; bitrate/FPS são aplicados logo depois em paralelo.
   const offer=await rec.pc.createOffer();
   if(state.screenPeers.get(viewerId)!==rec)return;
   await rec.pc.setLocalDescription(offer);
   if(state.screenPeers.get(viewerId)!==rec)return;
   sendScreenPeerSignal(rec,{kind:"description",description:rec.pc.localDescription.toJSON()});
  for(const sender of videoSenders)configureScreenSender(sender).catch(e=>console.warn("Configuração tardia do sender",e));
}
function closeScreenHostPeer(id){const r=state.screenPeers.get(id);if(!r)return;if(r.restartTimer)clearTimeout(r.restartTimer);for(const t of r.keyframeTimers||[])clearTimeout(t);stopScreenPeerDiagnostics(r);try{r.pc.close()}catch{}state.screenPeers.delete(id);updateFloatingStreamDock()}
async function playRemoteScreen(){if(!els.remoteScreenVideo?.srcObject)return;try{await els.remoteScreenVideo.play()}catch(err){console.warn("Playback da transmissão aguardando liberação",err)}}
function ensureScreenViewerPeer(hostId){
  const code=state.viewingSessionCode,scope=state.screenScope;
  if(state.viewerPeer?.peerId===hostId&&state.viewerPeer.pc.connectionState!=="closed"&&state.viewerPeer.sessionCode===code)return state.viewerPeer;
  closeScreenViewer(false);
  state.viewingHostId=hostId;state.viewingSessionCode=code;state.screenScope=scope;
  const rec=newScreenPeer("viewer",hostId,code);
  state.viewerPeer=rec;
  rec.pc.ontrack=e=>{
    if(state.viewerPeer!==rec)return;
    if(e.streams?.[0])rec.remoteStream=e.streams[0];
    else if(!rec.remoteStream.getTracks().some(t=>t.id===e.track.id))rec.remoteStream.addTrack(e.track);
    if(els.remoteScreenVideo.srcObject!==rec.remoteStream)els.remoteScreenVideo.srcObject=rec.remoteStream;
    if(e.track.kind==="video")startRemoteFrameTimingDiag(rec);
    e.track.onunmute=()=>{if(state.viewerPeer===rec){playRemoteScreen();gateRemoteScreenFirstFrame(rec)}};
    showPinnedScreen();playRemoteScreen();gateRemoteScreenFirstFrame(rec);
  };
  return rec;
}
function screenPeerForIncomingSignal(from,p={}){
  const streamHostId=safeText(p.stream_host_id||"");
  const sessionCode=safeText(p.session_code||"");
  if(streamHostId){
    // Sinal da transmissão que NÓS hospedamos: deve ir ao peer host-side.
    if(streamHostId===state.clientId){
      const rec=state.screenPeers.get(from)||null;
      if(rec&&sessionCode&&rec.sessionCode&&sessionCode!==rec.sessionCode)return null;
      return rec;
    }
    // Sinal da transmissão do OUTRO usuário que estamos assistindo: viewer-side.
    if(streamHostId===from&&state.viewingHostId===from){
      if(sessionCode&&state.viewingSessionCode&&sessionCode!==state.viewingSessionCode)return null;
      const rec=ensureScreenViewerPeer(from);
      if(sessionCode)rec.sessionCode=sessionCode;
      return rec;
    }
    return null;
  }
  // Compatibilidade com clientes antigos. Description permite distinguir oferta/resposta;
  // candidatos antigos continuam pelo caminho único quando só existe um fluxo entre a dupla.
  if(p.description?.type==="offer"&&state.viewingHostId===from)return ensureScreenViewerPeer(from);
  if(p.description?.type==="answer")return state.screenPeers.get(from)||null;
  const hostRec=state.screenPeers.get(from)||null,viewerRec=state.viewingHostId===from?state.viewerPeer:null;
  if(hostRec&&viewerRec){console.warn("Sinal de tela legado ambíguo entre dois transmissores; aguardando sinal protocol v2",from);return null}
  return hostRec||viewerRec||(state.viewingHostId===from?ensureScreenViewerPeer(from):null);
}
async function handleScreenSignal(from,p){const rec=screenPeerForIncomingSignal(from,p);if(!rec)return;if(p.kind==="description"&&p.description){try{await rec.pc.setRemoteDescription(p.description)}catch(e){console.warn("SDP da transmissão rejeitado",{from,role:rec.role,streamHostId:rec.streamHostId,type:p.description.type,error:e});return}while(rec.pending.length){try{await rec.pc.addIceCandidate(rec.pending.shift())}catch(e){console.warn("ICE pendente rejeitado",e)}}if(p.description.type==="offer"){const ans=await rec.pc.createAnswer();await rec.pc.setLocalDescription(ans);sendScreenPeerSignal(rec,{kind:"description",description:rec.pc.localDescription.toJSON()})}else if(p.description.type==="answer"&&rec.role==="host"){scheduleScreenKeyFrames(rec)}return}if(p.kind==="candidate"&&p.candidate){if(rec.pc.remoteDescription){try{await rec.pc.addIceCandidate(p.candidate)}catch(e){console.warn("ICE da transmissão rejeitado",{from,role:rec.role,streamHostId:rec.streamHostId,error:e})}}else rec.pending.push(p.candidate)}}
function watchDmScreen(){
  const stream=state.dmAvailableScreen;
  if(!stream||stream.threadId!==state.dmCallThreadId)return;
  if(state.viewerPeer&&state.viewingHostId===stream.hostId){showPinnedScreen();return}
  send({type:"dm_screen_join",thread_id:stream.threadId,code:stream.code});
}
function watchScreen(hostId){if(!hostId||hostId===state.clientId)return showOwnScreen();state.screenScope="voice";const host=state.presence.find(u=>u.client_id===hostId);if(!host?.stream)return toast("Essa transmissão terminou.","error");if(state.viewingHostId&&state.viewingHostId!==hostId){send({type:"leave_session"},{silent:true});closeScreenViewer(false)}else if(state.viewingHostId===hostId)closeScreenViewer(false);state.viewingHostId=hostId;state.viewingSessionCode=host.stream.session_code;ensureScreenViewerPeer(hostId);send({type:"join_host",host_id:hostId});showPinnedScreen();renderCall()}
function closeScreenViewer(notify=true){const scope=state.viewerPeer?.scope||state.screenScope;if(notify&&state.viewingHostId)send({type:scope==="dm"?"dm_screen_leave":"leave_session"},{silent:true});if(viewerFullscreenActive()){if(window.openCallDesktop?.setViewerFullscreen){window.openCallDesktop.setViewerFullscreen(false).catch(()=>{});setViewerFullscreenState(false)}else document.exitFullscreen().catch(()=>{})};if(state.viewerPeer){if(state.viewerPeer.restartTimer)clearTimeout(state.viewerPeer.restartTimer);stopScreenPeerDiagnostics(state.viewerPeer);try{state.viewerPeer.pc.close()}catch{}}state.viewerPeer=null;state.viewingHostId=null;state.viewingSessionCode=null;els.remoteScreenVideo.srcObject=null;els.remoteScreenVideo.style.opacity="1";els.pinnedStreamPanel.classList.add("hidden");els.fullscreenStreamButton?.classList.add("hidden");if(!state.screenStream)state.screenScope=null;renderCall();updateFloatingStreamDock()}
function showPinnedScreen(){els.remoteScreenVideo.muted=false;applyAudioOutput(els.remoteScreenVideo);applyCurrentStreamVolume();els.pinnedStreamPanel.classList.remove("hidden");els.fullscreenStreamButton?.classList.toggle("hidden",!state.viewingHostId);const host=voiceParticipantByClient(state.viewingHostId)||currentPresenceByClient(state.viewingHostId);els.streamOwnerLabel.textContent=host?`${host.display_name} · AO VIVO`:"Transmissão ao vivo";els.streamStateLabel.textContent=state.viewerPeer?.pc?.connectionState==="connected"?"WebRTC conectado":"Conectando WebRTC…";playRemoteScreen();els.localScreenPreviewWrap.classList.toggle("hidden",!(state.screenStream&&state.showLocalPreview));updateViewerFullscreenUi();updateFloatingStreamDock()}
function showOwnScreen(){if(!state.screenStream)return;if(viewerFullscreenActive()){if(window.openCallDesktop?.setViewerFullscreen){window.openCallDesktop.setViewerFullscreen(false).catch(()=>{});setViewerFullscreenState(false)}else document.exitFullscreen().catch(()=>{})};els.remoteScreenVideo.srcObject=state.screenStream;els.remoteScreenVideo.muted=true;els.pinnedStreamPanel.classList.remove("hidden");els.fullscreenStreamButton?.classList.add("hidden");els.streamOwnerLabel.textContent="Sua transmissão";els.streamStateLabel.textContent=`${state.screenPeers.size} assistindo`;els.localScreenPreviewWrap.classList.add("hidden");updateFloatingStreamDock()}
function cleanupScreen(notify=true){stopScreenShare(notify);closeScreenViewer(notify)}

// -----------------------------------------------------------------------------
// Perfil, configurações, notificações e diagnóstico
// -----------------------------------------------------------------------------
function detectRenderer(){try{const c=document.createElement("canvas"),gl=c.getContext("webgl")||c.getContext("experimental-webgl");if(!gl)return "WebGL indisponível";const ext=gl.getExtension("WEBGL_debug_renderer_info");return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)}catch{return "Não identificado"}}
function fillGpuSelect(select,gpus,current){
  if(!select)return;select.replaceChildren();
  const auto=document.createElement("option");auto.value="auto";auto.textContent="Automático pelo Chromium";select.appendChild(auto);
  for(const gpu of gpus){const o=document.createElement("option");o.value=gpu.id;o.textContent=`${gpu.label} · ${gpu.renderNode}`;select.appendChild(o)}
  select.value=["auto",...gpus.map(g=>g.id)].includes(current)?current:"auto";
}
function featureStatusLabel(v){const x=safeText(v||"desconhecido");return x.replaceAll("_"," ")}
async function refreshDesktopGpuSettings(){
  if(!window.openCallDesktop){
    state.desktop.available=false;
    els.desktopOnlyNotice.querySelector("span").textContent="Abra esta build pelo Electron/AppImage para controlar o perfil de GPU.";
    for(const x of [els.encoderGpuSelect,els.decoderGpuSelect,els.encoderModeSelect,els.zeroCopyModeSelect,els.gpuBackendSelect,els.hardwareAccelerationToggle,els.refreshGpuButton,els.applyGpuButton])x.disabled=true;
    els.desktopGpuApplied.textContent="Somente Web";els.desktopGpuEncodeStatus.textContent="gerenciado pelo navegador";els.desktopGpuDecodeStatus.textContent="gerenciado pelo navegador";return;
  }
  document.body.classList.add("electron-app");state.desktop.available=true;
  try{
    const [gpus,profile,diag,info]=await Promise.all([window.openCallDesktop.listGpus(),window.openCallDesktop.getGpuProfile(),window.openCallDesktop.getGpuDiagnostics(),window.openCallDesktop.getInfo()]);
    state.desktop.gpus=gpus||[];state.desktop.profile=profile||{};state.desktop.diagnostics=diag||{};state.desktop.platform=info?.platform||"";state.desktop.nativeDisplayPickerPreferred=Boolean(info?.nativeDisplayPickerPreferred);state.desktop.sessionType=info?.sessionType||"";state.desktop.desktopEnvironment=info?.desktopEnvironment||"";
    fillGpuSelect(els.encoderGpuSelect,state.desktop.gpus,profile.encoderGpuId||"auto");
    fillGpuSelect(els.decoderGpuSelect,state.desktop.gpus,profile.decoderGpuId||"auto");
    els.encoderModeSelect.value=profile.encoderMode||"auto";
    els.zeroCopyModeSelect.value=profile.zeroCopyMode||"auto";
    els.gpuBackendSelect.value=profile.backend||"auto";els.hardwareAccelerationToggle.checked=profile.hardwareAcceleration!==false;
    const applied=diag.appliedGpu;els.desktopGpuApplied.textContent=applied?`${applied.label} · ${applied.renderNode}`:"Automático";
    els.desktopGpuEnv.textContent=`encoder=${profile.encoderMode||"auto"} · transferência=${diag.effectiveCopyMode|| (diag.multiGpuSafeCopy?"safe":"zero-copy")} (pedido=${profile.zeroCopyMode||"auto"}) · DRI_PRIME=${diag.env?.DRI_PRIME||"não usado"} · mídia VA-API=${diag.env?.hardwareVideoDevicePath||"auto"} · MESA_VK_DEVICE_SELECT=${diag.env?.MESA_VK_DEVICE_SELECT||"auto"} · filtros globais=${diag.env?.globalGpuFiltersNeutralizedForOpenCall?"isolados":"padrão"}`;
    els.desktopGpuEncodeStatus.textContent=featureStatusLabel(diag.featureStatus?.video_encode);
    els.desktopGpuDecodeStatus.textContent=featureStatusLabel(diag.featureStatus?.video_decode);
    els.desktopOnlyNotice.querySelector("span").textContent=`Electron ${info.electron} · Chromium ${info.chromium} · ${info.platform}/${info.arch}`;
    const compact={app:info,profile:diag.profile,splitRequested:diag.splitRequested,splitRoutingSupported:diag.splitRoutingSupported,note:diag.note,env:diag.env,featureStatus:diag.featureStatus,gpuDevice:diag.gpuInfo?.gpuDevice,auxAttributes:diag.gpuInfo?.auxAttributes};
    els.desktopGpuDetails.textContent=JSON.stringify(compact,null,2);
  }catch(err){console.warn("GPU desktop",err);els.desktopOnlyNotice.querySelector("span").textContent=`Falha no diagnóstico: ${err.message||err}`}
}
async function applyDesktopGpuProfile(){
  if(!window.openCallDesktop)return toast("Esta opção exige o aplicativo Electron.","error");
  const profile={encoderGpuId:els.encoderGpuSelect.value,decoderGpuId:els.decoderGpuSelect.value,encoderMode:els.encoderModeSelect.value,zeroCopyMode:els.zeroCopyModeSelect.value,backend:els.gpuBackendSelect.value,hardwareAcceleration:els.hardwareAccelerationToggle.checked};
  try{
    const result=await window.openCallDesktop.setGpuProfile(profile);
    if(result.splitRequested&&!result.splitRoutingSupported)toast("Encoder e decoder diferentes foram salvos, mas o Chromium ainda usa uma GPU de processo. Nesta build a GPU do encoder terá prioridade.","info",7000);
    if(result.requiresRestart){const modeLabel=profile.encoderMode==="software"?"software/CPU":profile.encoderMode==="hardware"?"hardware/VA-API":"automático";if(confirm(`O perfil de GPU foi salvo (encoder ${modeLabel}). Reiniciar o OpenCall agora para aplicar?`))await window.openCallDesktop.restart();else toast("Reinicie o OpenCall para aplicar a GPU.","success")}
  }catch(err){toast(`GPU: ${err.message||err}`,"error")}
}
async function initDesktopIntegration(){
  if(!window.openCallDesktop){state.desktop.available=false;return}
  document.body.classList.add("electron-app");state.desktop.available=true;
  await refreshDesktopGpuSettings();
}

function tutorialSeenKey(){const who=state.profile?.user_id||state.profile?.username||"anon";return `${TUTORIAL_SEEN_PREFIX}${encodeURIComponent(settings.signalingUrl)}:${who}`}
function maybeOpenTutorialAfterRegistration(){
  if(state.authMode!=="register")return;
  state.authMode="login";
  const key=tutorialSeenKey();
  if(localStorage.getItem(key))return;
  localStorage.setItem(key,"1");
  setTimeout(()=>{if(state.authenticated)openSettings("tutorial")},350);
}
function fillSettingsUI(){const p=state.profile||{};if(els.tutorialCurrentConnection)els.tutorialCurrentConnection.textContent=settings.signalingUrl||DEFAULT_SIGNALING_URL;updateAuthConnectionUi();els.profileDisplayName.value=p.display_name||"";els.profileStatus.value=p.status||"online";els.profileCustomStatus.value=p.custom_status||"";setProfileAvatarViewer(els.settingsAvatar,p.avatar_media_id,p.display_name,p);els.signalingUrl.value=settings.signalingUrl;els.stunUrl.value=settings.stunUrl;els.turnUrl.value=settings.turnUrl;els.turnUsername.value=settings.turnUsername;els.turnPassword.value=settings.turnPassword;els.videoCodecSelect.value=settings.videoCodec;if(els.screenQualityModeSelect)els.screenQualityModeSelect.value=normalizeScreenQualityMode(settings.screenQualityMode);syncScreenProfileControls(screenProfileFromSettings());els.voiceThreshold.value=settings.voiceThreshold;els.voiceThresholdValue.textContent=`${settings.voiceThreshold}%`;els.noiseSuppressionMode.value=settings.noiseSuppressionMode||"webrtc";if(els.noiseSuppressionStatus)els.noiseSuppressionStatus.textContent=settings.noiseSuppressionMode==="rnnoise"?"RNNoise embutido no OpenCall será processado via WebAssembly/AudioWorklet, sem depender do PipeWire/LADSPA.":settings.noiseSuppressionMode==="off"?"Supressão desligada.":"Supressão WebRTC ativa.";els.pushToTalkToggle.checked=settings.pushToTalk;els.desktopNotifications.checked=settings.desktopNotifications;els.notifyMentions.checked=settings.notifyMentions;els.notifyStreams.checked=settings.notifyStreams;els.gpuRenderer.textContent=detectRenderer();refreshDevices(false);refreshDesktopGpuSettings()}
function openSettings(tab="profile"){fillSettingsUI();selectSettingsTab(tab);els.settingsDialog.showModal()}
function selectSettingsTab(tab){qsa(".settings-tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));qsa(".settings-page").forEach(p=>p.classList.toggle("active",p.dataset.page===tab));if(tab==="servers")renderConnectionProfiles()}
async function saveProfile(){const p=state.profile||{};send({type:"profile_update",display_name:els.profileDisplayName.value||p.display_name,status:els.profileStatus.value||p.status,custom_status:els.profileCustomStatus.value??p.custom_status,avatar_media_id:p.avatar_media_id||"",avatar_zoom:Number(p.avatar_zoom??1),avatar_x:Number(p.avatar_x??0),avatar_y:Number(p.avatar_y??0)})}
function isAnimatedAvatarFile(file){return Boolean(file&&((file.type||'').toLowerCase()==='image/gif'||/\.gif$/i.test(file.name||'')))}
async function uploadAvatar(file,adjustAfter=false){if(!file)return;try{const item={file,progress:0};const rec=await uploadImage(item);primeAvatarCache(rec.media_id,file);state.profile.avatar_media_id=rec.media_id;state.profile.avatar_zoom=1;state.profile.avatar_x=0;state.profile.avatar_y=0;setProfileAvatarViewer(els.settingsAvatar,rec.media_id,state.profile.display_name,state.profile);setAvatar(els.selfAvatar,rec.media_id,state.profile.display_name,state.profile);saveProfile();if(adjustAfter)setTimeout(openAvatarFrameEditor,120)}catch(e){toast(`Avatar: ${e.message||e}`,"error")}}
function notify(title,body){if(!settings.desktopNotifications||Notification.permission!=="granted"||document.hasFocus())return;try{new Notification(title,{body,icon:""})}catch{}}
function notifyForMessage(m){if(Number(m.sender?.user_id)===Number(state.profile?.user_id)||state.mutedChannels.has(Number(m.channel_id))||state.mutedGuilds.has(Number(state.guildId)))return;const mention=(m.content||"").includes(`@${state.profile?.username}`)||(m.content||"").includes("@todos")||(m.content||"").includes("@everyone");if(settings.notifyMentions&&mention)notify(`Menção de ${m.sender?.display_name||m.sender?.username}`,m.content||"anexo")}
function notifyNewStreams(oldList,newList){if(!settings.notifyStreams||state.mutedGuilds.has(Number(state.guildId)))return;const old=new Set(oldList.filter(u=>u.stream).map(u=>u.user_id));for(const u of newList)if(u.stream&&!old.has(u.user_id)&&Number(u.user_id)!==Number(state.profile?.user_id))notify(`${u.display_name} está transmitindo`,"Clique no OpenCall para assistir.")}

// -----------------------------------------------------------------------------
// Administração: canais, categorias, cargos, convites e moderação
// -----------------------------------------------------------------------------
function openAdmin(page="overview"){if(!hasPerm("view_admin"))return;els.adminGuildName.textContent=currentGuild()?.name||"";selectAdminTab(page);renderAdminStructure();send({type:"admin_stats",guild_id:state.guildId});els.adminDialog.showModal()}
function selectAdminTab(page){qsa(".admin-tab").forEach(b=>b.classList.toggle("active",b.dataset.admin===page));qsa(".admin-page").forEach(p=>p.classList.toggle("active",p.dataset.adminPage===page))}
function renderAdminStats(s){els.adminStats.replaceChildren();for(const [label,key,fmt] of [["Membros","members"],["Online","online"],["Mensagens","messages"],["Canais","channels"],["Calls ativas","calls"],["Convites","invites"],["Armazenamento","storage_bytes",formatBytes]]){const c=document.createElement("div");c.className="stat-card";const val=fmt?fmt(s[key]||0):String(s[key]||0);c.innerHTML=`<strong>${escapeHtml(val)}</strong><span>${label}</span>`;els.adminStats.appendChild(c)}}
function renderAdminStructure(){
  const categories=state.structure.categories||[];
  const channels=state.structure.channels||[];
  els.newChannelCategory.replaceChildren();
  const noCategory=document.createElement("option");noCategory.value="";noCategory.textContent="Sem categoria / OUTROS";els.newChannelCategory.appendChild(noCategory);
  for(const c of categories){const o=document.createElement("option");o.value=c.id;o.textContent=c.name;els.newChannelCategory.appendChild(o)}

  els.adminCategoryList.replaceChildren();
  for(const cat of categories){
    const r=document.createElement("div");r.className="admin-list-row admin-category-row";
    const title=document.createElement("strong");title.textContent=`📁 ${cat.name}`;
    const count=channels.filter(ch=>Number(ch.category_id)===Number(cat.id)).length;
    const info=document.createElement("span");info.textContent=`${count} ${count===1?"canal":"canais"}`;
    r.append(title,info);
    if(hasPerm("manage_channels")){
      const d=document.createElement("button");d.className="danger-btn";d.textContent="Excluir categoria";
      d.onclick=()=>{
        if(!serverSupportsCategoryDelete()){
          toast(`Seu servidor ${state.serverVersion||"antigo"} não suporta excluir categorias. Atualize o OpenCall Server para 0.6.6 e tente novamente.`,"error",9000);
          return;
        }
        const message=count
          ? `Excluir a categoria “${cat.name}”?\n\nOs ${count} ${count===1?"canal será movido":"canais serão movidos"} para OUTROS. Canais, mensagens e arquivos NÃO serão apagados.`
          : `Excluir a categoria “${cat.name}”?`;
        if(!confirm(message))return;
        d.disabled=true;d.textContent="Excluindo…";
        if(!send({type:"category_delete",guild_id:state.guildId,category_id:cat.id})){d.disabled=false;d.textContent="Excluir categoria"}
      };
      r.append(d);
    }
    els.adminCategoryList.appendChild(r);
  }

  els.adminChannelList.replaceChildren();
  for(const c of channels){const r=document.createElement("div");r.className="admin-list-row";const title=document.createElement("strong");title.textContent=`${c.type==="voice"?"🔊":"#"} ${c.name}`;const topic=document.createElement("span");topic.textContent=c.topic||"";r.append(title,topic);if(hasPerm("manage_channels")){const priv=document.createElement("label");priv.style.display="flex";priv.style.alignItems="center";priv.style.gap="4px";priv.innerHTML=`<input type="checkbox" ${c.private?"checked":""}> privado`;const readonly=document.createElement("label");readonly.className="admin-readonly-label";readonly.innerHTML=`<input type="checkbox" ${c.read_only?"checked":""} ${c.type!=="text"?"disabled":""}> somente leitura`;if(c.type==="text"&&!serverSupportsReadOnlyChannels()){readonly.title="Requer OpenCall Server 0.6.7+"}const role=document.createElement("select");const all=document.createElement("option");all.value="";all.textContent="cargo permitido";role.appendChild(all);for(const ro of state.structure.roles||[]){const o=document.createElement("option");o.value=ro.id;o.textContent=ro.name;o.selected=(c.allowed_role_ids||[]).includes(Number(ro.id));role.appendChild(o)}const save=()=>{if(c.type==="text"&&readonly.querySelector("input").checked&&!serverSupportsReadOnlyChannels()){readonly.querySelector("input").checked=false;toast(`Canal somente leitura requer OpenCall Server 0.6.7 ou superior. Servidor atual: ${state.serverVersion||"antigo"}.`,"error",8000);return}send({type:"channel_update",guild_id:state.guildId,channel_id:c.id,name:c.name,topic:c.topic||"",private:priv.querySelector("input").checked,read_only:c.type==="text"?readonly.querySelector("input").checked:false,allowed_role_ids:role.value?[Number(role.value)]:[]})};priv.querySelector("input").onchange=save;readonly.querySelector("input").onchange=save;role.onchange=save;const d=document.createElement("button");d.className="danger-btn";d.textContent="Excluir";d.onclick=()=>{if(confirm(`Excluir ${c.name}?`))send({type:"channel_delete",guild_id:state.guildId,channel_id:c.id})};r.append(priv,readonly,role,d)}els.adminChannelList.appendChild(r)}
  renderAdminRoles(state.structure.roles||[]);renderAdminMembers();renderCommunityControls()
}

const downloadRows=new Map();
window.openCallDesktop?.onDownloadProgress?.(download=>{
  let panel=document.getElementById('downloadPanel');
  if(!panel){panel=document.createElement('section');panel.id='downloadPanel';panel.setAttribute('aria-label','Downloads');const title=document.createElement('strong');title.textContent='Downloads';panel.appendChild(title);document.body.appendChild(panel)}
  let row=downloadRows.get(download.id);
  if(!row){
    row=document.createElement('div');row.className='download-row';
    const name=document.createElement('strong'),progress=document.createElement('progress'),status=document.createElement('span'),close=document.createElement('button');
    name.textContent=download.name;progress.max=100;progress.setAttribute('aria-label',`Download de ${download.name}`);close.textContent='×';close.setAttribute('aria-label',`Dispensar download de ${download.name}`);close.hidden=true;
    close.onclick=()=>{downloadRows.delete(download.id);row.remove();if(!downloadRows.size)panel.remove()};
    row.append(name,progress,status,close);panel.appendChild(row);downloadRows.set(download.id,row);
  }
  const progress=row.querySelector('progress'),status=row.querySelector('span');
  const percent=download.total>0?Math.min(100,Math.floor(download.received/download.total*100)):null;
  if(percent===null)progress.removeAttribute('value');else progress.value=percent;
  const final=['completed','cancelled','interrupted'].includes(download.status);
  const label={completed:'Concluído',cancelled:'Cancelado',interrupted:'Interrompido'}[download.status];
  status.textContent=label||`${percent===null?'Baixando':percent+'%'} · ${formatBytes(download.received)}${download.total>0?' / '+formatBytes(download.total):''}`;
  row.querySelector('button').hidden=!final;
  if(final){status.setAttribute('role','status');if(download.status==='completed')progress.value=100}
});
function communitySelect(label,items,value,change){
  const wrap=document.createElement('label');wrap.textContent=label;
  const select=document.createElement('select');
  for(const item of items){const option=document.createElement('option');option.value=item.id??'';option.textContent=item.name;select.appendChild(option)}
  select.value=String(value??'');select.onchange=()=>change(select.value);wrap.appendChild(select);return wrap;
}
els.channelTree.addEventListener('pointerdown',e=>{const row=e.target.closest('.channel-row');if(row)row.draggable=hasPerm('manage_channels')});
els.channelTree.addEventListener('dragstart',e=>{
  if(!hasPerm('manage_channels'))return;
  const row=e.target.closest('.channel-row');if(!row)return;
  const name=row.querySelector('.channel-name')?.textContent;
  const sections=Array.from(els.channelTree.querySelectorAll('.category')),index=sections.indexOf(row.closest('.category'));
  const category=state.structure.categories[index];
  const channel=state.structure.channels.find(c=>c.name===name&&(category?Number(c.category_id)===Number(category.id):!c.category_id));
  if(channel)e.dataTransfer.setData('application/opencall-channel',JSON.stringify({id:channel.id,guild:state.guildId}));
});
els.channelTree.addEventListener('dragover',e=>{if(hasPerm('manage_channels')&&e.target.closest('.category')&&Array.from(e.dataTransfer.types).includes('application/opencall-channel'))e.preventDefault()});
els.channelTree.addEventListener('drop',e=>{
  if(!hasPerm('manage_channels'))return;const section=e.target.closest('.category');if(!section)return;
  try{const data=JSON.parse(e.dataTransfer.getData('application/opencall-channel'));if(Number(data.guild)!==Number(state.guildId))return;
    const index=Array.from(els.channelTree.querySelectorAll('.category')).indexOf(section),category=state.structure.categories[index];
    e.preventDefault();send({type:'channel_move',guild_id:state.guildId,channel_id:data.id,category_id:category?.id||null});
  }catch{}
});
function renderCommunityControls(){
  const owner=guildOwner(currentGuild()),roles=state.structure.roles||[];
  const own=roles.find(r=>Number(r.id)===Number(currentGuild()?.role_id));
  if(hasPerm('manage_channels'))for(const [i,row] of Array.from(els.adminChannelList.children).entries()){
    const channel=state.structure.channels[i];if(!channel)continue;
    row.appendChild(communitySelect('Categoria',[{id:'',name:'Sem categoria'},...state.structure.categories],channel.category_id,id=>send({type:'channel_move',guild_id:state.guildId,channel_id:channel.id,category_id:Number(id)||null})));
  }
  if(hasPerm('manage_roles'))for(const [i,row] of Array.from(els.adminRoleList.children).entries()){
    const role=roles[i];if(!role)continue;
    const input=document.createElement('input');input.type='number';input.min='0';input.max='1000';input.value=role.priority;input.setAttribute('aria-label',`Prioridade de ${role.name}`);
    input.disabled=!owner&&(role.priority>=Number(own?.priority||0)||(role.permissions||[]).includes('manage_server'));
    const button=document.createElement('button');button.textContent='Salvar prioridade';button.disabled=input.disabled;
    button.onclick=()=>{if(input.reportValidity())send({type:'role_priority',guild_id:state.guildId,role_id:role.id,priority:Number(input.value)})};row.append(input,button);
  }
  for(const [i,row] of Array.from(els.adminMemberList.children).entries()){
    const user=state.presence[i];if(!user)continue;
    const target=roles.find(r=>Number(r.id)===Number(user.role_id)),self=Number(user.user_id)===Number(state.profile?.user_id),isOwner=Number(user.user_id)===Number(state.structure.guild?.owner_user_id);
    const allowed=!self&&!isOwner&&(owner||(Number(own?.priority||0)>Number(target?.priority||0)&&!(target?.permissions||[]).includes('manage_server')));
    const select=row.querySelector('select');select.disabled=!hasPerm('manage_roles')||!allowed;
    for(const option of select.options){const role=roles.find(r=>Number(r.id)===Number(option.value));option.disabled=!owner&&(Number(role?.priority)>Number(own?.priority||0)||(role?.permissions||[]).some(p=>!state.permissions.has(p)))}
    if(allowed&&hasPerm('manage_users')&&user.voice?.channel_id){
      row.appendChild(communitySelect('Mover call',[{id:'',name:'Escolha canal'},...state.structure.channels.filter(c=>c.type==='voice')],user.voice.channel_id,id=>{if(id)send({type:'voice_move',guild_id:state.guildId,user_id:user.user_id,channel_id:Number(id)})}));
      const disconnect=document.createElement('button');disconnect.textContent='Desconectar da call';disconnect.onclick=()=>send({type:'voice_move',guild_id:state.guildId,user_id:user.user_id,channel_id:null});row.appendChild(disconnect);
    }
    if(owner&&!self){const transfer=document.createElement('button');transfer.textContent='Transferir propriedade';transfer.onclick=()=>confirmCommunityTransfer(user);row.appendChild(transfer)}
  }
  if(hasPerm('manage_server')){
    const label=document.createElement('label');label.textContent='Foto da comunidade';const input=document.createElement('input');input.type='file';input.accept='image/*';
    input.onchange=async()=>{const file=input.files?.[0],guildId=state.guildId,token=state.uploadToken;if(!file)return;if(!file.type.startsWith('image/')||file.size>8*1024*1024)return toast('Escolha imagem de até 8 MiB.','error');try{const image=await uploadImage({file});if(token===state.uploadToken&&guildId===state.guildId)send({type:'guild_icon',guild_id:guildId,media_id:image.media_id})}catch(e){toast(e.message,'error')}};
    label.appendChild(input);els.adminCategoryList.appendChild(label);
  }
}
function confirmCommunityTransfer(user){
  const dialog=document.createElement('dialog');dialog.className='modal auth-modal';
  const form=document.createElement('form');form.className='modal-body form-grid';
  const text=document.createElement('p');text.textContent=`Transferir propriedade para ${user.display_name}? Você perderá os poderes exclusivos de dono. Digite TRANSFERIR para confirmar.`;
  const input=document.createElement('input');input.setAttribute('aria-label','Digite TRANSFERIR');
  const submit=document.createElement('button');submit.textContent='Transferir propriedade';submit.disabled=true;
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancelar';cancel.onclick=()=>dialog.close();
  const gid=state.guildId,token=state.uploadToken;input.oninput=()=>submit.disabled=input.value!=='TRANSFERIR';
  form.onsubmit=e=>{e.preventDefault();if(input.value==='TRANSFERIR'&&token===state.uploadToken&&gid===state.guildId&&send({type:'guild_transfer',guild_id:gid,user_id:user.user_id}))dialog.close()};
  form.append(text,input,cancel,submit);dialog.appendChild(form);dialog.onclose=()=>dialog.remove();document.body.appendChild(dialog);dialog.showModal();cancel.focus();
}

function renderAdminRoles(roles){els.adminRoleList.replaceChildren();for(const r of roles){const d=document.createElement("div");d.className="admin-list-row";d.innerHTML=`<strong>${escapeHtml(r.name)}</strong><span>${(r.permissions||[]).length} permissões · prioridade ${r.priority}</span>`;els.adminRoleList.appendChild(d)}if(!els.rolePermissionEditor.children.length){for(const p of ALL_PERMS){const l=document.createElement("label");l.innerHTML=`<input type="checkbox" value="${p}"> ${p}`;els.rolePermissionEditor.appendChild(l)}}}
function renderAdminMembers(){els.adminMemberList.replaceChildren();for(const u of state.presence){const r=document.createElement("div");r.className="admin-list-row";const roles=state.structure.roles||[];const sel=document.createElement("select");for(const ro of roles){const o=document.createElement("option");o.value=ro.id;o.textContent=ro.name;o.selected=Number(ro.id)===Number(u.role_id);sel.appendChild(o)}sel.onchange=()=>send({type:"role_assign",guild_id:state.guildId,user_id:u.user_id,role_id:Number(sel.value)});r.innerHTML=`<strong>${escapeHtml(u.display_name)} <small>@${escapeHtml(u.username||"")}</small></strong>`;r.appendChild(sel);els.adminMemberList.appendChild(r)}}

function renderAdminLog(entries){els.adminLogList.replaceChildren();for(const e of entries){const r=document.createElement("div");r.className="admin-list-row";r.innerHTML=`<strong>${escapeHtml(e.action||"ação")}</strong><span>${escapeHtml(e.actor_name||"sistema")} · ${new Date(Number(e.created_at||0)*1000).toLocaleString("pt-BR")}<br>${escapeHtml(e.target||"")} ${escapeHtml(e.detail||"")}</span>`;els.adminLogList.appendChild(r)}if(!entries.length)els.adminLogList.textContent="Sem registros."}

function openUserDialog(u){state.selectedUser=u;els.userDialogName.textContent=u.display_name||u.username;els.userDialogPublicId.textContent=publicUserId(u);setAvatar(els.userDialogAvatar,u.avatar_media_id,u.display_name,u);els.userDialogStatus.textContent=`${u.custom_status||u.status||""} · ${u.role_name||"Membro"}`;const rel=friendRelation(u.user_id);els.userAddFriendButton.textContent=rel==="friend"?"Amigo ✓":rel==="incoming"?"Aceitar amizade":rel==="outgoing"?"Pedido enviado":"Adicionar amigo";els.userAddFriendButton.disabled=rel==="friend"||rel==="outgoing";const v=getPeerVolume(u);els.userVolumeSlider.value=v;els.userVolumeValue.textContent=`${v}%`;els.userMuteLocalButton.textContent=v===0?"Reativar áudio":"Silenciar para mim";const admin=hasPerm("kick")||hasPerm("ban")||hasPerm("timeout");qsa(".admin-only").forEach(x=>x.classList.toggle("hidden",!admin));els.userDialog.showModal()}

// -----------------------------------------------------------------------------
// Utilidades de UI e eventos
// -----------------------------------------------------------------------------
function autoResize(el){el.style.height="auto";el.style.height=`${Math.min(160,el.scrollHeight)}px`}
function updateCounter(){els.messageCounter.textContent=`${els.chatInput.value.length}/4000`}
function insertEmojiInto(target,emoji){if(!target)return;const a=Number.isFinite(target.selectionStart)?target.selectionStart:target.value.length,b=Number.isFinite(target.selectionEnd)?target.selectionEnd:a;target.value=target.value.slice(0,a)+emoji+target.value.slice(b);target.focus();target.selectionStart=target.selectionEnd=a+emoji.length;autoResize(target);target.dispatchEvent(new Event("input",{bubbles:true}))}
function populateEmojiPicker(container,target){if(!container)return;container.replaceChildren();for(const e of EMOJIS){const b=document.createElement("button");b.type="button";b.textContent=e;b.title=e;b.onclick=()=>{insertEmojiInto(target,e);container.classList.add("hidden")};container.appendChild(b)}}
function buildEmojiPicker(){populateEmojiPicker(els.emojiPicker,els.chatInput);populateEmojiPicker(els.dmEmojiPicker,els.dmInput)}
function closeEmojiPickers(except=null){for(const p of [els.emojiPicker,els.dmEmojiPicker])if(p&&p!==except)p.classList.add("hidden")}

function renderDmPending(){renderUploadTray()}

async function changeAudioInput(){settings.audioInput=els.audioInputSelect.value;saveSettings();if(!state.voiceStream)return;try{const oldStream=state.voiceStream;const ns=await openVoiceMicrophoneStream();const track=ns.getAudioTracks()[0];for(const rec of state.voicePeers.values()){const sender=rec.pc.getSenders().find(x=>x.track?.kind==="audio");if(sender)await sender.replaceTrack(track)}state.voiceStream=ns;stopManagedVoiceStream(oldStream);track.enabled=!state.voiceMuted&&!settings.pushToTalk;startSpeakingDetector();toast("Microfone alterado.","success")}catch(e){toast(`Microfone: ${e.message||e}`,"error")}}
async function changeAudioOutput(){settings.audioOutput=els.audioOutputSelect.value;saveSettings();for(const r of state.voicePeers.values()){await applyAudioOutput(r.audio);await applyAudioOutput(r.boostAudio)}toast("Saída de áudio alterada.","success")}
function saveScreenProfileFromSettingsUi(){const profile=normalizeScreenProfile({resolution:els.screenResolutionSelect.value,fps:els.screenFpsInput.value,bitrateMbps:els.screenBitrateInput.value});settings.screenProfile=profile;saveSettings();syncScreenProfileControls(profile);if(state.screenStream)applyScreenProfile(profile,{notify:false,reconfigureCapture:true})}
function saveMediaSettings(){settings.cameraId=els.cameraSelect.value;settings.videoCodec=els.videoCodecSelect.value;if(els.screenQualityModeSelect)settings.screenQualityMode=normalizeScreenQualityMode(els.screenQualityModeSelect.value);settings.voiceThreshold=Number(els.voiceThreshold.value)||10;settings.noiseSuppressionMode=els.noiseSuppressionMode?.value||"webrtc";settings.pushToTalk=els.pushToTalkToggle.checked;settings.desktopNotifications=els.desktopNotifications.checked;settings.notifyMentions=els.notifyMentions.checked;settings.notifyStreams=els.notifyStreams.checked;saveSettings();if(settings.pushToTalk&&localAudioTrack())localAudioTrack().enabled=false}

function updateProfileFromFormLocal(){if(!state.profile)return;state.profile.display_name=els.profileDisplayName.value.trim()||state.profile.display_name;state.profile.status=els.profileStatus.value;state.profile.custom_status=els.profileCustomStatus.value.trim();updateSelfUI()}

function doLogout(){saveAuthTokenForUrl(settings.signalingUrl,"");localStorage.removeItem(AUTH_KEY);clearAvatarMediaCache();disconnect(false);state.profile=null;state.authenticated=false;state.guilds=[];state.presence=[];state.friends=[];state.friendIncoming=[];state.friendOutgoing=[];state.structure={guild:null,categories:[],channels:[],roles:[]};cleanupVoice(false);cleanupScreen(false);renderGuildRail();renderChannels();renderMembers();setTimeout(connect,100);els.settingsDialog.close()}

// Auth
els.loginTab.onclick=()=>{state.authMode="login";els.loginTab.classList.add("active");els.registerTab.classList.remove("active");els.displayNameField.classList.add("hidden");els.authSubmit.textContent="Entrar";els.authPassword.autocomplete="current-password"};
els.registerTab.onclick=()=>{state.authMode="register";els.registerTab.classList.add("active");els.loginTab.classList.remove("active");els.displayNameField.classList.remove("hidden");els.authSubmit.textContent="Criar conta";els.authPassword.autocomplete="new-password"};
els.authForm.onsubmit=e=>{e.preventDefault();els.authError.textContent="";const username=els.authUsername.value.trim(),password=els.authPassword.value;if(state.authMode==="register")send({type:"auth_register",username,password,display_name:els.authDisplayName.value.trim()||username});else send({type:"auth_login",username,password})};

// Amigos / DMs globais
els.homeButton.onclick=()=>openFriendsHome("all");
els.friendsButton.onclick=()=>openFriendsHome("all");
els.pendingFriendsButton.onclick=()=>openFriendsHome("pending");
els.homeDmSearchButton.onclick=openNewDm;
els.friendsTabAll.onclick=()=>setFriendsMode("all");els.friendsTabOnline.onclick=()=>setFriendsMode("online");els.friendsTabPending.onclick=()=>setFriendsMode("pending");els.friendsTabAdd.onclick=()=>setFriendsMode("add");
els.friendsListSearch.addEventListener("input",renderFriendsHome);
els.friendsHomeSearchForm.onsubmit=e=>{e.preventDefault();const q=els.friendsHomeSearchInput.value.trim();if(q)send({type:"friend_search",query:q})};
els.friendSearchForm.onsubmit=e=>{e.preventDefault();const q=els.friendSearchInput.value.trim();if(q)send({type:"friend_search",query:q})};

// Chat / arquivos
els.chatForm.onsubmit=e=>{e.preventDefault();submitChat()};
els.chatInput.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submitChat()}});let typingTimer=null;els.chatInput.addEventListener("input",()=>{autoResize(els.chatInput);updateCounter();sendTyping(true);clearTimeout(typingTimer);typingTimer=setTimeout(()=>sendTyping(false),1200)});els.chatInput.addEventListener("blur",()=>sendTyping(false));els.cancelReplyButton.onclick=cancelReply;els.attachButton.onclick=()=>els.filePicker.click();els.filePicker.onchange=()=>{queueFiles(els.filePicker.files);els.filePicker.value=""};els.gifButton.onclick=()=>els.gifPicker.click();els.gifPicker.onchange=()=>{queueFiles(els.gifPicker.files);els.gifPicker.value=""};els.screenshotButton.onclick=captureScreenshot;els.emojiButton.onclick=()=>{const willOpen=els.emojiPicker.classList.contains("hidden");closeEmojiPickers();if(willOpen)els.emojiPicker.classList.remove("hidden")};els.dmEmojiButton.onclick=()=>{const willOpen=els.dmEmojiPicker.classList.contains("hidden");closeEmojiPickers();if(willOpen)els.dmEmojiPicker.classList.remove("hidden")};els.pinsButton.onclick=showPins;els.globalSearchButton.onclick=openSearch;els.searchForm.onsubmit=e=>{e.preventDefault();send({type:"chat_search",channel_id:state.channelId,query:els.searchInput.value})};els.editMessageForm.onsubmit=e=>{e.preventDefault();submitEditMessage()};els.editMessageCancel.onclick=closeEditMessage;els.editMessageAttachButton.onclick=()=>{state.editReplaceKey=null;els.editMessageFilePicker.multiple=true;els.editMessageFilePicker.value="";els.editMessageFilePicker.click()};els.editMessageFilePicker.onchange=()=>{const files=els.editMessageFilePicker.files;const replaceKey=state.editReplaceKey;state.editReplaceKey=null;queueEditFiles(files,replaceKey);els.editMessageFilePicker.value="";els.editMessageFilePicker.multiple=true};els.editMessageInput.addEventListener("input",()=>{els.editMessageCounter.textContent=`${els.editMessageInput.value.length}/4000`});els.editMessageInput.addEventListener("keydown",e=>{if(e.key==="Escape"){e.preventDefault();closeEditMessage()}else if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();submitEditMessage()}});els.editMessageDialog.addEventListener("close",resetEditMessageState);

// DM
els.newDmButton.onclick=openNewDm;els.createGroupDmButton.onclick=()=>{const ids=qsa("#dmUserPicker input:checked").map(x=>Number(x.value));if(!ids.length)return toast("Selecione pelo menos uma pessoa.","error");send({type:"dm_create",member_ids:ids,name:els.dmGroupName.value.trim()});els.newDmDialog.close()};els.dmForm.onsubmit=e=>{e.preventDefault();submitDm()};els.dmInput.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submitDm()}});els.dmInput.addEventListener("input",()=>autoResize(els.dmInput));els.dmAttachButton.onclick=()=>els.filePicker.click();els.dmGifButton.onclick=()=>els.gifPicker.click();
els.dmVoiceCallButton.onclick=()=>startDmCall();els.dmVideoCallButton.onclick=()=>startDmCall({video:true});els.dmScreenCallButton.onclick=()=>startDmCall({screen:true});els.dmOpenCallButton.onclick=openDmCallView;els.dmIncomingCallAccept.onclick=acceptIncomingDmCall;els.dmIncomingCallDecline.onclick=declineIncomingDmCall;

// Voz/call
els.joinVoiceButton.onclick=()=>joinVoice(state.channelId);els.callMuteButton.onclick=toggleMute;els.miniMuteButton.onclick=toggleMute;els.selfMuteButton.onclick=toggleMute;els.callDeafenButton.onclick=toggleDeafen;els.miniDeafenButton.onclick=toggleDeafen;els.selfDeafenButton.onclick=toggleDeafen;els.callLeaveButton.onclick=leaveVoice;els.miniLeaveButton.onclick=leaveVoice;els.cameraButton.onclick=toggleCamera;els.screenShareButton.onclick=startScreenShare;els.closePinnedStream.onclick=()=>{if(viewerFullscreenActive()){if(window.openCallDesktop?.setViewerFullscreen){window.openCallDesktop.setViewerFullscreen(false).catch(()=>{});setViewerFullscreenState(false)}else document.exitFullscreen().catch(()=>{})};if(els.remoteScreenVideo.srcObject===state.screenStream&&state.screenStream){els.pinnedStreamPanel.classList.add("hidden");els.remoteScreenVideo.srcObject=null;updateFloatingStreamDock()}else closeScreenViewer(true)};els.fullscreenStreamButton.onclick=toggleViewerFullscreen;els.hideLocalPreviewButton.onclick=()=>{state.showLocalPreview=false;els.localScreenPreviewWrap.classList.add("hidden")};
els.remoteScreenVideo.addEventListener("contextmenu",e=>{if(state.screenStream&&els.remoteScreenVideo.srcObject===state.screenStream)openScreenContextMenu(e,"host");else if(state.viewingHostId)openScreenContextMenu(e,"viewer")});
els.remoteScreenVideo.addEventListener("dblclick",e=>{if(state.viewingHostId&&els.remoteScreenVideo.srcObject){e.preventDefault();toggleViewerFullscreen()}});
els.localScreenPreview.addEventListener("contextmenu",e=>state.screenStream&&openScreenContextMenu(e,"host"));
els.floatingStreamVideoButton.addEventListener("contextmenu",e=>state.screenStream&&openScreenContextMenu(e,"host"));
const previewHostQuality=()=>{if(els.hostQualitySummary)els.hostQualitySummary.textContent=screenProfileLabel(readHostScreenProfile())};
for(const input of [els.hostResolutionSelect,els.hostFpsInput,els.hostBitrateInput])input?.addEventListener("input",previewHostQuality);
qsa("[data-host-fps]").forEach(b=>b.onclick=()=>{els.hostFpsInput.value=b.dataset.hostFps;previewHostQuality()});
qsa("[data-host-bitrate]").forEach(b=>b.onclick=()=>{els.hostBitrateInput.value=b.dataset.hostBitrate;previewHostQuality()});
els.hostQualityApply.onclick=async()=>{await applyScreenProfile(readHostScreenProfile());closeScreenContextMenu()};
els.streamVolumeSlider.oninput=()=>state.viewingHostId&&setStreamVolume(state.viewingHostId,els.streamVolumeSlider.value);
els.streamMuteToggle.onclick=()=>{if(!state.viewingHostId)return;const key=streamVolumeKey(state.viewingHostId),v=getStreamVolume(state.viewingHostId);setStreamVolume(state.viewingHostId,v===0?(state.streamLastNonZero.get(key)||100):0)};
els.streamFullscreenToggle.onclick=toggleViewerFullscreen;
document.addEventListener("fullscreenchange",updateViewerFullscreenUi);
if(window.openCallDesktop?.onViewerFullscreenChanged){window.openCallDesktop.onViewerFullscreenChanged(active=>setViewerFullscreenState(active));window.openCallDesktop.getViewerFullscreen?.().then(active=>setViewerFullscreenState(active)).catch(()=>{})}
document.addEventListener("pointerdown",e=>{if(!els.screenContextMenu.classList.contains("hidden")&&!els.screenContextMenu.contains(e.target))closeScreenContextMenu();if(els.guildContextMenu&&!els.guildContextMenu.classList.contains("hidden")&&!els.guildContextMenu.contains(e.target))closeGuildContextMenu();if(els.emojiPicker&&!els.emojiPicker.classList.contains("hidden")&&!els.emojiPicker.contains(e.target)&&e.target!==els.emojiButton)els.emojiPicker.classList.add("hidden");if(els.dmEmojiPicker&&!els.dmEmojiPicker.classList.contains("hidden")&&!els.dmEmojiPicker.contains(e.target)&&e.target!==els.dmEmojiButton)els.dmEmojiPicker.classList.add("hidden")});
window.addEventListener("keydown",e=>{if(e.key==="Escape"){closeScreenContextMenu();closeGuildContextMenu()}});
window.addEventListener("blur",()=>{closeScreenContextMenu();closeGuildContextMenu()});
els.floatingStreamOpen.onclick=openOwnStreamFromDock;els.floatingStreamVideoButton.onclick=openOwnStreamFromDock;els.floatingStreamHide.onclick=hideFloatingStreamDock;els.floatingStreamRestore.onclick=restoreFloatingStreamDock;els.floatingStreamStop.onclick=()=>stopScreenShare(true);

// Header/sidebar
els.membersToggleButton.onclick=()=>els.app.classList.toggle("members-hidden");els.reconnectButton.onclick=()=>{disconnect(false);setTimeout(connect,100)};els.openSettingsButton.onclick=()=>openSettings();els.openSettingsRail.onclick=()=>openSettings();els.selfAvatar.onclick=()=>openSettings("profile");els.createGuildButton.onclick=()=>document.getElementById("communityChoiceDialog").showModal();els.adminButton.onclick=()=>openAdmin();
document.getElementById("chooseCreateCommunity").onclick=()=>{document.getElementById("communityChoiceDialog").close();els.createGuildDialog.showModal();els.newGuildName.focus()};
document.getElementById("chooseJoinCommunity").onclick=()=>{document.getElementById("communityChoiceDialog").close();els.joinGuildDialog.showModal();els.inviteCodeInput.focus()};
els.avatarCropZoom.oninput=()=>{state.avatarCrop.zoom=Math.max(0.65,Math.min(4,Number(els.avatarCropZoom.value)||0.90));renderAvatarCrop()};els.avatarCropReset.onclick=resetAvatarCrop;els.avatarCropCancel.onclick=closeAvatarCropper;els.avatarCropApply.onclick=()=>applyAvatarCrop().catch(e=>toast(`Avatar: ${e.message||e}`,"error"));els.avatarCropDialog.addEventListener("close",clearAvatarCrop);
els.avatarFrameZoom.oninput=()=>{state.avatarFrame.zoom=Math.max(0.5,Math.min(4,Number(els.avatarFrameZoom.value)||1));renderAvatarFrameEditor()};els.avatarFrameReset.onclick=resetAvatarFrameEditor;els.avatarFrameCancel.onclick=()=>els.avatarFrameDialog.close();els.avatarFrameApply.onclick=applyAvatarFrameEditor;
els.avatarFrameStage.addEventListener("pointerdown",e=>{state.avatarFrame.dragging=true;state.avatarFrame.startX=e.clientX;state.avatarFrame.startY=e.clientY;state.avatarFrame.baseX=state.avatarFrame.x;state.avatarFrame.baseY=state.avatarFrame.y;els.avatarFrameStage.classList.add("dragging");els.avatarFrameStage.setPointerCapture?.(e.pointerId);e.preventDefault()});
els.avatarFrameStage.addEventListener("pointermove",e=>{if(!state.avatarFrame.dragging)return;const r=els.avatarFrameStage.getBoundingClientRect();state.avatarFrame.x=Math.max(-100,Math.min(100,state.avatarFrame.baseX+(e.clientX-state.avatarFrame.startX)/Math.max(1,r.width)*100));state.avatarFrame.y=Math.max(-100,Math.min(100,state.avatarFrame.baseY+(e.clientY-state.avatarFrame.startY)/Math.max(1,r.height)*100));renderAvatarFrameEditor()});
const finishAvatarFrameDrag=e=>{if(!state.avatarFrame.dragging)return;state.avatarFrame.dragging=false;els.avatarFrameStage.classList.remove("dragging");try{els.avatarFrameStage.releasePointerCapture?.(e.pointerId)}catch{}};els.avatarFrameStage.addEventListener("pointerup",finishAvatarFrameDrag);els.avatarFrameStage.addEventListener("pointercancel",finishAvatarFrameDrag);els.avatarFrameStage.addEventListener("wheel",e=>{e.preventDefault();state.avatarFrame.zoom=Math.max(0.5,Math.min(4,state.avatarFrame.zoom+(e.deltaY<0?0.08:-0.08)));renderAvatarFrameEditor()},{passive:false});

// Servidores de conexão (hosts reais)
els.connectionSearchInput.oninput=renderConnectionProfiles;
els.connectionAddForm.onsubmit=e=>{e.preventDefault();try{const url=normalizeSignalingUrl(els.connectionUrlInput.value),name=els.connectionNameInput.value.trim()||new URL(url).hostname;let profile=connectionProfiles.find(x=>x.url===url);if(profile){profile.name=name||profile.name}else{profile={id:`host-${randomId(6)}`,name,url,builtin:false,created_at:Date.now(),last_used:Date.now()};connectionProfiles.push(profile)}saveConnectionProfiles();els.connectionNameInput.value="";els.connectionUrlInput.value="";renderConnectionProfiles();switchConnectionProfile(profile)}catch(err){toast(err.message||String(err),"error")}};
els.authChangeConnectionButton.onclick=()=>{if(els.authDialog.open)els.authDialog.close();openConnectionManager()};
els.settingsDialog.addEventListener("close",()=>{if(!state.authenticated&&state.connected)setTimeout(requireAuthDialog,0)});

// Settings
els.imageViewerClose.onclick=closeImageViewer;els.imageViewerDialog.addEventListener("click",e=>{if(e.target===els.imageViewerDialog)closeImageViewer()});els.imageViewerDialog.addEventListener("close",()=>{if(els.imageViewerImage){els.imageViewerImage.onload=null;els.imageViewerImage.removeAttribute("src")}});
els.videoViewerClose.onclick=closeVideoViewer;els.videoViewerDialog.addEventListener("click",e=>{if(e.target===els.videoViewerDialog)closeVideoViewer()});els.videoViewerDialog.addEventListener("close",()=>{const v=els.videoViewerVideo;if(v){v.pause();v.onloadedmetadata=null;v.onerror=null;v.removeAttribute("src");v.load()}});
qsa(".settings-tab").forEach(b=>b.onclick=()=>selectSettingsTab(b.dataset.tab));if(els.tutorialOpenConnectionButton)els.tutorialOpenConnectionButton.onclick=()=>openConnectionManager();if(els.tutorialUsePublicButton)els.tutorialUsePublicButton.onclick=()=>{const p=ensureConnectionProfile(DEFAULT_SIGNALING_URL,"OpenCall Público");switchConnectionProfile(p)};qsa(".modal-close").forEach(b=>b.onclick=()=>$(b.dataset.close)?.close());els.changeAvatarButton.onclick=()=>els.avatarPicker.click();els.adjustAvatarButton.onclick=openAvatarFrameEditor;els.settingsAvatar.onclick=openAvatarFrameEditor;els.avatarPicker.onchange=()=>{const f=els.avatarPicker.files?.[0];els.avatarPicker.value="";if(!f)return;if(isAnimatedAvatarFile(f)){uploadAvatar(f,true).then(()=>toast("GIF de perfil enviado com animação preservada.","success")).catch(e=>toast(`Avatar: ${e.message||e}`,"error"));return;}openAvatarCropper(f).catch(e=>toast(`Avatar: ${e.message||e}`,"error"))};els.removeAvatarButton.onclick=()=>{if(state.profile){state.profile.avatar_media_id="";state.profile.avatar_zoom=1;state.profile.avatar_x=0;state.profile.avatar_y=0;setProfileAvatarViewer(els.settingsAvatar,"",state.profile.display_name,state.profile);setAvatar(els.selfAvatar,"",state.profile.display_name,state.profile);saveProfile()}};els.saveProfileButton.onclick=()=>{updateProfileFromFormLocal();saveProfile()};els.refreshDevicesButton.onclick=()=>refreshDevices(true);els.testOutputButton.onclick=testAudioOutput;els.audioInputSelect.onchange=changeAudioInput;els.audioOutputSelect.onchange=changeAudioOutput;els.cameraSelect.onchange=saveMediaSettings;els.videoCodecSelect.onchange=saveMediaSettings;if(els.screenQualityModeSelect)els.screenQualityModeSelect.onchange=()=>{saveMediaSettings();const track=state.screenStream?.getVideoTracks?.()[0];applyScreenTrackQualityHint(track,settings.screenQualityMode);for(const rec of state.screenPeers.values()){const sender=rec.pc.getSenders().find(s=>s.track?.kind==="video");if(sender)configureScreenSender(sender,screenProfileFromSettings(),settings.screenQualityMode)}};els.screenResolutionSelect.onchange=saveScreenProfileFromSettingsUi;els.screenFpsInput.onchange=saveScreenProfileFromSettingsUi;els.screenBitrateInput.onchange=saveScreenProfileFromSettingsUi;els.voiceThreshold.oninput=()=>{els.voiceThresholdValue.textContent=`${els.voiceThreshold.value}%`;saveMediaSettings()};els.pushToTalkToggle.onchange=saveMediaSettings;els.desktopNotifications.onchange=saveMediaSettings;els.notifyMentions.onchange=saveMediaSettings;els.notifyStreams.onchange=saveMediaSettings;els.requestNotificationPermission.onclick=async()=>{if("Notification" in window){const p=await Notification.requestPermission();toast(`Notificações: ${p}`,p==="granted"?"success":"info")}};els.saveConnectionButton.onclick=()=>{try{const url=normalizeSignalingUrl(els.signalingUrl.value);settings.stunUrl=els.stunUrl.value.trim();settings.turnUrl=els.turnUrl.value.trim();settings.turnUsername=els.turnUsername.value.trim();settings.turnPassword=els.turnPassword.value;const profile=ensureConnectionProfile(url,new URL(url).hostname);profile.url=url;saveConnectionProfiles();disconnect(true);clearServerScopedState();settings.signalingUrl=url;saveSettings();els.signalingUrl.value=url;els.settingsDialog.close();setTimeout(connect,100)}catch(e){toast(e.message||String(e),"error")}};els.changePasswordButton.onclick=()=>send({type:"password_change",old_password:els.oldPassword.value,new_password:els.newPassword.value});els.logoutButton.onclick=doLogout;
els.refreshGpuButton.onclick=refreshDesktopGpuSettings;els.applyGpuButton.onclick=applyDesktopGpuProfile;
els.noiseSuppressionMode.onchange=async()=>{const old=settings.noiseSuppressionMode;saveMediaSettings();if(state.voiceStream&&old!==settings.noiseSuppressionMode)await changeAudioInput();fillSettingsUI()};
els.streamSetupResolution.onchange=updateStreamSetupSummary;els.streamSetupFps.oninput=updateStreamSetupSummary;els.streamSetupBitrate.oninput=updateStreamSetupSummary;els.streamSetupAudio.onchange=updateStreamSetupSummary;
els.streamSetupForm.onsubmit=e=>{e.preventDefault();const profile=normalizeScreenProfile({resolution:els.streamSetupResolution.value,fps:els.streamSetupFps.value,bitrateMbps:els.streamSetupBitrate.value}),qualityMode=normalizeScreenQualityMode(els.streamSetupQualityMode?.value||settings.screenQualityMode);const resolve=state.desktop.streamSetupResolve;state.desktop.streamSetupResolve=null;els.streamSetupDialog.close();resolve?.({profile,qualityMode,shareSystemAudio:els.streamSetupAudio.checked})};
els.streamSetupCancel.onclick=()=>{const resolve=state.desktop.streamSetupResolve;state.desktop.streamSetupResolve=null;if(els.streamSetupDialog.open)els.streamSetupDialog.close();resolve?.(null)};els.streamSetupDialog.addEventListener("cancel",e=>{e.preventDefault();els.streamSetupCancel.click()});
els.desktopSourceRefresh.onclick=loadDesktopSources;els.desktopSourceCancel.onclick=()=>{if(els.desktopSourceDialog.open)els.desktopSourceDialog.close();const resolve=state.desktop.sourceResolve;state.desktop.sourceResolve=null;resolve?.(null)};els.desktopSourceDialog.addEventListener("cancel",e=>{e.preventDefault();els.desktopSourceCancel.click()});

// Guild/admin
els.createGuildForm.onsubmit=e=>{e.preventDefault();send({type:"guild_create",name:els.newGuildName.value.trim()});els.createGuildDialog.close();els.newGuildName.value=""};els.joinGuildForm.onsubmit=e=>{e.preventDefault();send({type:"invite_accept",code:els.inviteCodeInput.value.trim()});els.joinGuildDialog.close();els.inviteCodeInput.value=""};qsa(".admin-tab").forEach(b=>b.onclick=()=>{selectAdminTab(b.dataset.admin);if(b.dataset.admin==="logs")send({type:"admin_log",guild_id:state.guildId})});els.createCategoryButton.onclick=()=>{if(els.newCategoryName.value.trim())send({type:"category_create",guild_id:state.guildId,name:els.newCategoryName.value.trim()})};els.createChannelButton.onclick=()=>{if(els.newChannelName.value.trim())send({type:"channel_create",guild_id:state.guildId,name:els.newChannelName.value.trim(),channel_type:els.newChannelType.value,category_id:Number(els.newChannelCategory.value)||null})};els.createRoleButton.onclick=()=>{const perms=qsa("#rolePermissionEditor input:checked").map(x=>x.value);if(els.newRoleName.value.trim())send({type:"role_create",guild_id:state.guildId,name:els.newRoleName.value.trim(),permissions:perms,priority:5})};els.createInviteButton.onclick=()=>send({type:"invite_create",guild_id:state.guildId,hours:Number(els.inviteHours.value)||0,max_uses:Number(els.inviteUses.value)||0});

// User popup / moderation
els.userVolumeSlider.oninput=()=>{const u=state.selectedUser;if(!u)return;const v=Number(els.userVolumeSlider.value);els.userVolumeValue.textContent=`${v}%`;setPeerVolume(u,v);els.userMuteLocalButton.textContent=v===0?"Reativar áudio":"Silenciar para mim"};els.userMuteLocalButton.onclick=()=>{const u=state.selectedUser;if(!u)return;const v=getPeerVolume(u)===0?100:0;els.userVolumeSlider.value=v;els.userVolumeValue.textContent=`${v}%`;setPeerVolume(u,v);els.userMuteLocalButton.textContent=v===0?"Reativar áudio":"Silenciar para mim"};els.userDmButton.onclick=()=>{const u=state.selectedUser;if(u){send({type:"dm_create",member_ids:[u.user_id]});els.userDialog.close()}};els.userAddFriendButton.onclick=()=>{const u=state.selectedUser;if(!u)return;const rel=friendRelation(u.user_id);if(rel==="incoming")send({type:"friend_accept",user_id:u.user_id});else if(rel==="none")send({type:"friend_request",user_id:u.user_id});els.userDialog.close()};els.userBlockButton.onclick=()=>{const u=state.selectedUser;if(u){send({type:"block_user",user_id:u.user_id});toast("Estado de bloqueio alterado.","success");els.userDialog.close()}};els.userTimeoutButton.onclick=()=>{const u=state.selectedUser;if(u)send({type:"mod_timeout",guild_id:state.guildId,user_id:u.user_id,seconds:600,reason:"Timeout pelo painel"});els.userDialog.close()};els.userKickButton.onclick=()=>{const u=state.selectedUser;if(u&&confirm(`Expulsar ${u.display_name}?`))send({type:"mod_kick",guild_id:state.guildId,user_id:u.user_id,reason:"Expulso pelo painel"});els.userDialog.close()};els.userBanButton.onclick=()=>{const u=state.selectedUser;if(u&&confirm(`Banir ${u.display_name}?`))send({type:"mod_ban",guild_id:state.guildId,user_id:u.user_id,reason:"Banido pelo painel"});els.userDialog.close()};

// Drag/drop / paste
let dragDepth=0;window.addEventListener("dragenter",e=>{if(Array.from(e.dataTransfer?.types||[]).includes("Files")){dragDepth++;els.dropOverlay.classList.remove("hidden")}});window.addEventListener("dragleave",()=>{dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)els.dropOverlay.classList.add("hidden")});window.addEventListener("dragover",e=>{if(Array.from(e.dataTransfer?.types||[]).includes("Files"))e.preventDefault()});window.addEventListener("drop",e=>{dragDepth=0;els.dropOverlay.classList.add("hidden");if(e.dataTransfer?.files?.length){e.preventDefault();queueFiles(e.dataTransfer.files)}});window.addEventListener("paste",e=>{const files=Array.from(e.clipboardData?.files||[]);if(files.length)queueFiles(files)});


// Libera novamente os elementos de mídia remota após qualquer interação do usuário.
// Isso também cobre Chromium/Electron quando o contexto de áudio nasce suspenso.
window.addEventListener("pointerdown",()=>{unlockRemoteMedia().catch(()=>{})},{capture:true});
window.addEventListener("keydown",()=>{unlockRemoteMedia().catch(()=>{})},{capture:true});
els.remoteScreenVideo.addEventListener("loadedmetadata",()=>{playRemoteScreen()});
window.addEventListener("beforeunload",()=>{try{sendTyping(false);if(state.dmCallThreadId)send({type:"dm_call_leave"},{silent:true});else if(state.voiceChannelId)send({type:"voice_leave"},{silent:true});if(state.screenSessionCode)send({type:state.screenScope==="dm"?"dm_screen_stop":"end_session"},{silent:true});if(state.viewingHostId)send({type:state.screenScope==="dm"?"dm_screen_leave":"leave_session"},{silent:true})}catch{}clearAvatarMediaCache()});

// Bootstrap visual
try{settings.signalingUrl=normalizeSignalingUrl(settings.signalingUrl);ensureConnectionProfile(settings.signalingUrl,currentConnectionProfile().name)}catch{settings.signalingUrl=DEFAULT_SIGNALING_URL;ensureConnectionProfile(DEFAULT_SIGNALING_URL,"OpenCall Público")}saveSettings();saveConnectionProfiles();
buildEmojiPicker();fillSettingsUI();renderGuildRail();renderChannels();renderMembers();renderDmList();renderFriendsHome();updateSidebarMode();updateSelfUI();updateCounter();setupFloatingDockDrag();updateFloatingStreamDock();initDesktopIntegration();connect();
