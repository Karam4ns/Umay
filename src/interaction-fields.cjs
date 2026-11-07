'use strict';
const semantic=line=>String(line||'').replace(/uid=\S+/g,'uid').trim();
function bindField(snapshot,uid,{submit=false}={}){const lines=String(snapshot||'').split('\n').filter(l=>l.includes('uid='+uid+' '));if(lines.length!==1||/\bdisabled\b/.test(lines[0])||!(submit?/(?:button|link)\b/:/(?:textbox|input)\b/).test(lines[0]))throw Error('OTP alanı veya onay düğmesi güncel değil.');return semantic(lines[0]);}
function resolveField(snapshot,binding){const lines=String(snapshot||'').split('\n').filter(l=>semantic(l)===binding);if(lines.length!==1)throw Error('OTP alanı değişti; güncel alanla yeniden kod istemek gerekiyor.');return lines[0].match(/uid=(\S+)/)?.[1];}
module.exports={bindField,resolveField};
