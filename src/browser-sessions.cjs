'use strict';
const {randomUUID}=require('node:crypto');
class BrowserSessions{
 constructor({memory}){this.memory=memory;}
 state(){const saved=this.memory.setting('browserSessions',{selected:'default',sessions:[{id:'default',name:'Umay Chrome profili',mode:'managed'}]});return structuredClone(saved);}
 save({id,name,mode='managed',endpoint}){if(typeof name!=='string'||!name.trim()||name.length>120||!['managed','existing'].includes(mode))throw Error('Tarayıcı profili geçersiz.');if(endpoint){const url=new URL(endpoint);if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||!url.port||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Yalnız yerel ve açıkça izin verilmiş Chrome hata ayıklama adresi kullanılabilir.');endpoint=url.origin;}const state=this.state();if(state.sessions.length>=12&&!id)throw Error('En fazla 12 tarayıcı bağlantısı eklenebilir.');const entry={id:id||randomUUID(),name:name.trim(),mode,...(endpoint?{endpoint}:{})};if(id&&!state.sessions.some(s=>s.id===id))throw Error('Tarayıcı bağlantısı bulunamadı.');state.sessions=state.sessions.filter(s=>s.id!==entry.id).concat(entry);this.memory.setSetting('browserSessions',state);return this.state();}
 select(id){const state=this.state();if(!state.sessions.some(s=>s.id===id))throw Error('Tarayıcı bağlantısı bulunamadı.');state.selected=id;this.memory.setSetting('browserSessions',state);return state.sessions.find(s=>s.id===id);}
 current(){const state=this.state();return state.sessions.find(s=>s.id===state.selected)||state.sessions[0];}
}
module.exports={BrowserSessions};
