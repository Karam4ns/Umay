const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('umay',{
 speech:(method,params)=>ipcRenderer.invoke('speech',method,params),
 api:(route,body)=>ipcRenderer.invoke('api',route,body),login:entry=>ipcRenderer.invoke('login',entry),
 cancelLogin:()=>ipcRenderer.invoke('cancel-login'),system:()=>ipcRenderer.invoke('system-status'),window:action=>ipcRenderer.invoke('window-action',action),
 logout:()=>ipcRenderer.invoke('logout'),clone:()=>ipcRenderer.invoke('clone'),
 update:()=>ipcRenderer.invoke('update'),busy:value=>ipcRenderer.invoke('busy',value),
 restartUpdate:()=>ipcRenderer.invoke('restart-update'),
 onEvent:callback=>ipcRenderer.on('event',(_event,data)=>callback(data))
});
