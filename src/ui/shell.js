(()=>{
 const $=id=>document.getElementById(id),api=window.umay;
 let user=null,entry='login',page='home',messageCount=0;
 function authMode(value){
  entry=value==='register'?'register':'login';
  for(const button of document.querySelectorAll('[data-auth]'))button.setAttribute('aria-selected',String(button.dataset.auth===entry));
  $('auth-title').textContent=entry==='register'?'Hesabını oluştur.':'Umay’a hoş geldin.';
  $('auth-description').textContent=entry==='register'?'Bir Veriüssü hesabıyla kendi Umay’ına ilk adımı at.':'Veriüssü hesabınla kendi Umay’ına bağlan.';
  $('auth-action-label').textContent=entry==='register'?'Veriüssü hesabı oluştur':'Veriüssü ile giriş yap';
 }
 function navigate(value){
  if(!['home','chat','settings','memory'].includes(value))return;page=value;
  document.body.classList.remove('history-open');
  for(const id of ['chat','settings','memory'])$(id).hidden=id==='chat'?!['home','chat'].includes(page):id!==page;
  for(const button of document.querySelectorAll('[data-page]')){button.classList.toggle('active',button.dataset.page===page);button.setAttribute('aria-current',button.dataset.page===page?'page':'false');}
  $('page-label').textContent=page==='home'?'Ana Sayfa':'Sohbet';
  $('home-stage').hidden=page!=='home';$('chat-thread').hidden=page!=='chat';$('chat-empty').hidden=messageCount>0;
  if(page==='settings')$('settings').dispatchEvent(new Event('settings-open'));
 }
 function activity(text){
  if(!user)return;const node=document.createElement('div');node.className='activity-item';
  const label=document.createElement('span');label.textContent=text;const time=document.createElement('time');time.textContent=new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});node.append(label,time);
  if(!$('activity').querySelector('.activity-item'))$('activity').replaceChildren();$('activity').prepend(node);
  while($('activity').children.length>4)$('activity').lastElementChild.remove();
 }
 function account(value){
  const changed=user?.id!==value?.id;user=value;$('auth-screen').hidden=!!user;$('workspace').hidden=!user;$('auth-pending').hidden=true;
  if(!user){messageCount=0;$('activity').replaceChildren();$('profile-name').textContent='Hesabın';$('profile-email').textContent='';$('profile-initials').textContent='U';$('greeting-name').textContent='';navigate('home');return;}
  const name=[user.firstName,user.lastName].filter(Boolean).join(' ')||'Veriüssü hesabın';
  $('profile-name').textContent=name;$('profile-email').textContent=user.email||'';$('profile-initials').textContent=name.split(/\s+/).slice(0,2).map(p=>p[0]).join('').toLocaleUpperCase('tr');$('greeting-name').textContent=user.firstName?' '+user.firstName:'';
  if(changed){messageCount=0;navigate('home');activity('Hesabın Umay’a bağlandı.');}void system();
 }
 function speech(state){
  let ready=0;for(const kind of ['stt','tts']){const info=state[kind]||{};if(info.resident)ready++;$(kind+'-state').textContent=info.resident?'Hazır · '+(info.device||'Cihazında'):info.installed?'Kurulu · Hazırlanıyor':info.upgradeAvailable?'Canlı STT güncellemesi gerekli':'Paket henüz indirilmedi';$(kind+'-dot').classList.toggle('ready',!!info.resident);}
  $('speech-value').textContent=ready+'/2';
 }
 async function system(){
  if(!user||document.hidden||!api.system)return;
  try{const state=await api.system();if(!user)return;
   for(const key of ['cpu','ram','disk'])$(key+'-value').textContent=Number.isFinite(state[key])?'%'+Math.round(state[key]):'—';
   $('system-caption').textContent=state.memoryGB+' GB RAM · '+state.platform;
   for(const node of document.querySelectorAll('.app-version'))node.textContent=state.version;
  }catch{$('system-caption').textContent='Sistem bilgisi alınamadı';}
 }
 for(const button of document.querySelectorAll('[data-auth]'))button.onclick=()=>authMode(button.dataset.auth);
 for(const button of document.querySelectorAll('[data-go]'))button.onclick=()=>navigate(button.dataset.go);
 for(const button of document.querySelectorAll('[data-window]'))button.onclick=()=>void api.window(button.dataset.window);
 $('start-chat').onclick=()=>{$('new').click();navigate('chat');$('input').focus();};
 $('history-toggle').onclick=()=>document.body.classList.toggle('history-open');
 $('history-close').onclick=()=>document.body.classList.remove('history-open');
 document.addEventListener('keydown',event=>{if(event.key==='Escape')document.body.classList.remove('history-open');});
 $('cancel-login').onclick=async()=>{try{await api.cancelLogin();$('auth-pending').hidden=true;$('auth-status').textContent='Giriş iptal edildi. Hazır olduğunda yeniden deneyebilirsin.';}catch{$('auth-status').textContent='Giriş iptal edilemedi. Yeniden dene.';}};
 function clock(){const now=new Date();$('clock').textContent=now.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});$('date').textContent=now.toLocaleDateString('tr-TR',{day:'numeric',month:'long',weekday:'short'});}
 clock();setInterval(clock,30000);setInterval(system,4000);
 window.umayShell={entry:()=>entry,navigate,account,speech,activity,
  status:text=>{$('auth-status').textContent=text;},
  waiting:()=>{$('auth-pending').hidden=false;},
  message:(role,record)=>{messageCount=$('messages').children.length;$('chat-empty').hidden=messageCount>0;navigate('chat');if(record)activity(String(role).toLowerCase()==='user'?'Yeni mesaj gönderildi.':'Umay yanıtladı.');},
  history:count=>{$('history-count').textContent=count+' sohbet';$('history-empty').hidden=count>0;},
  reset:()=>{messageCount=0;$('chat-empty').hidden=false;},
  listening:active=>{document.body.classList.toggle('is-listening',active);$('listen').title=active?'Dinlemeyi kapat':'Konuşmayı başlat';},
  speaking:active=>document.body.classList.toggle('is-speaking',active)
 };
 navigate('home');
})();
