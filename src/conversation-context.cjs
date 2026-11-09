'use strict';
function normalized(text){return String(text||'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/ı/g,'i').toLowerCase().replace(/[,.!?…]+/g,' ').replace(/\s+/g,' ').trim();}
// Context shaping only: this never grants a tool call or changes user text.
function isSocialTurn(text){
 if(typeof text!=='string'||text.length>200||/["“”:\n]/u.test(text.trim()))return false;
 const value=normalized(text).replace(/^umay\s+/,'').replace(/\s+umay$/,'');
 return /^(?:(?:selam|selamlar|merhaba|gunaydin|iyi aksamlar|iyi geceler)(?: nasilsin)?|nasilsin|tesekkur(?:ler| ederim)|sag ol)$/.test(value);
}
function screenContextRequested(text){const value=normalized(text);return /hangi ekrandayim|(?:ekranimda|ekranda|acik pencerede|aktif pencerede|su an nerede) (?:ne|hangi)|(?:hangi|ne) (?:ekran|pencere|belge|sayfa) acik|neye bakiyorum|su an ne yapiyorum/.test(value);}
module.exports={isSocialTurn,screenContextRequested};
