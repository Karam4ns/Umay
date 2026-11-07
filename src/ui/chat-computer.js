(()=>{
 const $=id=>document.getElementById(id),api=window.umay,cards=new Map();let task=null,epoch=0,working=false;
 const active=new Set(['running','paused','question','confirmation','permission']);
 const sameChat=value=>!value?.origin?.conversationId||value.origin.conversationId===conversation?.id;
 function pending(){return task&&sameChat(task)&&['question','confirmation','permission'].includes(task.status)?task:null;}
 function element(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
 function paint(value){
  task=value;if(!value?.id||!sameChat(value))return;
  let card=cards.get(value.id);if(!card||!card.isConnected){card=element('section',undefined,'message computer-task');card.dataset.taskId=value.id;card.setAttribute('aria-label','Bilgisayar görevi');cards.set(value.id,card);$('messages').append(card);}
  const labels={running:'Bilgisayarında çalışıyorum',paused:'Durakladım — devam etmeni bekliyorum',question:'Bir ayrıntıya ihtiyacım var',confirmation:'Bu işlem için onayın gerekiyor',permission:'Windows izni gerekiyor',completed:'Görev tamamlandı',stopped:'Görev durduruldu',failed:'Görev tamamlanamadı'};
  card.replaceChildren(element('strong',value.stopUnconfirmed?'Durdurma doğrulanamadı':labels[value.status]||'Bilgisayar görevi'),element('p',value.goal||'','computer-task-goal'),element('p',value.message||'','computer-task-progress'));
  if(value.status==='confirmation'&&value.requiresInput?.summary&&value.requiresInput.summary!==value.message)card.append(element('p',value.requiresInput.summary,'computer-task-progress'));
  const buttons=element('div',undefined,'button-row');
  function button(text,handler,primary=false){const node=element('button',text,'button small'+(primary?' primary':''));node.type='button';node.onclick=async()=>{const current=epoch;node.disabled=true;try{await handler();}catch(error){if(current===epoch)status(error.message);}finally{node.disabled=false;}};buttons.append(node);}
  if(value.status==='confirmation'){button('Onaylıyorum',()=>send('Onaylıyorum'),true);button('Vazgeç',()=>send('Vazgeç'));}
  if(value.status==='paused'&&!value.stopUnconfirmed)button('Devam et',()=>send('devam et'),true);
  if(value.status==='permission'){card.append(element('p','Windows yönetici onayını kendin tamamla. Erişim bu Umay oturumunda korunur; Ayarlar → Modeller üzerinden kapatabilirsin.','muted'));button('Windows yönetici erişimini aç',()=>send('Windows yönetici onayını aç'),true);button('Vazgeç',()=>send('Vazgeç'));}
  if(active.has(value.status))button('Durdur · F8',()=>stop());
  card.append(buttons);$('input').placeholder=value.status==='question'?'Umay’ın sorusunu yanıtla…':'Umay’a bir şey sor ya da bir iş ver…';
  if(['question','confirmation','permission','failed'].includes(value.status))window.umayShell?.navigate('chat');
 }
 async function dispatch(run){const current=epoch;working=true;try{const result=await api.computer('dispatch',{runId:run.id,conversationId:conversation.id});if(current!==epoch)return null;paint(result);return result;}finally{if(current===epoch)working=false;}}
 function canControl(command){return !!task&&sameChat(task)&&(command==='resume'?task.status==='paused':active.has(task.status));}
 async function control(command,text){if(!canControl(command))return null;const current=epoch,result=await api.computer(command==='resume'?'continue':command,{id:task.id,userReply:text});if(current!==epoch)return null;paint(result);return result;}
 async function answer(text){
  const waiting=pending();if(!waiting)throw Error('Yanıt bekleyen bilgisayar görevi bulunamadı.');const current=epoch;
  const folded=text.normalize('NFKD').replace(/\p{M}/gu,'').replace(/ı/g,'i').toLowerCase().replace(/[.,!?:]/g,' ').replace(/\s+/g,' ').trim();
  const yes=/^(?:evet|evet onayliyorum|tamam|onayliyorum|onay veriyorum|bu islemi onayliyorum|devam et|yap|olur|windows yonetici onayini ac|yonetici onayini ac|windows yonetici erisimini ac|yonetici erisimini ac)$/.test(folded),no=/^(?:hayir|iptal|iptal et|vazgec|dur|durdur|yapma|onaylamiyorum)$/.test(folded);
  working=true;try{
   let result;if(no)result=await api.computer('stop',{id:waiting.id,userReply:text});
   else if(waiting.status==='question'&&waiting.requiresInput?.kind)result=await api.computer('secure-answer',{id:waiting.id,value:text});
   else if(waiting.status==='question')result=await api.computer('resume',{id:waiting.id,answer:text,userReply:text});
   else if(!yes)return {...waiting,message:'Bu işlem için “onaylıyorum” veya “vazgeç” diyebilirsin.'};
   else result=await api.computer(waiting.status==='permission'?'elevate':'resume',{id:waiting.id,approved:true,userReply:text});
   if(current!==epoch)return null;paint(result);return result;
  }finally{if(current===epoch)working=false;}
 }
 api.onEvent(data=>{if(data.event==='computer-task')paint(data.task);});
 window.umayComputerChat={paint,pending,dispatch,answer,canControl,control,running:()=>working||active.has(task?.status),reset(){epoch++;task=null;working=false;cards.clear();$('input').placeholder='Umay’a bir şey sor ya da bir iş ver…';}};
})();
