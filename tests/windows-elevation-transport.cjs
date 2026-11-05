// Runs the real Windows pipe/bootstrap/native protocol WITHOUT elevation or
// input. The probe must report the real inherited Windows token.
const {spawn}=require('node:child_process'),assert=require('node:assert/strict');
const {DesktopAccess,createElevationTransport}=require('../src/desktop-access.cjs');
(async()=>{
 let stderr='',length=0;
 const access=new DesktopAccess({transportFactory:()=>createElevationTransport({timeout:8000,launch:({encodedCommand,token})=>{
  const script=Buffer.from(encodedCommand,'base64').toString('utf16le').replace(/^if\(-not \$principal\.IsInRole\([^\n]+\)\)\{exit 1\}\r?$/m,'').replace('-RequireAdministrator $true','-RequireAdministrator $false');
  const command=Buffer.from(script,'utf16le').toString('base64');length=command.length;assert.ok(length<30000);
  const child=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-STA','-EncodedCommand',command],{windowsHide:true,stdio:['ignore','pipe','pipe']});child.stderr.on('data',chunk=>stderr+=(String(chunk).replaceAll(token,'[session]')));return child;
 }})});
 try{const actual=(await access.normal.request('privileges')).administrator;if(actual){await access.elevate();assert.equal(access.state().administrator,true);}else{await assert.rejects(access.elevate(),error=>error.code==='UAC_NOT_ELEVATED');assert.equal(access.state().administrator,false);}console.log('PASS real Windows named pipe + bootstrap + compressed native payload; actual inherited administrator token='+actual+'; encoded command '+length+' chars');}
 finally{access.close();if(stderr)console.error('[bootstrap] '+stderr.slice(-2500).replaceAll('#< CLIXML','').replaceAll('\n',' '));}
})().catch(error=>{console.error(error);process.exitCode=1;});
