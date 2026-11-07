(function(root){
 function computerCommand(text){
  const value=String(text||'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/ı/g,'i').toLowerCase().replace(/[.,!?]+$/g,'').trim().replace(/\s+/g,' ').replace(/^(?:umay[, ]+)?(?:lutfen )?/,'');
  if(/^(?:dur|durdur|bekle|islemi durdur|gorevi durdur|tamam dur|dur dedim)$/.test(value))return 'pause';
  if(/^(?:devam|devam et|kaldigin yerden devam et)$/.test(value))return 'resume';
  if(/^(?:iptal|iptal et|gorevi iptal et|vazgec)$/.test(value))return 'stop';return null;
 }
 function chooseWatch(text,watchers){const value=String(text||'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/ı/g,'i').toLowerCase().trim(),compact=value.replace(/[\s.]/g,'').replace(/si$/,'');const names=['birinci','ikinci','ucuncu','dorduncu','besinci','altinci','yedinci','sekizinci','dokuzuncu','onuncu','onbirinci','onikinci'],numbers=['bir','iki','uc','dort','bes','alti','yedi','sekiz','dokuz','on','onbir','oniki'];let index=/^\d{1,2}$/.test(compact)?Number(compact)-1:names.indexOf(compact);if(index<0)index=numbers.indexOf(compact);if(index>=0)return watchers[index]||null;if(value.length<3||['tamam','olur','evet','devam et'].includes(value))return null;const matches=watchers.filter(w=>String(w.goal).normalize('NFKD').replace(/\p{M}/gu,'').replace(/ı/g,'i').toLowerCase().includes(value));return matches.length===1?matches[0]:null;}
 if(typeof module!=='undefined')module.exports={computerCommand,chooseWatch};else root.ComputerCommands={computerCommand,chooseWatch};
})(globalThis);
