'use strict';
// Only a verified, user-elevated native helper starts this private Node worker.
const net=require('node:net'),readline=require('node:readline'),{spawn}=require('node:child_process'),path=require('node:path');
const {SystemWorkerHost}=require('./system-worker-host.cjs');
const args=process.argv.slice(2),pipe=args[args.indexOf('--system-pipe')+1],token=args[args.indexOf('--system-token')+1];
if(!pipe||!token||process.env.UMAY_SYSTEM_WORKER_ADMIN!=='1')process.exit(1);
const socket=net.connect(pipe),line=readline.createInterface({input:socket});let accepted=false,closing=false;
const openPath=target=>new Promise((resolve,reject)=>{const child=spawn(path.join(process.env.SystemRoot||'C:\\Windows','explorer.exe'),[target],{windowsHide:true,detached:true,stdio:'ignore',env:{...process.env,ELECTRON_RUN_AS_NODE:undefined}});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve('');});});
const trash=target=>new Promise((resolve,reject)=>{const executable=path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),code="$ErrorActionPreference='Stop';[Console]::InputEncoding=New-Object Text.UTF8Encoding($false);Add-Type -AssemblyName Microsoft.VisualBasic;$p=ConvertFrom-Json ([Console]::ReadLine());if([IO.Directory]::Exists($p.path)){[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($p.path,'OnlyErrorDialogs','SendToRecycleBin','ThrowException')}else{[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($p.path,'OnlyErrorDialogs','SendToRecycleBin','ThrowException')}";
 const child=spawn(executable,['-NoLogo','-NoProfile','-NonInteractive','-Command',code],{windowsHide:true,stdio:['pipe','ignore','pipe']});let error='';child.stderr.on('data',data=>error=(error+data).slice(-2000));child.once('error',reject);child.once('exit',code=>code?reject(Error(error||'Dosya geri dönüşüme gönderilemedi.')):resolve());child.stdin.end(JSON.stringify({path:target})+'\n');});
const host=new SystemWorkerHost({filesFactory:roots=>new (require('./system-files.cjs').FileTools)({roots,discoverDrives:true,trash,openPath})});
const send=value=>{if(!socket.destroyed)socket.write(JSON.stringify(value)+'\n');};
async function close(){if(closing)return;closing=true;socket.destroy();line.close();const drain=async()=>{try{await host.close();process.exit(0);}catch{setTimeout(()=>void drain(),1000);}};await drain();}
socket.on('connect',()=>send({event:'system-ready',token,pid:process.pid,administrator:true}));socket.on('error',()=>void close());socket.on('close',()=>void close());
line.on('line',async source=>{let message;try{if(closing)return;if(source.length>2*1024*1024)throw Error('İstek çok büyük.');message=JSON.parse(source);if(!accepted){if(message.event!=='accept'||message.token!==token)throw Error('Bağlantı doğrulanamadı.');accepted=true;return;}
 const result=await host.handle(message);if(message.id)send({id:message.id,result});
 }catch(error){send({id:message?.id,error:{code:error.code||'SYSTEM_TOOL_FAILED',message:error.message,receipt:error.receipt||null}});}});
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
