'use strict';
class TurnGate {
  constructor(){this.id=0;this.active=false;}
  begin(){this.active=true;return ++this.id;}
  cancel(){this.active=false;++this.id;}
  accepts(id){return this.active&&id===this.id;}
}
class MemoryStore {
  constructor(){this.epoch=0;this.items=new Map();}
  switchAccount(account){this.account=account;this.items.clear();return ++this.epoch;}
  put(epoch,item){if(epoch!==this.epoch)return false;this.items.set(item.id,item);return true;}
  values(){return [...this.items.values()];}
}
function chooseDevice(probes){return probes.find(p=>p.available&&p.healthy)||{backend:'cpu',available:true,healthy:true};}
function validateReference(name,size,head){
 if(!/\.mp3$/i.test(name)||size<=0||size>50000000)throw Error('Geçerli bir MP3 seçin (en fazla 50 MB).');
 if(head.subarray(0,3).toString()!=='ID3'&&!(head[0]===255&&(head[1]&224)===224))throw Error('Dosya MP3 biçiminde değil.');
}
function splitSpeech(text,flush=false){
 const chunks=[];let start=0;
 for(let i=0;i<text.length;i++){
  if(!'.!?\n'.includes(text[i]))continue;
  if(text[i]==='.'&&/\d/.test(text[i-1]||'')&&/\d/.test(text[i+1]||''))continue;
  if(i+1<text.length&&!/\s/.test(text[i+1]))continue;
  const part=text.slice(start,i+1).trim();if(part)chunks.push(part);start=i+1;
 }
 let rest=text.slice(start).trim();if(flush&&rest){chunks.push(rest);rest='';}
 return {chunks,rest};
}
module.exports={TurnGate,MemoryStore,chooseDevice,validateReference,splitSpeech};
