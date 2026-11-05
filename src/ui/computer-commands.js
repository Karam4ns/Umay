(function(root){
 function computerCommand(text){
  const value=String(text||'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/ı/g,'i').toLowerCase().replace(/[.,!?]+$/g,'').trim().replace(/\s+/g,' ').replace(/^(?:umay[, ]+)?(?:lutfen )?/,'');
  if(/^(?:dur|durdur|bekle|islemi durdur|gorevi durdur|tamam dur|dur dedim)$/.test(value))return 'pause';
  if(/^(?:devam|devam et|kaldigin yerden devam et)$/.test(value))return 'resume';
  if(/^(?:iptal|iptal et|gorevi iptal et|vazgec)$/.test(value))return 'stop';return null;
 }
 if(typeof module!=='undefined')module.exports={computerCommand};else root.ComputerCommands={computerCommand};
})(globalThis);
