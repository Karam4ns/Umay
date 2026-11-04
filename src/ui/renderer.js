const $=id=>document.getElementById(id);const api=window.umay;
let pendingRunCancel=Promise.resolve(),pendingSubmission=Promise.resolve();
let conversation=null,runId=null,ticket=0,models=[],voice='',audioContext,playHead=0,sources=[],listening=false,stream,capture,accountId=null,sessionEpoch=0,responseActive=false;
let pre=[],frames=[],voiced=0,silence=0,recording=false,transcribing=false,noise=.0005;
let captureModule, microphoneSource, microphoneGain, inputFrames=0, microphoneEpoch=0,inputContext,liveRecognizer=null,liveDraft='',voiceEdited=false,echoGuardUntil=0,playbackSuppressed=false,gateFrames=[];
const status=text=>{$('status').textContent=text;window.umayShell?.status(text);};
const playbackEcho=new window.PlaybackEcho();
const safe=fn=>async(...args)=>{try{return await fn(...args);}catch(e){const text=e.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');status(window.UmayErrors.isKnown(text)?errorText(text):text);}};
function errorText(code){const info=window.UmayErrors.describe(code);return info.title+'\n'+info.message;}
function showChatError(code){const text=errorText(code);const node=message('error',text,false);node.setAttribute?.('role','alert');status(text);}
function clearAccount(){window.umayDevice?.reset();++sessionEpoch;accountId=null;conversation=null;models=[];releaseMicrophone();$('messages').replaceChildren();$('history').replaceChildren();$('models').replaceChildren();$('memory-data').textContent='';window.umayShell?.history(0);window.umayShell?.account(null);return stop();}
function message(role,text,record=true){const node=document.createElement('div');node.className='message '+String(role).toLowerCase();node.textContent=text;$('messages').append(node);window.umayShell?.message(role,record);node.scrollIntoView();return node;}
async function refresh(){
 const epoch=++sessionEpoch;let user;try{user=await api.api('/site/auth/me');}catch(e){if(epoch!==sessionEpoch)return;if(epoch===sessionEpoch){if(accountId!==null){const cleanup=clearAccount(),cleared=sessionEpoch;await cleanup;if(cleared!==sessionEpoch)return;}if(/Oturum doğrulaması gerekli|LOGIN_REQUIRED/.test(e.message)){window.umayShell?.account(null);status('Devam etmek için Veriüssü hesabınla giriş yap.');return;}}throw e;}if(epoch!==sessionEpoch)return;
 if(accountId!==user.id){await stop();if(epoch!==sessionEpoch)return;conversation=null;$('messages').replaceChildren();$('history').replaceChildren();$('memory-data').textContent='';accountId=user.id;}
 window.umayShell?.account(user);status(`Bağlı hesap: ${user.email||user.firstName||user.id}`);
 const result=await api.api('/site/chat/models');if(epoch!==sessionEpoch)return;models=result.models||[];$('models').replaceChildren();
 for(const m of models){const o=document.createElement('option');o.value=m.id;o.textContent=m.name;o.dataset.source=m.source;$('models').append(o);}
 window.umayDevice?.modelsChanged();
 const history=await api.api('/site/chat/conversations');if(epoch!==sessionEpoch)return;$('history').replaceChildren();
 window.umayShell?.history((history.conversations||[]).length);
 for(const c of history.conversations||[]){const b=document.createElement('button');b.textContent=c.title;b.onclick=safe(async()=>{const historyEpoch=sessionEpoch;const historyTicket=++ticket;await stop(false);if(historyEpoch!==sessionEpoch||historyTicket!==ticket)return;const detail=await api.api('/site/chat/conversations/'+c.id);if(historyEpoch!==sessionEpoch||historyTicket!==ticket)return;conversation=detail.conversation;$('messages').replaceChildren();for(const m of detail.messages)message(m.role,m.content,false);});$('history').append(b);}
}
function clearVoiceDraft(){
 if(!voiceEdited&&liveDraft&&$('input').value===liveDraft)$('input').value='';
 liveDraft='';voiceEdited=false;$('live-caption').hidden=true;
}
async function stop(advance=true,preserveCapture=false){
 if(advance)++ticket;const hadPlayback=sources.length>0;sources.forEach(source=>{try{source.stop();}catch{}});sources=[];if(audioContext)playbackEcho.stop(audioContext.currentTime);playHead=0;if(hadPlayback)echoGuardUntil=Date.now()+200;window.umayShell?.speaking(false);
 const previous=runId;runId=null;responseActive=false;
 // Local output is stopped synchronously. A cold Python worker must not hold
 // a text message behind speech-library startup before its cancel ack arrives.
 void api.speech('cancel').catch(()=>{});
 const computerCancel=window.umayDevice?.running()&&api.computer?api.computer('stop').catch(()=>{}):Promise.resolve();
 const cancelRun=previous?api.api('/site/chat/runs/'+previous+'/cancel',{}).catch(()=>{}):Promise.resolve();
 pendingRunCancel=Promise.all([pendingRunCancel,cancelRun,computerCancel]).then(()=>{});
 const idle=api.busy(false);
 let reset=Promise.resolve();
 if(!preserveCapture){recording=false;frames=[];pre=[];voiced=0;silence=0;gateFrames=[];clearVoiceDraft();if(liveRecognizer)reset=liveRecognizer.reset().catch(error=>{releaseMicrophone();status(error.message);});}
 await Promise.all([pendingRunCancel,idle,reset]);
}
function submitMessage(text,current){
 // A run can be committed while its POST response is still in flight. Complete
 // that write (and cancel its stale run) before the next turn writes to the chat.
 const submission=pendingSubmission.then(async()=>{
  if(current!==ticket)return null;
  if(!conversation){const m=models.find(x=>x.id===$('models').value);if(!m)throw Error('Önce giriş yapıp bir model seçin.');
   const created=await api.api('/site/chat/conversations',{source:m.source,modelId:m.id,title:text.slice(0,140),requestId:crypto.randomUUID()});
   if(current!==ticket)return;conversation=created.conversation;
  }
  const posted=await api.api('/site/chat/conversations/'+conversation.id+'/messages',{content:text,requestId:crypto.randomUUID(),expectedVersion:Number(conversation.version),kind:'CHAT'});
  if(current!==ticket){if(posted.run?.id)await api.api('/site/chat/runs/'+posted.run.id+'/cancel',{});return;}
  return posted;
 });
 pendingSubmission=submission.then(()=>{},()=>{});return submission;
}
async function send(text,fromVoice=false){
 if(!text.trim())return;
 if(window.umayDevice?.computerMode()){
  const current=++ticket;await stop(false,fromVoice);if(current!==ticket)return;const model=models.find(m=>m.id===$('models').value);if(!model)throw Error('Önce bir model seçin.');
  message('user',text);await api.busy(true);responseActive=true;
  try{const result=await window.umayDevice.runComputer(text,model);if(current!==ticket||!result)return;
   if(result.status==='completed'){message('assistant',result.message);if($('speak').checked)await api.speech('speak',{text:result.message,voice});}
   else if(result.status==='failed'){const info=window.UmayErrors.isKnown(result.message)?errorText(result.message):result.message;message('error',info,false);status(info);}
  }finally{if(current===ticket){responseActive=false;if(!sources.length)await api.busy(false);}}
  return;
 }
 const current=++ticket;await stop(false,fromVoice);if(current!==ticket)return;await api.busy(true);if(current!==ticket)return;responseActive=true;message('user',text);status('Yanıt hazırlanıyor…');
 try{
  const posted=await submitMessage(text,current);if(!posted||current!==ticket)return;
  runId=posted.run.id;
  const deadline=Date.now()+180000;
  while(current===ticket){
   const {run}=await api.api('/site/chat/runs/'+runId);if(current!==ticket)return;
   if(!['QUEUED','RUNNING'].includes(run.status)){
    runId=null;
    if(!['COMPLETED','SUCCEEDED'].includes(run.status)){
     showChatError(run.errorCode||run.status);return;
    }
    const detail=await api.api('/site/chat/conversations/'+conversation.id);
    if(current!==ticket)return;conversation=detail.conversation;
    const last=[...detail.messages].reverse().find(m=>m.role.toLowerCase()==='assistant');
    if(last){message('assistant',last.content);if($('speak').checked){status('Seslendiriliyor…');await api.speech('speak',{text:last.content,voice});}}
    runId=null;break;
   }
   if(Date.now()>deadline)throw Error('Yanıt zaman aşımı; durdurup yeniden deneyin.');
   status(run.phase==='reviewing'?'Yanıt kontrol ediliyor…':run.status==='QUEUED'?'Model sırası bekleniyor…':'Model yanıtı hazırlanıyor…');
   await new Promise(r=>setTimeout(r,250));
  }
  if(current===ticket)status('Hazır.');
 }catch(error){if(current===ticket)showChatError(error.message);}finally{if(current===ticket){responseActive=false;if(!sources.length)await api.busy(false);}}
}
async function play(data){
 const generation=ticket;audioContext ||= new AudioContext();await audioContext.resume();if(generation!==ticket)return;const raw=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
 const buffer=await audioContext.decodeAudioData(raw.buffer);if(generation!==ticket)return;
 await api.busy(true);if(generation!==ticket)return;const source=audioContext.createBufferSource();source.buffer=buffer;source.connect(audioContext.destination);
 playHead=Math.max(audioContext.currentTime+.03,playHead);playbackEcho.add(buffer,playHead,audioContext.currentTime);source.start(playHead);playHead+=buffer.duration;sources.push(source);window.umayShell?.speaking(true);
 source.onended=()=>{sources=sources.filter(s=>s!==source);if(!sources.length){echoGuardUntil=Date.now()+200;window.umayShell?.speaking(false);if(!runId)void api.busy(false);}};
}
function pcmBase64(parts){const floats=parts.flatMap(x=>Array.from(x));const output=new Int16Array(floats.length);for(let i=0;i<output.length;i++)output[i]=Math.max(-1,Math.min(1,floats[i]))*32767;
 const bytes=new Uint8Array(output.buffer);let result='';for(let i=0;i<bytes.length;i+=8192)result+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(result);
}
function createLiveRecognizer(){
 return new window.LiveTranscriber({speech:(method,params)=>api.speech(method,params),
  onPartial:text=>{
   if(!listening||playbackSuppressed)return;
   // Raw microphone energy is not a new turn. Interrupt a pending response only
   // after the recognizer has actual words; playback has its stricter local gate.
   if(responseActive&&text.trim())void stop(true,true).catch(error=>status(error.message));
   if($('input').value!==liveDraft&&$('input').value.trim())voiceEdited=true;
   if(!voiceEdited){$('input').value=text;liveDraft=text;}
   $('live-caption').hidden=!text;$('live-text').textContent=text;$('voice-status').textContent='Seni dinliyorum…';
  },
  onFinal:text=>{
   if(!listening||playbackSuppressed)return;recording=false;voiced=0;silence=0;
   const own=!voiceEdited&&(!$('input').value||$('input').value===liveDraft);
   if(own){$('input').value='';if(text)void safe(()=>send(text,true))();}
   else if(text)status('Konuşma metni hazır. Düzenlediğin mesajı Gönder ile iletebilirsin.');
   liveDraft='';voiceEdited=false;$('live-text').textContent=text;$('live-caption').hidden=!text;
  },
  onError:error=>{releaseMicrophone();status(error.message);}
 });
}
async function onFrame(frame){
 if(!listening)return;
 const rms=Math.sqrt(frame.reduce((sum,x)=>sum+x*x,0)/frame.length);
 $('microphone-level').value=Math.min(100,Math.round(rms*1500));inputFrames++;
 const gated=sources.length>0||Date.now()<echoGuardUntil;
 if(!gated)playbackSuppressed=false;
 const speech=rms>Math.max(gated ? .015 : .0025,noise*3);if(!speech&&rms<.0025)noise=noise*.98+rms*.02;
 if(gated&&!recording){gateFrames.push(frame);if(gateFrames.length>5)gateFrames.shift();playbackSuppressed=true;}
 if(speech){voiced++;silence=0;}else{silence++;if(!recording)voiced=0;}
 let replayed=false;
 if(!recording&&voiced>=5&&gated&&audioContext&&playbackEcho.matches(gateFrames,audioContext.currentTime))voiced=0;
 if(!recording&&voiced>=5){
  recording=true;playbackSuppressed=false;$('voice-status').textContent='Seni dinliyorum…';
  if(gated){for(const part of gateFrames)liveRecognizer?.accept(part);gateFrames=[];replayed=true;}
  if(sources.length)void stop(true,true).catch(error=>status(error.message));
 }
 if(!gated||recording){if(!replayed)liveRecognizer?.accept(frame);}else liveRecognizer?.accept(new Float32Array(frame.length));
 if(!gated)gateFrames=[];
 if(silence>=30){recording=false;voiced=0;}
}
function releaseMicrophone(){
 ++microphoneEpoch;listening=false;stream?.getTracks().forEach(t=>t.stop());stream=null;const previousLive=liveRecognizer;liveRecognizer=null;if(previousLive)void previousLive.close();clearVoiceDraft();gateFrames=[];playbackSuppressed=false;void inputContext?.suspend?.().catch(()=>{});
 window.umayShell?.listening(false);
 if(capture)capture.port.onmessage=null;capture?.disconnect();capture=null;
 microphoneSource?.disconnect();microphoneGain?.disconnect();microphoneSource=null;microphoneGain=null;
 $('listen').textContent='Konuşmayı başlat';$('microphone-level').value=0;$('voice-status').textContent='Mikrofon kapalı';
}
$('listen').onclick=safe(async()=>{
 $('listen').disabled=true;
 try{
  if(listening){releaseMicrophone();await stop();return;}
  const epoch=++microphoneEpoch,accountEpoch=sessionEpoch;
  const stale=()=>epoch!==microphoneEpoch||accountEpoch!==sessionEpoch;
  $('voice-status').textContent='Canlı konuşma hazırlanıyor…';
  const recognizer=createLiveRecognizer();liveRecognizer=recognizer;await recognizer.start(crypto.randomUUID());if(stale())return;
  inputContext ||= new AudioContext({sampleRate:16000});await inputContext.resume();
  if(stale())return;
  const obtained=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1,sampleRate:16000},video:false});
  if(stale()){obtained.getTracks().forEach(t=>t.stop());return;}stream=obtained;
  captureModule ||= inputContext.audioWorklet.addModule('capture.js').catch(e=>{captureModule=null;throw e;});await captureModule;
  if(stale()){releaseMicrophone();return;}
  capture=new AudioWorkletNode(inputContext,'capture');
  microphoneSource=inputContext.createMediaStreamSource(stream);microphoneSource.connect(capture);
  microphoneGain=inputContext.createGain();microphoneGain.gain.value=0;capture.connect(microphoneGain);microphoneGain.connect(inputContext.destination);
  noise=.0005;pre=[];frames=[];voiced=0;silence=0;recording=false;inputFrames=0;playbackSuppressed=false;gateFrames=[];
  capture.port.onmessage=e=>void onFrame(e.data);listening=true;$('listen').textContent='Dinlemeyi kapat';window.umayShell?.listening(true);
  const track=stream.getTracks()[0];$('voice-status').textContent='Mikrofon açık · '+(track?.label||'Varsayılan giriş');
  if(track)track.onended=()=>{releaseMicrophone();void stop();status('Mikrofon bağlantısı kesildi. Konuşmayı yeniden başlatın.');};
  status('Seni dinliyorum. Konuştukların anlık yazılır; durakladığında Umay yanıtlar.');
 }catch(e){releaseMicrophone();throw e;}finally{$('listen').disabled=false;}
});
async function packages(){
 const state=await api.speech('status');window.umayShell?.speech(state);$('packages').replaceChildren();
 for(const [kind,info]of Object.entries(state)){
  const node=document.createElement('div');const title=document.createElement('strong');title.textContent=`${kind.toUpperCase()} · ${info.resident?'Hazır / '+info.device:info.installed?'Kurulu':info.upgradeAvailable?'Canlı STT güncellemesi gerekli':'Kurulu değil'}`;node.append(title);
  for(const [label,method]of [['İndir / hazırla','install'],['Kaldır','remove']]){const b=document.createElement('button');b.textContent=label;b.onclick=safe(async()=>{b.disabled=true;await api.busy(true);try{status(kind+' '+label);if(kind==='stt'&&method==='remove'){releaseMicrophone();await stop();}await api.speech(method,{kind});await packages();status('İşlem tamamlandı.');}finally{b.disabled=false;await api.busy(false);}});node.append(b);}$('packages').append(node);
 }
 const profiles=await api.speech('voices');$('voices').replaceChildren(new Option('Varsayılan ses',''));for(const p of profiles)$('voices').append(new Option(p.name,p.id));const selected=localStorage.getItem('voice-profile');if(profiles.some(p=>p.id===selected))$('voices').value=selected;
}
for(const b of document.querySelectorAll('[data-page]'))b.onclick=()=>{if(window.umayShell)window.umayShell.navigate(b.dataset.page);else{for(const id of ['chat','settings','memory'])$(id).hidden=id!==b.dataset.page;if(b.dataset.page==='settings')safe(packages)();}};
$('settings').addEventListener?.('settings-open',safe(packages));
$('input').addEventListener?.('input',()=>{if(listening)voiceEdited=true;});
$('send').onsubmit=e=>{e.preventDefault();const text=$('input').value;$('input').value='';safe(()=>send(text))();};
$('stop').onclick=safe(stop);$('login').onclick=safe(async()=>{await api.login(window.umayShell?.entry()||'login');window.umayShell?.waiting();status('Varsayılan tarayıcı açıldı. Veriüssü girişi ardından hesabını Umay’a bağla.');});$('refresh').onclick=safe(refresh);
$('logout').onclick=safe(async()=>{await clearAccount();const result=await api.logout();status(result.revoked?'Çıkış yapıldı.':'Yerel çıkış yapıldı; sunucu iptali doğrulanamadı.');});
$('new').onclick=safe(async()=>{await stop();conversation=null;$('messages').replaceChildren();window.umayShell?.reset();});
$('models').onchange=safe(async()=>{await stop();conversation=null;$('messages').replaceChildren();window.umayShell?.reset();status('Seçilen modelle yeni sohbet açılacak.');});
$('hardware').onclick=safe(async()=>{$('devices').textContent=JSON.stringify(await api.speech('hardware'),null,2);});
$('cancel-install').onclick=safe(()=>api.speech('cancel'));
$('clone').onclick=safe(async()=>{await stop();await api.busy(true);$('clone').disabled=true;try{const result=await api.clone();if(result){voice=result.voice;localStorage.setItem('voice-profile',result.id);await packages();$('voices').value=result.id;const warning=(result.quality?.warnings||[]).join(' ');const text='Ses profilin hazır ve seçildi: '+result.name+'. Önizle ile dinleyebilirsin.'+(warning?' '+warning:'');$('clone-quality').textContent=text;status(text);}}finally{$('clone').disabled=false;await api.busy(false);}});
$('select-voice').onclick=safe(async()=>{voice=$('voices').value?await api.speech('select_voice',{id:$('voices').value}):'';localStorage.setItem('voice-profile',$('voices').value);status('Ses seçildi.');});
$('preview').onclick=safe(()=>api.speech('speak',{text:'Merhaba, ben Umay. Bugün sana nasıl yardımcı olabilirim?',voice}));
$('delete-voice').onclick=safe(async()=>{if(!$('voices').value)return;await api.speech('delete_voice',{id:$('voices').value});voice='';localStorage.removeItem('voice-profile');await packages();});
$('load-memory').onclick=safe(async()=>{const epoch=sessionEpoch;const data=await api.api('/site/user-memory');if(epoch===sessionEpoch)$('memory-data').textContent=JSON.stringify(data,null,2);});
$('theme').onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('theme',document.body.classList.contains('dark')?'dark':'light');};if(localStorage.getItem('theme')==='light')document.body.classList.remove('dark');
$('update').onclick=safe(async()=>{const r=await api.update();status(r?.development?'Geliştirme sürümünde otomatik güncelleme kapalı.':'Güncelleme kontrol edildi.');});
$('restart').onclick=safe(()=>api.restartUpdate());
api.onEvent(data=>{if(data.event==='transcript')liveRecognizer?.receive(data);if(data.event==='audio')void play(data.audio).catch(e=>status(e.message));if(data.event==='progress')status(data.kind+': '+data.stage);if(data.event==='session-changed'){clearAccount();safe(refresh)();}if(data.event==='update-ready')$('restart').hidden=false;if(data.event==='error'||data.event==='update-error')status(data.message);if(data.event==='worker-exit'){releaseMicrophone();status('Ses bağlantısı kesildi. Konuşmayı yeniden başlatabilirsin.');}});
safe(async()=>{await refresh();})().catch(()=>{});
safe(async()=>{const state=await api.speech('status');window.umayShell?.speech(state);for(const kind of ['stt','tts'])if(state[kind].installed)await api.speech('load',{kind});const profile=localStorage.getItem('voice-profile');if(profile&&state.tts.installed)voice=await api.speech('select_voice',{id:profile});if(window.umayShell)window.umayShell.speech(await api.speech('status'));})();
