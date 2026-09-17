const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../public/app.js'),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const context=vm.createContext({console,Promise,WeakMap,performance,AbortSignal,setTimeout,Number,Math,encodeURIComponent,
  state:{uploadToken:'token',pendingFiles:[],channelId:1},WebSocket:{OPEN:1},toast:()=>{},
  serverHttpBase:()=> 'https://test.invalid',renderUploadTray:()=>{},canWriteReadOnlyChannel:()=>true,
  els:{chatInput:{value:'rascunho'},dmInput:{value:'privado'}},cancelReply:()=>{},autoResize:()=>{},updateCounter:()=>{}});
vm.runInContext(section('function send(payload','\n',),context);
vm.runInContext(section('function submitChat()','\n'),context);
vm.runInContext(section('function submitDm()','\n'),context);
vm.runInContext(section('const screenSenderUpdates=', 'async function configureScreenSender'),context);
vm.runInContext(section('async function uploadLargeFile(', 'function renderUploadTray'),context);
(async()=>{
  vm.runInContext(section('function gateRemoteScreenFirstFrame(', 'async function createScreenOffer'),context);
  const realTimer=context.setTimeout;const timers=[];context.setTimeout=fn=>timers.push(fn);
  const video={style:{},readyState:0};context.els.remoteScreenVideo=video;
  const peer={};context.state.viewerPeer=peer;
  context.gateRemoteScreenFirstFrame(peer);assert.equal(video.style.opacity,'0');
  const scheduled=timers.length;context.gateRemoteScreenFirstFrame(peer);assert.equal(timers.length,scheduled);
  timers[0]();assert.equal(video.style.opacity,'1');
  context.gateRemoteScreenFirstFrame(peer);assert.equal(video.style.opacity,'1');assert.equal(timers.length,scheduled);
  context.state.viewerPeer=null;context.setTimeout=realTimer;
  vm.runInContext(section('function selectGuild(', 'function renderGuildRail'),context);
  vm.runInContext(section('function watchDmScreen(', 'function watchScreen'),context);
  const signals=[];const originalSend=context.send;
  context.send=m=>signals.push(m);context.closeGuildContextMenu=()=>{};
  context.switchView=view=>context.state.currentView=view;
  context.openTextChannel=id=>context.state.channelId=id;
  context.state.guildId=3;context.state.channelId=12;context.state.dmThreadId=5;
  context.state.structure={channels:[{id:12,type:'voice'},{id:13,type:'text'}]};
  context.selectGuild(3);assert.equal(context.state.currentView,'chat');assert.equal(context.state.channelId,13);assert.equal(context.state.dmThreadId,null);
  context.state.dmCallThreadId=5;context.state.dmAvailableScreen={threadId:5,hostId:'host',code:'DM-test'};
  context.watchDmScreen();assert.equal(signals.at(-1).type,'dm_screen_join');assert.equal(signals.at(-1).code,'DM-test');
  context.state.dmCallThreadId=6;const count=signals.length;context.watchDmScreen();assert.equal(signals.length,count);
  context.send=originalSend;context.state.dmCallThreadId=null;
  context.safeText=x=>String(x??'');
  vm.runInContext(section('function guildOwner(', 'function guildContextAction'),context);
  context.state.profile={user_id:7};context.state.guildId=1;
  context.state.structure={guild:{owner_user_id:7}};
  assert.equal(context.guildOwner({id:1,role_name:'Administrador'}),true);
  assert.equal(context.guildOwner({id:2,owner_user_id:8,role_name:'Dono'}),false);
  assert.equal(context.guildOwner({id:2,owner_user_id:7}),true);
  assert.equal(context.guildOwner({id:2,role_name:'Dono'}),true);
  let closed=0,cleaned=0;
  context.document={getElementById:()=>({dataset:{guildId:'2'},close:()=>closed++})};
  context.closeGuildContextMenu=()=>{};context.renderGuildRail=()=>{};
  context.cleanupVoice=context.cleanupScreen=()=>cleaned++;
  context.state.guilds=[{id:1},{id:2}];
  context.finishGuildAction({guild_id:2});assert.equal(closed,1);assert.equal(cleaned,0);assert.equal(context.state.guilds.length,1);
  context.state.dmCallThreadId=9;context.finishGuildAction({guild_id:1});assert.equal(cleaned,0);
  context.state.dmCallThreadId=null;context.finishGuildAction({guild_id:1});assert.equal(cleaned,2);
  context.state.ws={readyState:1,bufferedAmount:2*1024*1024,send:()=>assert.fail('envio congestionado')};
  context.submitChat();assert.equal(context.els.chatInput.value,'rascunho');
  context.state.dmThreadId=1;context.submitDm();assert.equal(context.els.dmInput.value,'privado');
  context.state.ws={readyState:1,bufferedAmount:0,send:()=>{}};
  context.state.pendingFiles=[{status:'paused'}];context.submitChat();assert.equal(context.els.chatInput.value,'rascunho');
  let version=0,active=0;
  const sender={getParameters:()=>({version})};
  await Promise.all(Array.from({length:5},()=>context.updateScreenSender(sender,async p=>{
    assert.equal(active++,0);assert.equal(p.version,version);await new Promise(r=>setTimeout(r,2));version++;active--;
  })));
  assert.equal(version,5);
  await assert.rejects(context.updateScreenSender(sender,()=>Promise.reject(new Error('driver'))));
  await context.updateScreenSender(sender,()=>{version++});assert.equal(version,6);
  const calls=[];let offset=0;
  context.fetch=async(url,options)=>{
    calls.push(url);
    if(url.endsWith('/start'))return {ok:true,json:async()=>({upload_id:'a',offset:0,chunk_size:8*1024*1024})};
    if(url.endsWith('/chunk')){assert.equal(Number(options.headers['X-OpenCall-Offset']),offset);assert.ok(options.body.size<=1024*1024);offset+=options.body.size;return {ok:true,json:async()=>({offset})}}
    return {ok:true,json:async()=>({media_id:'done'})};
  };
  const item={file:{name:'test',size:2500000,type:'application/octet-stream',slice:(a,b)=>({size:b-a})}};
  assert.equal((await context.uploadLargeFile(item)).media_id,'done');assert.equal(offset,item.file.size);assert.equal(calls.length,5);
  context.fetch=async()=>({ok:true,json:async()=>({upload_id:'a',offset:-1,chunk_size:0})});
  await assert.rejects(context.uploadLargeFile(item),/Offset/);
  console.log('Transferência: rascunhos, anexos pausados, fila do encoder, blocos e offsets OK');
})().catch(e=>{console.error(e);process.exitCode=1});
