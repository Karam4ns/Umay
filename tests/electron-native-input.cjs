// Only interacts with a dedicated disposable test window owned by this process.
const {app,BrowserWindow,screen,desktopCapturer}=require('electron'),assert=require('node:assert/strict');
const {ComputerControl}=require('../src/computer-control.cjs');let control;
app.commandLine.appendSwitch('force-renderer-accessibility');const timeout=setTimeout(()=>{control?.close();app.exit(1);},45000);
app.whenReady().then(async()=>{
 const window=new BrowserWindow({width:650,height:420,title:'Umay isolated input test',webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
 try{
  await window.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<!doctype html><html><head><title>Umay isolated input test</title></head><body><label for="edit">Umay test editor</label><textarea id="edit" aria-label="Umay test editor" style="width:500px;height:150px"></textarea><button id="check" onclick="document.getElementById(\'result\').textContent=\'clicked\'">Umay test button</button><p id="result"></p></body></html>'));
  window.show();window.focus();await window.webContents.executeJavaScript("document.getElementById('edit').focus()");
  const valueEquals=expected=>window.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const end=Date.now()+3000;const check=()=>{if(document.getElementById('edit').value===${JSON.stringify(expected)})return resolve();if(Date.now()>end)return reject(Error('Input not delivered: '+document.getElementById('edit').value));setTimeout(check,10)};check()})`);
  control=new ComputerControl({screen,capture:async displays=>{const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:1000,height:700}});return sources.map(s=>({displayId:s.display_id,width:s.thumbnail.getSize().width,height:s.thumbnail.getSize().height,image:s.thumbnail.toDataURL()}));}});control.enable(true);
  let view=await control.observe();assert.match(view.title,/Umay isolated input test/);assert.ok(view.screenshots.length);const editor=view.elements.find(e=>e.name==='Umay test editor'&&e.type==='ControlType.Edit');assert.ok(editor,'editor visible through Windows UI Automation');
  await control.perform({action:'click',elementId:editor.id},view.id);
  view=await control.observe();await control.perform({action:'type',text:'Merhaba Umay, Türkçe ığüşöç 4.'},view.id);await valueEquals('Merhaba Umay, Türkçe ığüşöç 4.');assert.equal(await window.webContents.executeJavaScript("document.getElementById('edit').value"),'Merhaba Umay, Türkçe ığüşöç 4.');
  view=await control.observe();assert.ok(view.elements.some(e=>e.value?.includes('Türkçe')));await control.perform({action:'keys',keys:['CTRL','A']},view.id);
  view=await control.observe();await control.perform({action:'type',text:'Yeni metin'},view.id);await valueEquals('Yeni metin');assert.equal(await window.webContents.executeJavaScript("document.getElementById('edit').value"),'Yeni metin');
  view=await control.observe();const button=view.elements.find(e=>e.name==='Umay test button');assert.ok(button);await control.perform({action:'click',elementId:button.id},view.id);await window.webContents.executeJavaScript("new Promise((r,j)=>{const end=Date.now()+3000;const check=()=>{if(document.getElementById('result').textContent==='clicked')return r();if(Date.now()>end)return j(Error('Click missing'));setTimeout(check,10)};check()})");assert.equal(await window.webContents.executeJavaScript("document.getElementById('result').textContent"),'clicked');
  console.log('PASS real Windows UI Automation, full monitor capture, SendInput mouse/Unicode/CTRL+A; disposable test window only');control.close();window.destroy();clearTimeout(timeout);app.quit();
 }catch(error){console.error(error);console.error(control?.native.lastError||'');control?.close();clearTimeout(timeout);app.exit(1);}
});
