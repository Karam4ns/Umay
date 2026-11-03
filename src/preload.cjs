const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('umay',{
 speech:(method,params)=>ipcRenderer.invoke('speech',method,params),
 api:(route,body)=>ipcRenderer.invoke('api',route,body),login:()=>ipcRenderer.invoke('login'),
 logout:()=>ipcRenderer.invoke('logout'),clone:()=>ipcRenderer.invoke('clone'),
 update:()=>ipcRenderer.invoke('update'),busy:value=>ipcRenderer.invoke('busy',value),
 restartUpdate:()=>ipcRenderer.invoke('restart-update'),
 onEvent:callback=>ipcRenderer.on('event',(_event,data)=>callback(data))
});
