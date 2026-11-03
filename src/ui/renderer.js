const $=id=>document.getElementById(id);const api=window.umay;
let conversation=null,runId=null,ticket=0,models=[],voice='',audioContext,playHead=0,sources=[],listening=false,stream,capture,accountId=null,sessionEpoch=0;
let pre=[],frames=[],voiced=0,silence=0,recording=false,transcribing=false,noise=.003;
const status=text=>$('status').textContent=text;
const safe=fn=>async(...args)=>{try{return await fn(...args);}catch(e){status(e.message);}};
function clearAccount(){++sessionEpoch;accountId=null;conversation=null;models=[];$('messages').replaceChildren();$('history').replaceChildren();$('models').replaceChildren();$('memory-data').textContent='';void stop();}
function message(role,text){const node=document.createElement('div');node.className='message '+role;node.textContent=text;$('messages').append(node);node.scrollIntoView();return node;}
async function refresh(){
 const epoch=++sessionEpoch;let user;try{user=await api.api('/site/auth/me');}catch(e){if(epoch===sessionEpoch&&accountId!==null)clearAccount();throw e;}if(epoch!==sessionEpoch)return;
 if(accountId!==user.id){await stop();if(epoch!==sessionEpoch)return;conversation=null;$('messages').replaceChildren();$('history').replaceChildren();$('memory-data').textContent='';accountId=user.id;}
 status(`Bağlı hesap: ${user.email||user.firstName||user.id}`);
 const result=await api.api('/site/chat/models');if(epoch!==sessionEpoch)return;models=result.models||[];$('models').replaceChildren();
 for(const m of models){const o=document.createElement('option');o.value=m.id;o.textContent=m.name;o.dataset.source=m.source;$('models').append(o);}
 const history=await api.api('/site/chat/conversations');if(epoch!==sessionEpoch)return;$('history').replaceChildren();
 for(const c of history.conversations||[]){const b=document.createElement('button');b.textContent=c.title;b.onclick=safe(async()=>{const historyEpoch=sessionEpoch;const historyTicket=++ticket;await stop(false);if(historyEpoch!==sessionEpoch||historyTicket!==ticket)return;const detail=await api.api('/site/chat/conversations/'+c.id);if(historyEpoch!==sessionEpoch||historyTicket!==ticket)return;conversation=detail.conversation;$('messages').replaceChildren();for(const m of detail.messages)message(m.role,m.content);});$('history').append(b);}
}
async function stop(advance=true,preserveCapture=false){
 if(advance)++ticket;sources.forEach(s=>{try{s.stop();}catch{}});sources=[];playHead=0;
 if(!preserveCapture){recording=false;frames=[];pre=[];voiced=0;silence=0;}
 const previous=runId;runId=null;await api.speech('cancel').catch(()=>{});
 if(previous)await api.api('/site/chat/runs/'+previous+'/cancel',{}).catch(()=>{});
 await api.busy(false);
}
async function send(text){
 if(!text.trim())return;
 const current=++ticket;await stop(false);if(current!==ticket)return;await api.busy(true);message('user',text);status('Yanıt hazırlanıyor…');
 try{
  if(!conversation){const m=models.find(x=>x.id===$('models').value);if(!m)throw Error('Önce giriş yapıp bir model seçin.');
   const created=await api.api('/site/chat/conversations',{source:m.source,modelId:m.id,title:text.slice(0,140),requestId:crypto.randomUUID()});
   if(current!==ticket)return;conversation=created.conversation;
  }
  const posted=await api.api('/site/chat/conversations/'+conversation.id+'/messages',{content:text,requestId:crypto.randomUUID(),expectedVersion:Number(conversation.version),kind:'CHAT'});
  if(current!==ticket){if(posted.run?.id)await api.api('/site/chat/runs/'+posted.run.id+'/cancel',{});return;}
  runId=posted.run.id;
  const deadline=Date.now()+180000;
  while(current===ticket){
   const {run}=await api.api('/site/chat/runs/'+runId);
   if(!['QUEUED','RUNNING'].includes(run.status)){
    if(run.status!=='COMPLETED'&&run.status!=='SUCCEEDED')status(`Yanıt durumu: ${run.status}`);
    const detail=await api.api('/site/chat/conversations/'+conversation.id);
    if(current!==ticket)return;conversation=detail.conversation;
    const last=[...detail.messages].reverse().find(m=>m.role.toLowerCase()==='assistant');
    if(last){message('assistant',last.content);if($('speak').checked)await api.speech('speak',{text:last.content,voice});}
    runId=null;break;
   }
   if(Date.now()>deadline)throw Error('Yanıt zaman aşımı; durdurup yeniden deneyin.');
   await new Promise(r=>setTimeout(r,600));
  }
  if(current===ticket)status('Hazır.');
 }finally{if(current===ticket&&!sources.length)await api.busy(false);}
}
async function play(data){
 const generation=ticket;audioContext ||= new AudioContext();await audioContext.resume();if(generation!==ticket)return;const raw=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
 const buffer=await audioContext.decodeAudioData(raw.buffer);if(generation!==ticket)return;
 await api.busy(true);if(generation!==ticket)return;const source=audioContext.createBufferSource();source.buffer=buffer;source.connect(audioContext.destination);
 playHead=Math.max(audioContext.currentTime+.03,playHead);source.start(playHead);playHead+=buffer.duration;sources.push(source);
 source.onended=()=>{sources=sources.filter(s=>s!==source);if(!sources.length&&!runId)void api.busy(false);};
}
function pcmBase64(parts){const floats=parts.flatMap(x=>Array.from(x));const output=new Int16Array(floats.length);for(let i=0;i<output.length;i++)output[i]=Math.max(-1,Math.min(1,floats[i]))*32767;
 const bytes=new Uint8Array(output.buffer);let result='';for(let i=0;i<bytes.length;i+=8192)result+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(result);
}
async function onFrame(frame){
 if(!listening||transcribing)return;
 const rms=Math.sqrt(frame.reduce((sum,x)=>sum+x*x,0)/frame.length);
 const speech=rms>Math.max(.015,noise*3);if(!speech)noise=noise*.98+rms*.02;
 pre.push(frame);if(pre.length>15)pre.shift();
 if(speech){voiced++;silence=0;}else{silence++;if(!recording)voiced=0;}
 if(!recording&&voiced>=5){recording=true;frames=[...pre];$('voice-status').textContent='Seni dinliyorum';if(sources.length||runId)await stop(true,true);}
 else if(recording)frames.push(frame);
 if(recording&&(silence>=30||frames.length>=3000)){
  recording=false;voiced=0;transcribing=true;const parts=frames;frames=[];pre=[];
  const transcriptionTicket=ticket;try{const text=await api.speech('transcribe',{audio:pcmBase64(parts)});transcribing=false;if(listening&&transcriptionTicket===ticket&&text)void safe(()=>send(text))();}catch(e){status(e.message);}finally{transcribing=false;}
 }
}
$('listen').onclick=safe(async()=>{
 if(listening){listening=false;stream?.getTracks().forEach(t=>t.stop());capture?.disconnect();await stop();$('listen').textContent='Konuşmayı başlat';return;}
 audioContext ||= new AudioContext();await audioContext.resume();
 stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
 await audioContext.audioWorklet.addModule('capture.js');capture=new AudioWorkletNode(audioContext,'capture');
 audioContext.createMediaStreamSource(stream).connect(capture);const zero=audioContext.createGain();zero.gain.value=0;capture.connect(zero).connect(audioContext.destination);
 capture.port.onmessage=e=>void onFrame(e.data);listening=true;$('listen').textContent='Dinlemeyi kapat';status('Dinleniyor. Hoparlör barge-in doğrulaması bu cihazda henüz tamamlanmadı.');
});
async function packages(){
 const state=await api.speech('status');$('packages').replaceChildren();
 for(const [kind,info]of Object.entries(state)){
  const node=document.createElement('div');const title=document.createElement('strong');title.textContent=`${kind.toUpperCase()} · ${info.resident?'Hazır / '+info.device:info.installed?'Kurulu':'Kurulu değil'}`;node.append(title);
  for(const [label,method]of [['İndir / hazırla','install'],['Kaldır','remove']]){const b=document.createElement('button');b.textContent=label;b.onclick=safe(async()=>{b.disabled=true;await api.busy(true);try{status(kind+' '+label);await api.speech(method,{kind});await packages();status('İşlem tamamlandı.');}finally{b.disabled=false;await api.busy(false);}});node.append(b);}$('packages').append(node);
 }
 const profiles=await api.speech('voices');$('voices').replaceChildren(new Option('Varsayılan ses',''));for(const p of profiles)$('voices').append(new Option(p.name,p.id));
}
for(const b of document.querySelectorAll('[data-page]'))b.onclick=()=>{for(const id of ['chat','settings','memory'])$(id).hidden=id!==b.dataset.page;if(b.dataset.page==='settings')safe(packages)();};
$('send').onsubmit=e=>{e.preventDefault();const text=$('input').value;$('input').value='';safe(()=>send(text))();};
$('stop').onclick=safe(stop);$('login').onclick=safe(async()=>{await api.login();status('Varsayılan tarayıcı açıldı. Veriüssü girişi ardından hesabınızı Umay’a bağlayın.');});$('refresh').onclick=safe(refresh);
$('logout').onclick=safe(async()=>{++sessionEpoch;accountId=null;await stop();listening=false;stream?.getTracks().forEach(t=>t.stop());const result=await api.logout();conversation=null;models=[];$('messages').replaceChildren();$('history').replaceChildren();$('models').replaceChildren();$('memory-data').textContent='';status(result.revoked?'Çıkış yapıldı.':'Yerel çıkış yapıldı; sunucu iptali doğrulanamadı.');});
$('new').onclick=safe(async()=>{await stop();conversation=null;$('messages').replaceChildren();});
$('models').onchange=safe(async()=>{await stop();conversation=null;$('messages').replaceChildren();status('Seçilen modelle yeni sohbet açılacak.');});
$('hardware').onclick=safe(async()=>{$('devices').textContent=JSON.stringify(await api.speech('hardware'),null,2);});
$('cancel-install').onclick=safe(()=>api.speech('cancel'));
$('clone').onclick=safe(async()=>{await api.busy(true);try{const result=await api.clone();if(result)status('Klon profil oluşturuldu: '+result.name);await packages();}finally{await api.busy(false);}});
$('select-voice').onclick=safe(async()=>{voice=$('voices').value?await api.speech('select_voice',{id:$('voices').value}):'';localStorage.setItem('voice-profile',$('voices').value);status('Ses seçildi.');});
$('preview').onclick=safe(()=>api.speech('speak',{text:'Merhaba, ben Umay. Bugün sana nasıl yardımcı olabilirim?',voice}));
$('delete-voice').onclick=safe(async()=>{if(!$('voices').value)return;await api.speech('delete_voice',{id:$('voices').value});voice='';localStorage.removeItem('voice-profile');await packages();});
$('load-memory').onclick=safe(async()=>{const epoch=sessionEpoch;const data=await api.api('/site/user-memory');if(epoch===sessionEpoch)$('memory-data').textContent=JSON.stringify(data,null,2);});
$('theme').onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('theme',document.body.classList.contains('dark')?'dark':'light');};if(localStorage.getItem('theme')==='dark')document.body.classList.add('dark');
$('update').onclick=safe(async()=>{const r=await api.update();status(r?.development?'Geliştirme sürümünde otomatik güncelleme kapalı.':'Güncelleme kontrol edildi.');});
$('restart').onclick=safe(()=>api.restartUpdate());
api.onEvent(data=>{if(data.event==='audio')void play(data.audio).catch(e=>status(e.message));if(data.event==='progress')status(data.kind+': '+data.stage);if(data.event==='session-changed'){clearAccount();safe(refresh)();}if(data.event==='update-ready')$('restart').hidden=false;if(data.event==='error'||data.event==='update-error')status(data.message);if(data.event==='worker-exit')status('Ses işçisi kapandı. Sonraki işlemde yeniden başlatılacak.');});
safe(async()=>{await refresh();})().catch(()=>{});
safe(async()=>{const state=await api.speech('status');for(const kind of ['stt','tts'])if(state[kind].installed)await api.speech('load',{kind});const profile=localStorage.getItem('voice-profile');if(profile&&state.tts.installed)voice=await api.speech('select_voice',{id:profile});})();
