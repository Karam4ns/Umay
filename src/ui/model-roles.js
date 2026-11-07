(()=>{
 const $=id=>document.getElementById(id),key=m=>m?m.source+':'+m.id:'',ref=value=>{const model=models.find(m=>key(m)===value);return model?{id:model.id,source:model.source}:null;};
 let roles={chat:null,computer:null},epoch=0,request=0;
 const vision=model=>(model?.categories||[]).some(c=>/^(vision|multimodal|image[-_ ]to[-_ ]text|görsel anlama)$/i.test(typeof c==='string'?c:c?.name||c?.slug||''));
 function tab(name){for(const page of ['speech','models','plugins']){const panel=$('settings-'+page),button=$('settings-'+page+'-tab');if(panel)panel.hidden=page!==name;if(button)button.setAttribute('aria-selected',String(page===name));}if(name==='models')void Promise.all([load(),window.umayBrowser?.load(),loadAccess()]).catch(showError);if(name==='plugins')void window.umayPlugins?.load().catch(showError);}
 async function loadAccess(){if(!api.computer||!$('admin-state'))return;const current=epoch,data=await api.computer('state');if(current!==epoch)return;const active=!!data?.access?.administrator;$('admin-state').textContent=active?'Yönetici erişimi açık · bu Umay oturumunda kullanılabilir.':'Yönetici erişimi kapalı.';$('admin-revoke').disabled=!active;}
 if($('admin-revoke'))$('admin-revoke').onclick=async()=>{try{await api.computer('release-admin');await loadAccess();}catch(error){showError(error);}};
 api.onEvent?.(event=>{if(event.event==='computer-access')void loadAccess().catch(()=>{});});
 function showError(error){$('model-roles-status').textContent=String(error.message||error).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');}
 function detail(role){const model=models.find(m=>key(m)===$('role-'+role).value);$('role-'+role+'-detail').textContent=!model?'Bir model seç.':role==='computer'?(vision(model)?'Ekran görüntüsü, fare ve klavye ile çalışır.':'Bu model görsel desteklemiyor. Chrome MCP ve Windows erişilebilirlik bilgileriyle çalışır.'):(model.source==='PERSONAL'?'Kişisel modelin.':'Aboneliğine bağlı model.');}
 function paint(){
  for(const role of ['chat','computer']){
   const select=$('role-'+role);select.replaceChildren(new Option('Model seç…',''));
   for(const model of models)select.append(new Option(model.name+' · '+(model.source==='PERSONAL'?'Kişisel':'Abonelik')+(role==='computer'?' · '+(vision(model)?'Görsel':'Metin'):''),key(model)));
   if(roles[role]&&!models.some(m=>key(m)===key(roles[role]))){const option=new Option('Atanan modele artık erişilemiyor',key(roles[role]));option.disabled=true;select.append(option);}
   select.value=key(roles[role]);detail(role);
  }
  if(roles.chat){const option=[...$('models').options].find(o=>o.value===roles.chat.id&&o.dataset.source===roles.chat.source);$('models').selectedIndex=option?option.index:-1;}

 }
 async function load(){if(!api.modelRoles)return;const current=epoch,id=++request,result=await api.modelRoles('state');if(current!==epoch||id!==request)return;roles=result.roles;paint();return result;}
 async function save(input){const current=epoch,result=await api.modelRoles('save',input);if(current!==epoch)return false;roles=result.roles;paint();return true;}
 $('settings-plugins-tab').onclick=()=>tab('plugins');$('settings-models-tab').onclick=()=>tab('models');$('settings-speech-tab').onclick=()=>tab('speech');
 for(const role of ['chat','computer'])$('role-'+role).onchange=()=>detail(role);
 $('model-roles-save').onclick=async()=>{const current=epoch;$('model-roles-save').disabled=true;try{
  if(!$('role-chat').value||!$('role-computer').value)throw Error('Sohbet ve bilgisayar kontrolü için birer model seç.');
  const input={chat:ref($('role-chat').value),computer:ref($('role-computer').value)};if(!input.chat||!input.computer)throw Error('Erişilemeyen model yerine yeni bir model seç.');
  const old=key(roles.chat);if(await save(input)){if(old!==key(roles.chat)){await stop();conversation=null;$('messages').replaceChildren();window.umayShell?.reset();}$('model-roles-status').textContent='Sohbet ve bilgisayar model rolleri kaydedildi.';}
 }catch(error){if(current===epoch)showError(error);}finally{$('model-roles-save').disabled=false;}};
 $('model-roles-refresh').onclick=async()=>{try{await refresh();await load();$('model-roles-status').textContent='Modeller güncellendi.';}catch(error){showError(error);}};
 window.umayModelRoles={load,paint,async selectChat(model){if(api.modelRoles&&model)await save({chat:{id:model.id,source:model.source}});},reset(){window.umayPlugins?.reset();epoch++;request++;roles={chat:null,computer:null};for(const id of ['role-chat','role-computer'])$(id).replaceChildren();$('model-roles-status').textContent='';tab('speech');}};
})();
