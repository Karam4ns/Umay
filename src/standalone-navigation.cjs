'use strict';
function navigationUrl(value){const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||/[\s\u0000-\u001f]/.test(value))throw Error('Invalid navigation URL');return url.href;}
const SITES={netflix:'https://www.netflix.com/',youtube:'https://www.youtube.com/',github:'https://github.com/',google:'https://www.google.com/'};
// A narrow optimization of the real user's standalone landing-page request.
// All other requests retain the general model/executor path.
function standaloneNavigation(request){
 if(typeof request!=='string'||request.length>500)return null;
 const matches=[...request.matchAll(/https?:\/\/[^\s<>"']+|(?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"']*)?|\b(?:netflix|youtube|github|google)\b/gi)];if(matches.length!==1)return null;
 const match=matches[0],before=request.slice(0,match.index).trim(),after=request.slice(match.index+match[0].length).trim();
 if(!/^(?:(?:umay|lütfen|bana|benim için|şimdi|sadece|yalnızca|umay için açılan|açılan|google chrome|chrome(?:['’]?(?:da|dan))?|tarayıcı(?:da|dan)?|ile|kullanarak|üzerinden|profilinde|içinde)[,\s]*)*$/iu.test(before))return null;
 if(!/^(?:(?:adresini|adresine|sitesini|sitesine|sayfasını|sayfasına)\s+)?(?:aç(?:ar mısın|abilir misin)?|git(?:er misin)?|gir(?:er misin)?|open|visit)[.!?\s]*(?:(?:diğer|başka) pencerelere dokunma[.!?\s]*)?$/iu.test(after))return null;
 try{const raw=match[0].replace(/[.,!?]+$/,''),url=new URL(navigationUrl(SITES[raw.toLowerCase()]||(/^https?:/i.test(raw)?raw:'https://'+raw)));if(url.pathname!=='/'||url.search||url.hash)return null;return url.href;}catch{return null;}
}
module.exports={standaloneNavigation};
