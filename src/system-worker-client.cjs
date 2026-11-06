'use strict';
const net=require('node:net'),path=require('node:path'),{randomUUID,randomBytes}=require('node:crypto');
class SystemWorkerClient{
 constructor({native,command=process.execPath,entry=path.join(__dirname,'system-worker.cjs'),roots=[],timeout=20000}={}){Object.assign(this,{native,command,entry,roots,timeout});this.generation=0;this.pending=new Map();this.ready=false;this.account=null;this.unsubscribe=native?.onRelease?.(()=>this.close());}
 activate(account){this.close();this.account=account;}
 async start(){if(this.ready)return;if(this.starting)return this.starting;const generation=this.generation;
  const startup=this.starting=(async()=>{
   if(!this.account)throw Error('Yönetici sistem araçları için giriş yapın.');const privileges=await this.native.request('privileges');if(!privileges?.administrator)throw Object.assign(Error('Windows yönetici izni gerekiyor.'),{code:'NATIVE_ELEVATION_REQUIRED'});
   if(generation!==this.generation)throw Error('Yönetici bağlantısı durduruldu.');
   const pipe='\\\\.\\pipe\\umay-system-'+randomUUID(),token=randomBytes(32).toString('hex');let expectedPid,helloSocket,hello,buffer='';
   await new Promise((resolve,reject)=>{
    let done=false;const finish=error=>{if(done)return;done=true;clearTimeout(timer);this.startReject=null;if(error){this.close();reject(error);}else{this.server?.close();this.server=null;this.ready=true;resolve();}};
    const accept=()=>{if(!helloSocket||!expectedPid)return;if(generation!==this.generation||hello?.token!==token||hello?.pid!==expectedPid||hello?.administrator!==true){helloSocket.destroy();helloSocket=null;return;}
     this.socket=helloSocket;helloSocket.write(JSON.stringify({event:'accept',token})+'\n');finish();};
    const timer=setTimeout(()=>finish(Error('Yönetici sistem bağlantısı kurulamadı.')),this.timeout);this.startReject=()=>finish(Error('Yönetici bağlantısı durduruldu.'));
    const server=this.server=net.createServer(socket=>{socket.on('error',()=>{});let first=true,data='';socket.on('data',chunk=>{data+=chunk.toString('utf8');if(data.length>2*1024*1024){socket.destroy();return;}let index;while((index=data.indexOf('\n'))>=0){const line=data.slice(0,index);data=data.slice(index+1);let message;try{message=JSON.parse(line);}catch{socket.destroy();return;}
      if(first){first=false;if(message.event!=='system-ready'||message.token!==token){socket.destroy();return;}helloSocket=socket;hello=message;accept();}
      else if(socket===this.socket)this.receive(message);
     }});socket.on('close',()=>{if(socket===this.socket)this.close();});});server.on('error',finish);server.listen(pipe,()=>{
     if(generation!==this.generation){finish(Error('Yönetici bağlantısı durduruldu.'));return;}
     this.native.request('system_worker',{command:this.command,entry:this.entry,pipe,token}).then(result=>{expectedPid=result?.pid;if(!Number.isInteger(expectedPid))throw Error('Yönetici çalıştırıcısı doğrulanamadı.');accept();}).catch(finish);
    });
   });
  })();try{return await startup;}finally{if(this.starting===startup)this.starting=null;}
 }
 receive(message){const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);pending.cleanup();message.error?pending.reject(Object.assign(Error(message.error.message),{code:message.error.code,receipt:message.error.receipt})):pending.resolve(message.result);}
 request(method,params,signal){if(!this.ready||!this.socket)return Promise.reject(Object.assign(Error('Yönetici sistem bağlantısı kapalı.'),{code:'NATIVE_ELEVATION_REQUIRED'}));const id=randomUUID();return new Promise((resolve,reject)=>{
   const abort=()=>{this.pending.delete(id);cleanup();this.socket?.write(JSON.stringify({method:'cancel',taskId:params.taskId})+'\n');reject(Object.assign(Error('Sistem görevi durduruldu.'),{code:'SYSTEM_CANCELLED'}));};
   const cleanup=()=>signal?.removeEventListener('abort',abort);this.pending.set(id,{resolve,reject,cleanup});if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});this.socket.write(JSON.stringify({id,method,...params,account:this.account,roots:this.roots})+'\n');
  });}
 perform(toolName,args,{signal,taskId}={}){return this.request('perform',{toolName,args,taskId},signal);}
 cancelTask(taskId){return this.ready&&taskId?this.request('cancel',{taskId}):Promise.resolve();}
 close(){this.generation++;this.ready=false;this.startReject?.();this.startReject=null;this.server?.close();this.server=null;const socket=this.socket;this.socket=null;socket?.destroy();for(const pending of this.pending.values()){pending.cleanup();pending.reject(Object.assign(Error('Yönetici sistem bağlantısı kapandı.'),{code:'SYSTEM_CANCELLED'}));}this.pending.clear();}
}
module.exports={SystemWorkerClient};
