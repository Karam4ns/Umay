// Real OS inputs are restricted to these two disposable windows. The planner
// provider is deterministic; this does not certify arbitrary external models.
const {app,BrowserWindow,screen,desktopCapturer,globalShortcut}=require('electron');
const assert=require('node:assert/strict'),{ComputerControl}=require('../src/computer-control.cjs'),{ComputerAgent}=require('../src/computer-agent.cjs');
app.commandLine.appendSwitch('force-renderer-accessibility');let control,windows=[];
const timeout=setTimeout(()=>{console.error('FAIL native workflow timeout');control?.close();app.exit(1);},60000);
const html=title=>`<!doctype html><html><head><title>${title}</title><style>body{font:16px Segoe UI;margin:18px}textarea{width:420px;height:80px}#wheel{width:420px;height:80px;overflow:auto;margin-top:10px}#inside{width:1000px;height:600px;background:linear-gradient(45deg,#ccc,#aaa)}#drag{margin-top:12px;width:110px;height:45px;background:#5cd;touch-action:none}button{margin:8px}</style></head><body><label for="edit">Umay workflow editor</label><textarea id="edit" aria-label="Umay workflow editor"></textarea><br><button id="target" aria-label="Umay workflow target">Target</button><div id="wheel" aria-label="Umay scroll target" tabindex="0"><div id="inside">Scroll area</div></div><div id="drag" aria-label="Umay drag source">Drag here</div><script>window.events={};target.oncontextmenu=e=>{e.preventDefault();events.right=true};target.onauxclick=e=>{e.preventDefault();if(e.button===1)events.middle=true};target.ondblclick=()=>events.double=true;target.onmouseenter=()=>events.hover=true;drag.onpointerdown=e=>{drag.setPointerCapture(e.pointerId);events.down=[e.clientX,e.clientY]};drag.onpointerup=e=>{events.drag=!!events.down&&Math.abs(events.down[0]-e.clientX)>40};</script></body></html>`;
app.whenReady().then(async()=>{
 try{
  for(const title of ['Umay workflow A','Umay workflow B']){const w=new BrowserWindow({width:660,height:520,x:100,y:100,title,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});windows.push(w);await w.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html(title)));}
  const [a,b]=windows,js=code=>a.webContents.executeJavaScript(code);
  const until=async(code)=>{const end=Date.now()+4000;while(!await js(code)){if(Date.now()>end)throw Error('Expected UI state: '+code);await new Promise(r=>setTimeout(r,20));}};
  a.show();a.focus();await js('edit.focus()');
  control=new ComputerControl({screen,capture:async()=>{const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:1200,height:800}});return sources.map(s=>({displayId:s.display_id,width:s.thumbnail.getSize().width,height:s.thumbnail.getSize().height,image:s.thumbnail.toDataURL()}));}});control.enable(true);
  const act=async action=>{const view=await control.observe();assert.match(view.title,/Umay workflow A/);await control.perform(action(view),view.id);};
  const element=(view,name)=>{const found=view.elements.find(e=>e.name===name);assert.ok(found,'UIA target: '+name);return found.id;};
  await act(v=>({action:'move',elementId:element(v,'Umay workflow target')}));await until('events.hover===true');
  await act(v=>({action:'right_click',elementId:element(v,'Umay workflow target')}));await until('events.right===true');
  await act(v=>({action:'middle_click',elementId:element(v,'Umay workflow target')}));await until('events.middle===true');
  await act(v=>({action:'double_click',elementId:element(v,'Umay workflow target')}));await until('events.double===true');
  await act(v=>({action:'scroll',elementId:element(v,'Umay scroll target'),amount:-3}));await until('wheel.scrollTop>0');
  await act(v=>({action:'scroll',elementId:element(v,'Umay scroll target'),axis:'horizontal',amount:3}));await until('wheel.scrollLeft>0');
  const rect=await js('(()=>{const r=drag.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
  const content=a.getContentBounds(),physical=screen.dipToScreenPoint({x:Math.round(content.x+rect.x+100),y:Math.round(content.y+rect.y)});
  await act(v=>{const display=screen.getDisplayNearestPoint(screen.screenToDipPoint(physical)),shot=v.screenshots.find(s=>s.displayId===String(display.id)),dip=screen.screenToDipPoint(physical);return {action:'drag',elementId:element(v,'Umay drag source'),displayId:String(display.id),endX:(dip.x-display.bounds.x)/display.bounds.width*shot.width,endY:(dip.y-display.bounds.y)/display.bounds.height*shot.height};});await until('events.drag===true');
  let view=await control.observe(),target=view.windows.find(w=>w.title==='Umay workflow B');assert.ok(target);await control.perform({action:'focus_window',windowHandle:target.handle},view.id);view=await control.observe();assert.equal(view.title,'Umay workflow B');
  await control.perform({action:'focus_window',windowHandle:view.windows.find(w=>w.title==='Umay workflow A').handle},view.id);
  const excluded=Number(b.getNativeWindowHandle().readBigUInt64LE());control.excludedWindowHandles=()=>[excluded];view=await control.observe();assert.ok(!view.windows.some(w=>w.handle===excluded));await assert.rejects(control.perform({action:'focus_window',windowHandle:excluded},view.id),/pencere/);control.excludedWindowHandles=()=>[];
  // End-to-end native observe -> planner protocol -> input -> new observation.
  let planned=0,posted;const api=async(route,body)=>{
   if(route==='/site/chat/conversations')return {conversation:{id:'fixture',version:0}};
   if(route.endsWith('/messages')){posted=JSON.parse(body.content);return {run:{id:'run'}};}
   if(route.includes('/runs/'))return {run:{status:'COMPLETED'}};
   const edit=posted.observation.elements.find(e=>e.name==='Umay workflow editor'&&e.type==='ControlType.Edit');
   const actions=[{action:'click',elementId:edit.id},{action:'type',text:'Merhaba, Türkçe ığüşöç.'},{action:'keys',keys:['CTRL','A']},{action:'type',text:'Sonuç doğrulandı.'}];
   if(planned===4){assert.equal(edit.value,'Sonuç doğrulandı.');actions.push({action:'done',message:'Metin ekranda doğrulandı.'});}
   return {conversation:{id:'fixture',version:planned+1},messages:[{role:'assistant',content:JSON.stringify(actions[planned++])}]};
  };
  const agent=new ComputerAgent({control,api,memory:{epoch:1,context:()=>({}),archiveConversation(){},log(){}}});
  assert.equal((await agent.run('Test penceresine metin yaz ve doğrula',{id:'fixture',source:'PERSONAL',categories:['vision']})).status,'completed');await until("edit.value==='Sonuç doğrulandı.'");
  // F8 travels through actual Windows SendInput and Electron globalShortcut.
  assert.equal(globalShortcut.register('F8',()=>void agent.stop()),true);let postedRun,release;
  agent.api=async(route)=>{if(route==='/site/chat/conversations')return {conversation:{id:'cancel',version:0}};if(route.endsWith('/messages')){postedRun=true;return new Promise(r=>release=r);}return {};};
  const running=agent.run('Durdurma testi',{id:'fixture',source:'PERSONAL',categories:['vision']});while(!postedRun)await new Promise(r=>setTimeout(r,10));
  view=await control.observe();await control.perform({action:'keys',keys:['F8']},view.id).catch(error=>{if(error.code!=='NATIVE_CANCELLED')throw error;});
  const deadline=Date.now()+3000;while(agent.state().status!=='stopped'){if(Date.now()>deadline)throw Error('F8 did not stop task');await new Promise(r=>setTimeout(r,20));}release({run:{id:'cancelled'}});await running;
  console.log('PASS real Windows hover/right/middle/double click, vertical/horizontal scroll, drag, two-window focus, planner/input/verification workflow, physical F8 stop');
  globalShortcut.unregisterAll();control.close();windows.forEach(w=>w.destroy());clearTimeout(timeout);app.quit();
 }catch(error){console.error(error);console.error(control?.native.lastError||'');globalShortcut.unregisterAll();control?.close();clearTimeout(timeout);app.exit(1);}
});
