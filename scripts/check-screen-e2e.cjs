// node scripts/check-screen-e2e.cjs /absolute/path/to/electron
// Two isolated Electron processes; real OpenCall signaling/player functions, synthetic moving source.
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
if(process.versions.electron){
  const {app,BrowserWindow,session}=require('electron');
  const [role,port,profile]=process.argv.slice(2);
  app.setPath('userData',profile);
  app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
  app.commandLine.appendSwitch('use-gl','angle');
  app.commandLine.appendSwitch('use-angle','gl');
  app.commandLine.appendSwitch('ozone-platform','x11');
  // ponytail: software isolates protocol tests from host drivers; benchmark hardware separately.
  app.disableHardwareAcceleration();
  let win;
  app.whenReady().then(async()=>{
    // No credentials or production server connections during tests.
    session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(_details,cb)=>cb({cancel:true}));
    win=new BrowserWindow({width:800,height:600,title:`OpenCall test ${role}`,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
    console.error(role,'loading UI');
    await win.loadFile(path.join(root,'public/index.html'));
    console.error(role,'UI loaded');
    await win.webContents.executeJavaScript(`
      connect=()=>{};if(state.ws){state.ws.onclose=null;state.ws.onerror=null;state.ws.onmessage=null;state.ws.close();state.ws=null}
      state.clientId=${JSON.stringify(role)};state.dmCallThreadId=99;state.screenScope='dm';
      state.screenSessionCode='DM-e2e';state.profile={user_id:${role==='host'?1:2},display_name:'Test'};
      iceServers=()=>[];window.testSignals=[];
      sendScreenPeerSignal=(rec,p)=>window.testSignals.push({from:state.clientId,p:{...p,stream_host_id:rec.streamHostId,session_code:rec.sessionCode}});
      window.testStart=async()=>{
        if(state.clientId==='host'){
          const c=document.createElement('canvas');c.width=640;c.height=360;window.testCanvas=c;
          const x=c.getContext('2d');let n=0;window.testAnimation=setInterval(()=>{x.fillStyle=n++%2?'#1280dd':'#ee7722';x.fillRect(0,0,640,360);x.fillStyle='#fff';x.fillRect(n%600,120,40,80)},1000/30);
          state.screenStream=c.captureStream(30);await createScreenOffer('viewer');
        }else{state.viewingHostId='host';state.viewingSessionCode='DM-e2e';state.screenScope='dm';ensureScreenViewerPeer('host')}
      };
      window.testStats=async()=>{const pc=state.clientId==='host'?state.screenPeers.get('viewer')?.pc:state.viewerPeer?.pc;if(!pc)return {};const r=await pc.getStats();let out={connection:pc.connectionState,host:state.viewingHostId,code:state.viewingSessionCode};r.forEach(s=>{if(s.type==='inbound-rtp'&&s.kind==='video'){out.decoded=s.framesDecoded;out.received=s.framesReceived;out.width=s.frameWidth}if(s.type==='outbound-rtp'&&s.kind==='video')out.sent=s.framesSent});out.player=els.remoteScreenVideo.videoWidth;return out};
      void 0;
    `);
    await fetch(`http://127.0.0.1:${port}/ready/${role}`,{method:'POST'});
    while(!win.isDestroyed()){
      const commands=await (await fetch(`http://127.0.0.1:${port}/commands/${role}`)).json();
      for(const command of commands){
        try{const result=await win.webContents.executeJavaScript(command.code);await fetch(`http://127.0.0.1:${port}/result/${command.id}`,{method:'POST',body:JSON.stringify({result})})}
        catch(e){await fetch(`http://127.0.0.1:${port}/result/${command.id}`,{method:'POST',body:JSON.stringify({error:e.message})})}
      }
      const signals=await win.webContents.executeJavaScript('window.testSignals.splice(0)');
      if(signals.length)await fetch(`http://127.0.0.1:${port}/signals/${role}`,{method:'POST',body:JSON.stringify(signals)});
      await sleep(50);
    }
  }).catch(e=>{console.error(e);app.exit(1)});
}else{
  const http=require('node:http'),fs=require('node:fs'),os=require('node:os'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
  const electron=process.argv[2];if(!electron)throw new Error('Pass Electron executable path');
  const queues={host:[],viewer:[]},ready=new Set(),waiting=new Map(),children=[];let id=0;
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'opencall-e2e-'));
  const server=http.createServer(async(req,res)=>{
    let body='';for await(const chunk of req)body+=chunk;
    const [,action,key]=req.url.split('/');
    if(action==='ready')ready.add(key);
    if(action==='commands'){res.end(JSON.stringify(queues[key].splice(0)));return}
    if(action==='signals')for(const s of JSON.parse(body))queues[key==='host'?'viewer':'host'].push({id:0,code:`handleScreenSignal(${JSON.stringify(s.from)},${JSON.stringify(s.p)})`});
    if(action==='result'&&waiting.has(key)){waiting.get(key)(JSON.parse(body));waiting.delete(key)}
    res.end('{}');
  });
  const call=(role,code)=>new Promise((resolve,reject)=>{const key=String(++id);const timer=setTimeout(()=>{waiting.delete(key);reject(new Error(`Timeout ${role}: ${code}`))},20000);waiting.set(key,r=>{clearTimeout(timer);r.error?reject(new Error(r.error)):resolve(r.result)});queues[role].push({id:key,code})});
  (async()=>{
    await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
    for(const role of ['host','viewer']){const child=spawn(electron,[__filename,role,String(port),path.join(temp,role)],{stdio:['ignore','ignore','pipe']});child.stderr.on('data',d=>process.stderr.write(d));children.push(child)}
    const deadline=Date.now()+30000;while(ready.size<2){if(Date.now()>deadline)throw new Error('Electron startup timeout');await sleep(100)}
    await call('viewer','testStart()');await call('host','testStart()');
    for(let cycle=0;cycle<2;cycle++){
      let stats;const until=Date.now()+20000;
      do{await sleep(500);stats=await call('viewer','testStats()')}while((!stats.decoded||stats.decoded<30)&&Date.now()<until);
      assert.equal(stats.connection,'connected');assert.ok(stats.decoded>=30);assert.ok(stats.player>0);assert.equal(stats.host,'host');assert.equal(stats.code,'DM-e2e');
      console.log(JSON.stringify({cycle,...stats}));
      if(cycle===0){await call('viewer',"closeScreenViewer(false);testStart()");await call('host',"createScreenOffer('viewer')")}
    }
    console.log('PASS: two Electron instances, OpenCall offer/answer/ICE, video playback and rejoin');
  })().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{for(const c of children)c.kill();server.close();setTimeout(()=>fs.rmSync(temp,{recursive:true,force:true}),1000)});
}
