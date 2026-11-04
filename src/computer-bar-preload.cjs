const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('computerBar',{stop:()=>ipcRenderer.invoke('computer-emergency-stop'),onStatus:callback=>ipcRenderer.on('task-status',(_event,data)=>callback(data))});
