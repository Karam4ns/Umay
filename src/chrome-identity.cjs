'use strict';
// Read-only connection identity, never page interaction. All page operations
// remain in Chrome MCP. Bind the browser endpoint's OS PID to the native HWND.
async function browserProcessId(endpoint,{fetchImpl=fetch,WebSocketImpl=WebSocket,timeout=1500}={}){
 let base;try{base=new URL(endpoint);if(base.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(base.hostname)||!base.port||base.username||base.password||base.pathname!=='/'||base.search||base.hash)return null;}catch{return null;}
 try{
  const response=await fetchImpl(base.origin+'/json/version',{redirect:'error',signal:AbortSignal.timeout(timeout)});if(!response.ok)return null;
  const ws=new URL((await response.json()).webSocketDebuggerUrl);if(ws.protocol!=='ws:'||ws.hostname!==base.hostname||ws.port!==base.port||ws.username||ws.password||!/^\/devtools\/browser\/[a-z0-9-]+$/i.test(ws.pathname)||ws.search||ws.hash)return null;
  return await new Promise(resolve=>{
   let socket,finished=false;const finish=value=>{if(finished)return;finished=true;clearTimeout(timer);try{socket?.close();}catch{}resolve(value);};
   const timer=setTimeout(()=>finish(null),timeout);
   try{socket=new WebSocketImpl(ws.href);socket.addEventListener('error',()=>finish(null));socket.addEventListener('close',()=>finish(null));socket.addEventListener('open',()=>{try{socket.send(JSON.stringify({id:1,method:'SystemInfo.getProcessInfo'}));}catch{finish(null);}});socket.addEventListener('message',event=>{try{const message=JSON.parse(String(event.data));if(message.id!==1)return;const browsers=(message.result?.processInfo||[]).filter(p=>p.type==='browser');finish(browsers.length===1&&Number.isSafeInteger(browsers[0].id)&&browsers[0].id>0?browsers[0].id:null);}catch{finish(null);}});}catch{finish(null);}
  });
 }catch{return null;}
}
module.exports={browserProcessId};
