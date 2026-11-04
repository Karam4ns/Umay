// Export the code-native SVG mark for Windows; generated raster files are not source assets.
const {app,BrowserWindow}=require('electron');const fs=require('node:fs');const path=require('node:path');
app.whenReady().then(async()=>{
 try{
  const assets=path.join(__dirname,'../src/ui/assets');const svg=fs.readFileSync(path.join(assets,'umay-mark.svg'),'utf8');
  const window=new BrowserWindow({width:256,height:256,useContentSize:true,show:false,transparent:true,frame:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  const html=`<html><style>*{box-sizing:border-box}html,body{margin:0;width:256px;height:256px;background:transparent}body{padding:7px}.mark{height:242px;width:242px;display:grid;place-items:center;border-radius:52px;border:2px solid #196279;background:radial-gradient(ellipse at 50% 20%,#0a3c50,#03111a 75%)}svg{width:200px;height:150px;filter:drop-shadow(0 0 12px #00cde8aa)}</style><body><div class="mark">${svg}</div></body></html>`;
  await window.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));await window.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  const png=(await window.capturePage()).resize({width:256,height:256}).toPNG();fs.writeFileSync(path.join(assets,'umay.png'),png);
  const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);
  fs.writeFileSync(path.join(assets,'umay.ico'),Buffer.concat([header,png]));console.log('PASS exported Windows icon from Umay SVG');app.exit(0);
 }catch(error){console.error(error);app.exit(1);}
});
