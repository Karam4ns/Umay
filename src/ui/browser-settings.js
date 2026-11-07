(()=>{
 const $=id=>document.getElementById(id),api=window.umay;let epoch=0;
 function note(text){$('browser-status').textContent=text;}
 function help(){const existing=$('browser-mode').value==='existing';$('browser-help').textContent=existing?'Chrome’da chrome://inspect/#remote-debugging bölümünden bağlantıyı açıp Chrome’un izin penceresini onayla.':'Umay’a ait görünür ve kalıcı Chrome profili kullanılır. Site oturumların bu Chrome profilinde saklanır.';}
 async function load(){if(!api.browser)return;const current=epoch,state=await api.browser('state');if(current!==epoch)return;$('browser-mode').value=state.mode;const select=$('browser-profiles');select.replaceChildren();for(const profile of state.sessions?.sessions||[])select.append(new Option(profile.name,profile.id));select.value=state.sessions?.selected||'default';help();note(state.connected?'Chrome MCP bağlı.':'Chrome MCP hazır · bağlantı ilk web görevinde açılır.');}
 $('browser-mode').onchange=help;
 for(const [id,method]of [['browser-save','settings'],['browser-connect','connect']])$(id).onclick=async()=>{
  const current=epoch;$(id).disabled=true;try{note(method==='connect'?'Chrome’a bağlanılıyor…':'Kaydediliyor…');const state=await api.browser(method,{mode:$('browser-mode').value});if(current!==epoch)return;$('browser-mode').value=state.mode;help();note(method==='settings'?'Chrome bağlantı tercihin kaydedildi.':'Chrome MCP bağlantısı hazır.');}catch(error){if(current===epoch)note(String(error.message).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''));}finally{$(id).disabled=false;}
 };
 $('browser-profile-select').onclick=async()=>{try{await api.browser('profile-select',{id:$('browser-profiles').value});await load();}catch(e){note(e.message);}};
 $('browser-profile-add').onclick=async()=>{try{await api.browser('profiles-save',{name:$('browser-profile-name').value,mode:$('browser-mode').value,endpoint:$('browser-profile-endpoint').value||undefined});$('browser-profile-name').value='';$('browser-profile-endpoint').value='';await load();}catch(e){note(e.message);}};
 window.umayBrowser={load,reset(){epoch++;note('');$('browser-mode').value='managed';help();}};help();
})();
