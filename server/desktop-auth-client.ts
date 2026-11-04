export const desktopAuthScript=String.raw`
(()=>{
 const $=id=>document.getElementById(id),form=$('auth-form'),button=$('approve');
 if(!form)return;
 const linking=form.dataset.mode==='authorize';let accountRequest=0,submitting=false,hasAccount=false,finished=false;
 const setStatus=text=>$('status').textContent=text;
 try{const theme=localStorage.getItem('umay-auth-theme');if(theme==='light'||theme==='dark')document.documentElement.dataset.theme=theme;}catch{}
 $('theme').addEventListener('click',()=>{
  const current=document.documentElement.dataset.theme||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');
  const theme=current==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;
  try{localStorage.setItem('umay-auth-theme',theme);}catch{}
 });
 async function refreshAccount(){
  if(submitting||finished)return;const request=++accountRequest;button.disabled=true;$('account').setAttribute('aria-busy','true');
  try{
   const response=await fetch('/site/auth/me',{credentials:'same-origin',cache:'no-store'});
   if(request!==accountRequest)return;
   if(response.status===401){
    hasAccount=false;$('account-name').textContent='Veriüssü hesabın';$('account-email').textContent=linking?'Devam etmek için giriş yap':'Bu tarayıcıda açık oturum yok';
    $('avatar').textContent='V';$('account-check').hidden=true;button.hidden=true;$('sign-in').hidden=!linking;$('register').hidden=!linking;setStatus('');return;
   }
   if(!response.ok)throw Error();const user=await response.json();if(request!==accountRequest)return;
   const name=[user.firstName,user.lastName].filter(Boolean).join(' ').trim()||'Veriüssü hesabın';
   $('account-name').textContent=name;$('account-email').textContent=user.email||'Hesabın bağlanmaya hazır';
   $('avatar').textContent=name.split(/\s+/).slice(0,2).map(part=>part[0]).join('').toLocaleUpperCase('tr');
   hasAccount=true;$('account-check').hidden=false;button.hidden=false;button.disabled=false;$('sign-in').hidden=true;$('register').hidden=true;setStatus('');
  }catch{if(request===accountRequest){hasAccount=false;button.disabled=true;setStatus('Hesap bilgisi alınamadı. Bağlantını kontrol edip hesabı yenile.');}}
  finally{if(request===accountRequest)$('account').setAttribute('aria-busy','false');}
 }
 $('refresh-account').addEventListener('click',refreshAccount);
 window.addEventListener('focus',refreshAccount);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refreshAccount();});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(submitting||!hasAccount||button.disabled||finished)return;
  submitting=true;++accountRequest;button.disabled=true;button.textContent=linking?'Hesabın bağlanıyor…':'Oturum kapatılıyor…';setStatus('');
  try{
   const response=await fetch(form.action,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});
   if(!response.ok)throw Error(response.status===401?'Oturumun sona erdi. Yeniden giriş yapıp hesabı yenile.':response.status===429?'Çok fazla deneme yaptın. Bir dakika sonra yeniden dene.':'İşlem tamamlanamadı. Hesabı yenileyip tekrar dene.');
   const data=await response.json();
   if(linking){
    const target=new URL(data.redirectUrl);
    if(target.protocol!=='http:'||target.hostname!=='127.0.0.1'||!target.port||target.username||target.password||target.pathname!=='/umay-auth/callback')throw Error('Geçersiz dönüş adresi. Umay uygulamasından yeniden giriş başlat.');
    location.assign(target.href);
   }else{
    finished=true;$('title').textContent='Çıkış tamamlandı';$('intro').textContent='Veriüssü oturumun kapatıldı. Bu sekmeyi kapatabilirsin.';
    form.hidden=true;$('account').hidden=true;$('refresh-account').hidden=true;
   }
  }catch(error){setStatus(error.message);button.disabled=false;}
  finally{submitting=false;button.textContent=linking?'Hesabımı Umay’a bağla':'Veriüssü oturumundan çık';}
 });
 void refreshAccount();
})();`;
