// Actual native helper; all requested input/focus is confined to owned windows.
const {app,BrowserWindow}=require('electron'),assert=require('node:assert/strict'),{NativeDesktop}=require('../src/computer-control.cjs');let native,window;
const deadline=setTimeout(()=>{native?.close();app.exit(1);},30000);
app.whenReady().then(async()=>{try{
 window=new BrowserWindow({width:600,height:380,title:'Umay PID focus test'});await window.loadURL('data:text/html,<title>Umay PID focus test</title><input id="field"><script>window.typed=0;document.onkeydown=()=>typed++</script>');window.show();window.focus();
 const handle=Number(window.getNativeWindowHandle().readBigUInt64LE());native=new NativeDesktop();
 await assert.rejects(native.request('focus',{handle,expectedProcessId:process.pid+1}),{code:'NATIVE_WINDOW_UNAVAILABLE'});
 await native.request('focus',{handle,expectedProcessId:process.pid});
 await assert.rejects(native.request('keys',{keys:[65],expectedHandle:handle,expectedProcessId:process.pid+1}),{code:'NATIVE_FOCUS_CHANGED'});
 assert.equal(await window.webContents.executeJavaScript('typed'),0);
 assert.equal((await native.request('foreground')).handle,handle);
 console.log('PASS actual Windows PID/handle identity: stale focus and key injection rejected before input; valid owned focus confirmed');native.close();window.destroy();clearTimeout(deadline);app.exit(0);
 }catch(e){console.error(e);native?.close();window?.destroy();clearTimeout(deadline);app.exit(1);}});
