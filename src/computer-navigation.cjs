'use strict';
function navigationUrl(value){
 if(typeof value!=='string'||value.length>2048||/[\s\u0000-\u001f]/.test(value))throw Error('Geçerli bir HTTP/HTTPS adresi gerekli.');
 const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Geçerli bir HTTP/HTTPS adresi gerekli.');return url.href;
}
function addressField(view){
 // Only browser chrome, never an address-labelled form inside a web page.
 return view.elements?.find(e=>e.type==='ControlType.Edit'&&e.inDocument===false&&/^(?:adres ve arama çubuğu|address and search bar|address bar|search or enter address|search with .+ or enter address)$/iu.test(e.name||''));
}
function simpleNavigation(request){
 const text=String(request||'');
 return (text.match(/https?:\/\/[^\s]+/g)||[]).length===1&&/(?<![\p{L}\p{N}])(?:aç|git|open|visit|navigate)(?![\p{L}\p{N}])/iu.test(text)&&!/(?:açma|gitme|indir|yükle|sil\b|kaydet|oynat|tıkla|satın|giriş|hesap|register|login|install|download|delete|send|gönder|kopyala|nasıl|örnek|çevir|translate|write|yaz\b)/iu.test(text);
}
module.exports={navigationUrl,addressField,simpleNavigation};
