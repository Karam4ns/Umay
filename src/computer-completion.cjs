'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
// A read-only postcondition for an explicit, named Desktop folder request.
// Unknown tasks keep their normal screenshot/UIA verification; this never
// creates, renames or deletes a file and never interprets a model's proposed goal.
async function verifyComputerCompletion(request,{desktop}={}){
 if(!desktop||typeof request!=='string')return null;
 const match=request.match(/masaüst(?:ü)?(?:ne|nde|e)?\s+(.{1,160}?)\s+(?:adında|isimli|isminde)\s+(?:(?:yeni|bir)\s+)*klasör\s+oluştur(?:[.!?\s]|$)/iu);
 if(!match)return null;
 const prefix=request.slice(0,match.index),suffix=request.slice(match.index+match[0].length).replace(/^[.!?\s]+|[.!?\s]+$/g,'');
 // A create-then-rename/move/delete request has a different final state. Only
 // accept a standalone creation, with an optional explicit no-other-files limit.
 if(!/^\s*(?:(?:selam|merhaba|umay|lütfen)[,!\s]+)*$/iu.test(prefix))return null;
 if(suffix&&!/^(?:Yalnızca bu yeni klasörü oluştur[;,]\s*)?başka dosyaları değiştirme$/iu.test(suffix))return null;
 const name=match[1].trim().replace(/^["'“‘]|["'”’]$/g,'');
 if(!name||name==='.'||name==='..'||/[\\/:*?"<>|\u0000-\u001f]/.test(name)||/[. ]$/.test(name))return null;
 const target=path.join(desktop,name);let exists=false;
 try{exists=(await fs.stat(target)).isDirectory();}catch(error){if(!['ENOENT','ENOTDIR'].includes(error.code))return {verified:false,message:'Klasör sonucu dosya sisteminden doğrulanamadı; başarı bildirme.'};}
 return {verified:exists,message:exists?'Masaüstünde "'+name+'" klasörü hazır.':'Görev henüz tamamlanmadı: masaüstünde istenen "'+name+'" klasörü dosya sisteminde yok. Yeni klasörün adlandırılması bekliyorsa doğru adı Enter ile onayla; mevcut dosyaları değiştirmeden tekrar kontrol et.'};
}
module.exports={verifyComputerCompletion};
