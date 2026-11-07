const $=id=>document.getElementById(id);const api=window.umay;
let pendingRunCancel=Promise.resolve(),pendingSubmission=Promise.resolve();
let conversation=null,runId=null,ticket=0,models=[],voice='',audioContext,playHead=0,sources=[],listening=false,stream,capture,accountId=null,sessionEpoch=0,responseActive=false;
let pre=[],frames=[],voiced=0,silence=0,recording=false,transcribing=false,noise=.0005;
let captureModule, microphoneSource, microphoneGain, inputFrames=0, microphoneEpoch=0,inputContext,liveRecognizer=null,liveDraft='',voiceEdited=false,echoGuardUntil=0,playbackSuppressed=false,gateFrames=[];
let computerControlTimer=null;
let playbackId=crypto.randomUUID(),audioQueue=Promise.resolve();
const status=text=>{$('status').textContent=text;window.umayShell?.status(text);};
const playbackEcho=new window.PlaybackEcho();
const safe=fn=>async(...args)=>{try{return await fn(...args);}catch(e){const text=e.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');status(window.UmayErrors.isKnown(text)?errorText(text):text);}};
function errorText(code){const info=window.UmayErrors.describe(code);return info.title+'\n'+info.message;}
function showChatError(code){const text=errorText(code);const node=message('error',text,false);node.setAttribute?.('role','alert');status(text);}
function clearAccount(){window.umayBrowser?.reset();window.umayComputerChat?.reset();window.umayDevice?.reset();++sessionEpoch;accountId=null;conversation=null;models=[];releaseMicrophone();$('messages').replaceChildren();$('history').replaceChildren();$('models').replaceChildren();$('memory-data').textContent='';window.umayShell?.history(0);window.umayShell?.account(null);return stop();}
function message(role,text,record=true){const node=document.createElement('div');node.className='message '+String(role).toLowerCase();node.textContent=text;$('messages').append(node);window.umayShell?.message(role,record);node.scrollIntoView();return node;}
async function refresh(){
 const epoch=++sessionEpoch;let user;try{user=await api.api('/site/auth/me');}catch(e){if(epoch!==sessionEpoch)return;if(epoch===sessionEpoch){if(accountId!==null){const cleanup=clearAccount(),cleared=sessionEpoch;await cleanup;if(cleared!==sessionEpoch)return;}if(/Oturum doğrulaması gerekli|LOGIN_REQUIRED/.test(e.message)){window.umayShell?.account(null);status('Devam etmek için Veriüssü hesabınla giriş yap.');return;}}throw e;}if(epoch!==sessionEpoch)return;
 if(accountId!==user.id){window.umayBrowser?.reset();await stop();if(epoch!==sessionEpoch)return;conversation=null;$('messages').replaceChildren();$('history').replaceChildren();$('memory-data').textContent='';accountId=user.id;}
 window.umayShell?.account(user);status(`Bağlı hesap: ${user.email||user.firstName||user.id}`);
 const result=await api.api('/site/chat/models');if(epoch!==sessionEpoch)return;models=result.models||[];$('models').replaceChildren();
 for(const m of models){const o=document.createElement('option');o.value=m.id;o.textContent=m.name;o.dataset.source=m.source;$('models').append(o);}
 window.umayDevice?.modelsChanged();await window.umayModelRoles?.load();if(epoch!==sessionEpoch)return;
 const history=await api.api('/site/chat/conversations');if(epoch!==sessionEpoch)return;$('history').replaceChildren();
 window.umayShell?.history((history.conversations||[]).length);
 for(const c of history.conversations||[]){const b=document.createElement('button');b.textContent=c.title;b.onclick=safe(async()=>{const historyEpoch=sessionEpoch;const historyTicket=++ticket;await stop(false);if(historyEpoch!==sessionEpoch||historyTicket!==ticket)return;const detail=await api.api('/site/chat/conversations/'+c.id);if(historyEpoch!==sessionEpoch||historyTicket!==ticket)return;conversation=detail.conversation;$('messages').replaceChildren();for(const m of detail.messages)message(m.role,m.content,false);});$('history').append(b);}
}
function clearVoiceDraft(){
 if(!voiceEdited&&liveDraft&&$('input').value===liveDraft)$('input').value='';
 liveDraft='';voiceEdited=false;$('live-caption').hidden=true;
}
function silenceReply(){
 playbackId=crypto.randomUUID();audioQueue=Promise.resolve();const hadPlayback=sources.length>0;sources.forEach(source=>{try{source.stop();}catch{}});sources=[];if(audioContext)playbackEcho.stop(audioContext.currentTime);playHead=0;if(hadPlayback)echoGuardUntil=Date.now()+200;window.umayShell?.speaking(false);
 void api.speech('cancel').catch(()=>{});
}
function speakReply(text,current=ticket){if(current!==ticket)return Promise.resolve();return api.speech('speak',{text,voice,playbackId});}
async function stop(advance=true,preserveCapture=false,preserveComputer=false,cancelServer=false){
 if(advance)++ticket;silenceReply();
 const previous=runId;runId=null;responseActive=false;
 // Local output is stopped synchronously. A cold Python worker must not hold
 // a text message behind speech-library startup before its cancel ack arrives.
 const computerCancel=!preserveComputer&&window.umayComputerChat?.running()&&api.computer?api.computer('stop').catch(()=>{}):Promise.resolve();
 const cancelRun=previous&&cancelServer?api.api('/site/chat/runs/'+previous+'/cancel',{}).catch(()=>{}):Promise.resolve();
 pendingRunCancel=Promise.all([pendingRunCancel,cancelRun,computerCancel]).then(()=>{});
 const idle=api.busy(false);
 let reset=Promise.resolve();
 if(!preserveCapture){recording=false;frames=[];pre=[];voiced=0;silence=0;gateFrames=[];clearVoiceDraft();if(liveRecognizer)reset=liveRecognizer.reset().catch(error=>{releaseMicrophone();status(error.message);});}
 await Promise.all([pendingRunCancel,idle,reset]);
}
function replySpeech(output,text,final=false){
 if(output.current!==ticket||!$('speak').checked)return output.tail;
 if(!text.startsWith(output.spoken)){silenceReply();output.spoken='';}
 let end=final?text.length:output.spoken.length;
 if(!final)for(const match of text.matchAll(/[.!?…](?=\s)/g)){
  const prefix=text.slice(0,match.index+1),word=prefix.match(/([^\s]+)$/)?.[1]||'';
  if(/\d\.$|^[A-ZÇĞİÖŞÜ]\.$|^(?:Dr|Prof|Doç|Sn|vb|vs)\.$/u.test(word))continue;
  if(match.index+1>output.spoken.length)end=match.index+1;
 }
 const part=text.slice(output.spoken.length,end).trim();if(!part)return output.tail;
 output.spoken=text.slice(0,end);
 output.tail=output.tail.then(()=>output.current===ticket?speakReply(part,output.current):undefined);return output.tail;
}
function showReplyDraft(output,text){
 if(output.current!==ticket||typeof text!=='string'||!text.trim())return;
 if(!output.node)output.node=message('assistant',text,false);else output.node.textContent=text;
 void replySpeech(output,text).catch(error=>{if(output.current===ticket)status(error.message);});
}
function submitMessage(text,current,output){
 // Superseding a turn only quarantines its local output. Account for every
 // accepted run, including an in-flight POST, before writing the next turn.
 const submission=pendingSubmission.then(async()=>{
  if(current!==ticket)return null;
  let before=[];
  if(!conversation){const option=$('models').selectedOptions[0],m=models.find(x=>x.id===option?.value&&x.source===option?.dataset.source);if(!m)throw Error('Önce Ayarlar / Modeller sayfasından erişilebilir bir sohbet modeli seçin.');
   const created=await api.api('/site/chat/conversations',{source:m.source,modelId:m.id,title:text.slice(0,140),requestId:crypto.randomUUID()});
   if(current!==ticket)return;conversation=created.conversation;
  }else{
   const detail=await api.api('/site/chat/conversations/'+conversation.id);if(current!==ticket)return;
   conversation=detail.conversation;before=detail.messages||[];
  }
  const conversationId=conversation.id;
  const posted=await api.api('/site/chat/conversations/'+conversationId+'/messages',{content:text,requestId:crypto.randomUUID(),expectedVersion:Number(conversation.version),kind:'CHAT'});
  const acceptedRunId=posted.run.id;if(current===ticket)runId=acceptedRunId;
  const deadline=Date.now()+180000;
  let run;
  while(true){
   const result=await api.api('/site/chat/runs/'+acceptedRunId);run={...posted.run,...result.run};
   if(output&&current===ticket&&run.status==='RUNNING'&&run.phase==='generating'&&run.draftContent)showReplyDraft(output,run.draftContent);
   if(!['QUEUED','RUNNING'].includes(run.status))break;
   if(Date.now()>deadline)throw Error('Yanıt zaman aşımı; durdurup yeniden deneyin.');
   if(current===ticket)status(run.phase==='reviewing'?'Yanıt kontrol ediliyor…':run.status==='QUEUED'?'Model sırası bekleniyor…':'Model yanıtı hazırlanıyor…');
   await new Promise(r=>setTimeout(r,250));
  }
  if(runId===acceptedRunId)runId=null;
  if(!['COMPLETED','SUCCEEDED'].includes(run.status))return {run};
  const detail=await api.api('/site/chat/conversations/'+conversationId);
  return {run,detail,reply:currentReply(detail.messages||[],before,run,text)};
 });
 pendingSubmission=submission.then(()=>{},()=>{});return submission;
}
function currentReply(messages,before,run,text){
 const assistant=m=>String(m.role).toLowerCase()==='assistant'&&!m.localComputerTask;
 const assistantId=run.assistantMessageId||run.mediaOptions?.desktopChatTask?.anchorMessageId;
 if(assistantId)return messages.find(m=>m.id===assistantId&&assistant(m));
 const seen=new Set(before.map(m=>m.id).filter(Boolean));
 const anchors=messages.map((m,index)=>({m,index})).filter(({m})=>String(m.role).toLowerCase()==='user'&&(run.userMessageId?m.id===run.userMessageId:m.content===text&&(!m.id||!seen.has(m.id))));
 if(anchors.length!==1)return;
 const replies=[];
 for(const m of messages.slice(anchors[0].index+1)){
  if(String(m.role).toLowerCase()==='user')break;
  if(assistant(m)&&(!m.id||!seen.has(m.id)))replies.push(m);
 }
 return replies.length===1?replies[0]:undefined;
}
async function send(text,fromVoice=false){
 if(!text.trim())return;
 const explicitNew=/^\s*yeni\s+(?:görev|iş)\s*:/iu.test(text);if(explicitNew)text=text.replace(/^\s*yeni\s+(?:görev|iş)\s*:\s*/iu,'');
 clearTimeout(computerControlTimer);computerControlTimer=null;
 const localCommand=window.ComputerCommands?.computerCommand(text);
 if(localCommand&&window.umayComputerChat?.canControl?.(localCommand)){
  const current=++ticket,operation=window.umayComputerChat.control(localCommand,text);await stop(false,fromVoice,true);message('user',text);
  const result=await operation;if(result&&current===ticket)await finishComputerReply(result,current);return;
 }
 if(!explicitNew&&window.umayComputerChat?.pending()){
  const current=++ticket;await stop(false,fromVoice,true);if(current!==ticket)return;
  message('user',window.umayComputerChat.pending()?.requiresInput?.kind==='otp'?'[Tek kullanımlık kod yerelde iletildi]':text);await api.busy(true);responseActive=true;
  try{const result=await window.umayComputerChat.answer(text);if(current===ticket&&result)await finishComputerReply(result,current);
  }finally{if(current===ticket){responseActive=false;if(!sources.length)await api.busy(false);}}
  return;
 }
 const current=++ticket;if(window.umayComputerChat?.running())await api.computer('pause-for-new-task');await stop(false,fromVoice,true,false);if(current!==ticket)return;await api.busy(true);if(current!==ticket)return;responseActive=true;message('user',text);status('Yanıt hazırlanıyor…');
 const output={current,node:null,spoken:'',tail:Promise.resolve()};
 try{
  const completed=await submitMessage(text,current,output);if(!completed||current!==ticket)return;
  const {run,detail,reply:last}=completed;
    if(!['COMPLETED','SUCCEEDED'].includes(run.status)){
     if(output.node){output.node.textContent='Yanıt tamamlanamadı.';silenceReply();}showChatError(run.errorCode||run.status);return;
    }
    conversation=detail.conversation;
    if(!last){if(output.node){output.node.textContent='Yanıt tamamlanamadı.';silenceReply();}showChatError('INVALID_PROVIDER_RESPONSE');return;}
    if(last){if(output.node){output.node.textContent=last.content;window.umayShell?.message('assistant',true);}else message('assistant',last.content);}
    if(last&&run.mediaOptions?.desktopChatTask&&window.umayComputerChat){
     const acknowledgement=replySpeech(output,last.content,true).catch(error=>{if(current===ticket)status(error.message);});
     const result=await window.umayComputerChat.dispatch(run);if(current!==ticket)return;await acknowledgement;if(result)await finishComputerReply(result,current);
    }else if(last&&$('speak').checked){status('Seslendiriliyor…');await replySpeech(output,last.content,true);}
  if(current===ticket)status('Hazır.');
 }catch(error){if(current===ticket)showChatError(error.message);}finally{if(current===ticket){responseActive=false;if(!sources.length)await api.busy(false);}}
}
async function finishComputerReply(result,current=ticket){
 if(current!==ticket)return;window.umayComputerChat?.paint(result);
 if(result.status==='failed'){const text=window.UmayErrors.isKnown(result.message)?errorText(result.message):result.message;message('error',text,false);status(text);return;}
 if(result.message){message('assistant',result.message);status(result.message);if($('speak').checked)await speakReply(result.message,current);}
}
async function play(data,generation=ticket,expectedPlaybackId=playbackId){
 const stale=()=>generation!==ticket||expectedPlaybackId!==playbackId;
 if(stale())return;audioContext ||= new AudioContext();await audioContext.resume();if(stale())return;const raw=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
 const buffer=await audioContext.decodeAudioData(raw.buffer);if(stale())return;
 await api.busy(true);if(stale())return;const source=audioContext.createBufferSource();source.buffer=buffer;source.connect(audioContext.destination);
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
   clearTimeout(computerControlTimer);computerControlTimer=null;
   const command=window.ComputerCommands?.computerCommand(text);
   if(['pause','stop'].includes(command)&&window.umayComputerChat?.canControl?.(command))computerControlTimer=setTimeout(()=>{
    computerControlTimer=null;if(!listening||!window.umayComputerChat?.canControl?.(command))return;void (async()=>{const current=++ticket,operation=window.umayComputerChat.control(command,text);await stop(false,true,true);const result=await operation;if(result&&current===ticket)status(result.message);})().catch(error=>status(error.message));
   },150);
   // Partials can be corrected or discarded. Only a final instruction supersedes
   // a pending answer; real playback barge-in keeps its local energy/echo gate.
   if($('input').value!==liveDraft&&$('input').value.trim())voiceEdited=true;
   if(!voiceEdited){$('input').value=text;liveDraft=text;}
   $('live-caption').hidden=!text;$('live-text').textContent=text;$('voice-status').textContent='Seni dinliyorum…';
  },
  onFinal:text=>{
   if(!listening||playbackSuppressed)return;recording=false;voiced=0;silence=0;
   clearTimeout(computerControlTimer);computerControlTimer=null;
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
  if(sources.length)void stop(true,true,!!window.umayComputerChat?.running(),false).catch(error=>status(error.message));
 }
 if(!gated||recording){if(!replayed)liveRecognizer?.accept(frame);}else liveRecognizer?.accept(new Float32Array(frame.length));
 if(!gated)gateFrames=[];
 if(silence>=30){recording=false;voiced=0;}
}
function releaseMicrophone(){
 clearTimeout(computerControlTimer);computerControlTimer=null;
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
$('models').onchange=safe(async()=>{const option=$('models').selectedOptions[0],model=models.find(m=>m.id===option?.value&&m.source===option?.dataset.source);await window.umayModelRoles?.selectChat(model);await stop();conversation=null;$('messages').replaceChildren();window.umayShell?.reset();status('Seçilen modelle yeni sohbet açılacak.');});
$('hardware').onclick=safe(async()=>{$('devices').textContent=JSON.stringify(await api.speech('hardware'),null,2);});
$('cancel-install').onclick=safe(()=>api.speech('cancel'));
$('clone').onclick=safe(async()=>{await stop();await api.busy(true);$('clone').disabled=true;try{const result=await api.clone();if(result){voice=result.voice;localStorage.setItem('voice-profile',result.id);await packages();$('voices').value=result.id;const warning=(result.quality?.warnings||[]).join(' ');const text='Ses profilin hazır ve seçildi: '+result.name+'. Önizle ile dinleyebilirsin.'+(warning?' '+warning:'');$('clone-quality').textContent=text;status(text);}}finally{$('clone').disabled=false;await api.busy(false);}});
$('select-voice').onclick=safe(async()=>{voice=$('voices').value?await api.speech('select_voice',{id:$('voices').value}):'';localStorage.setItem('voice-profile',$('voices').value);status('Ses seçildi.');});
$('preview').onclick=safe(()=>speakReply('Merhaba, ben Umay. Bugün sana nasıl yardımcı olabilirim?'));
$('delete-voice').onclick=safe(async()=>{if(!$('voices').value)return;await api.speech('delete_voice',{id:$('voices').value});voice='';localStorage.removeItem('voice-profile');await packages();});
$('load-memory').onclick=safe(async()=>{const epoch=sessionEpoch;const data=await api.api('/site/user-memory');if(epoch===sessionEpoch)$('memory-data').textContent=JSON.stringify(data,null,2);});
$('theme').onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('theme',document.body.classList.contains('dark')?'dark':'light');};if(localStorage.getItem('theme')==='light')document.body.classList.remove('dark');
$('update').onclick=safe(async()=>{const r=await api.update();status(r?.development?'Geliştirme sürümünde otomatik güncelleme kapalı.':'Güncelleme kontrol edildi.');});
$('restart').onclick=safe(()=>api.restartUpdate());
api.onEvent(data=>{if(data.event==='transcript')liveRecognizer?.receive(data);if(data.event==='audio'&&(!data.playbackId||data.playbackId===playbackId)){const generation=ticket,id=playbackId;audioQueue=audioQueue.then(()=>play(data.audio,generation,id)).catch(e=>status(e.message));}if(data.event==='progress')status(data.kind+': '+data.stage);if(data.event==='session-changed'){clearAccount();safe(refresh)();}if(data.event==='update-ready')$('restart').hidden=false;if(data.event==='error'||data.event==='update-error')status(data.message);if(data.event==='worker-exit'){releaseMicrophone();status('Ses bağlantısı kesildi. Konuşmayı yeniden başlatabilirsin.');}});
safe(async()=>{await refresh();})().catch(()=>{});
safe(async()=>{const state=await api.speech('status');window.umayShell?.speech(state);for(const kind of ['stt','tts'])if(state[kind].installed)await api.speech('load',{kind});const profile=localStorage.getItem('voice-profile');if(profile&&state.tts.installed)voice=await api.speech('select_voice',{id:profile});if(window.umayShell)window.umayShell.speech(await api.speech('status'));})();
