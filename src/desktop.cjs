const os=require('node:os');const fs=require('node:fs');
function cpuTimes(){return os.cpus().reduce((sum,cpu)=>({idle:sum.idle+cpu.times.idle,total:sum.total+Object.values(cpu.times).reduce((a,b)=>a+b,0)}),{idle:0,total:0});}
let previous=cpuTimes();
function systemStatus(directory,version){
 const current=cpuTimes(),elapsed=current.total-previous.total;
 const cpu=elapsed>0?Math.max(0,Math.min(100,100*(1-(current.idle-previous.idle)/elapsed))):null;previous=current;
 let disk=null;try{const data=fs.statfsSync(directory);if(data.blocks>0)disk=100*(1-data.bavail/data.blocks);}catch{}
 return {cpu,ram:100*(1-os.freemem()/os.totalmem()),disk,memoryGB:Math.round(os.totalmem()/1024**3),platform:process.platform==='win32'?'Windows':os.platform(),version};
}
function windowAction(window,action){
 if(!['minimize','maximize','close'].includes(action))throw Error('Pencere işlemi geçersiz.');
 if(action==='minimize')window.minimize();if(action==='maximize'){if(window.isMaximized())window.unmaximize();else window.maximize();}if(action==='close')window.close();
}
module.exports={systemStatus,windowAction};
