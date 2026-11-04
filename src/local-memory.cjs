'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {DatabaseSync}=require('node:sqlite');
const {createHash,randomUUID}=require('node:crypto');
const fold=value=>String(value??'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/ı/g,'i').toLowerCase();
const bounded=(value,max=12000)=>String(value??'').slice(0,max);
function redact(value){return bounded(value).replace(/\b(?:password|parola|şifre(?:m|si)?|api[_ -]?key|access[_ -]?token|secret)\s*[:=]\s*[^\s,;]+/gi,'[özel bilgi]');}
function factsFrom(text){
 const value=redact(text).replace(/```[\s\S]*?```|"[^"\n]*"|“[^”]*”|«[^»]*»/g,'').replace(/^\s*>.*$/gm,''),facts=[];
 if(/çevir|tercüme|alıntı|örnek\s+(?:metin|cümle)|şu\s+(?:cümle|metin)|translate|quote/iu.test(value))return facts;
 const name=value.match(/^\s*(?:benim\s+)?adım\s+([^.!?\n,]{2,70})/iu);
 if(name)facts.push({key:'profile.name',kind:'profile',title:'Adı',content:name[1].trim()});
 for(const line of value.split(/[.!?\n]/).map(s=>s.trim()).filter(Boolean)){
  if(/(?:seviyorum|sevmiyorum|tercih ediyorum|hoşlanıyorum|hoşlanmıyorum|beğendim|beğenmedim|alerjim var)/iu.test(line)){const subject=fold(line.split(/seviyorum|sevmiyorum|tercih ediyorum|hoşlanıyorum|hoşlanmıyorum|beğendim|beğenmedim|alerjim var/iu)[0]).replace(/\b(?:ben|benim|cok|hic|artik)\b/g,'').replace(/\s+/g,' ').trim();facts.push({key:'preference:'+subject,kind:'preference',title:line.slice(0,70),content:line});}
  else if(/(?:yaşındayım|yaşıyorum|çalışıyorum|öğrenciyim|mesleğim|doğum günüm|benim için önemli|karar verdim)/iu.test(line))facts.push({kind:'profile',title:line.slice(0,70),content:line});
 }
 return facts;
}
class LocalMemory{
 constructor(directory,{encrypt,decrypt,now=()=>new Date().toISOString()}={}){this.directory=directory;this.encrypt=encrypt;this.decrypt=decrypt;this.now=now;this.epoch=0;this.account=null;this.db=null;}
 activate(account){
  account=account==null?null:String(account);if(account===this.account)return;
  this.epoch++;this.db?.close();this.db=null;this.account=account;if(!account)return;
  fs.mkdirSync(this.directory,{recursive:true});
  const file=path.join(this.directory,createHash('sha256').update(account).digest('hex')+'.sqlite');
  const db=this.db=new DatabaseSync(file);db.exec(`PRAGMA journal_mode=WAL;PRAGMA foreign_keys=ON;PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY,title TEXT NOT NULL,source TEXT NOT NULL DEFAULT 'chat',remote_deleted INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES conversations(id),role TEXT NOT NULL,content TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'saved',created_at TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS message_conversation ON messages(conversation_id,created_at);
   CREATE VIRTUAL TABLE IF NOT EXISTS message_search USING fts5(id UNINDEXED,content,tokenize='unicode61 remove_diacritics 2');
   CREATE TABLE IF NOT EXISTS nodes(id TEXT PRIMARY KEY,kind TEXT NOT NULL,title TEXT NOT NULL,content TEXT NOT NULL,tags TEXT NOT NULL DEFAULT '[]',canonical_key TEXT,source_message TEXT,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS node_kind ON nodes(kind,active,updated_at);
   CREATE UNIQUE INDEX IF NOT EXISTS node_canonical ON nodes(canonical_key) WHERE canonical_key IS NOT NULL AND active=1;
   CREATE TABLE IF NOT EXISTS links(source TEXT NOT NULL,target TEXT NOT NULL,relation TEXT NOT NULL,PRIMARY KEY(source,target,relation));
   CREATE TABLE IF NOT EXISTS operations(id INTEGER PRIMARY KEY,kind TEXT NOT NULL,status TEXT NOT NULL,summary TEXT NOT NULL,details TEXT NOT NULL,created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS device_files(path TEXT PRIMARY KEY,name TEXT NOT NULL,root TEXT NOT NULL,kind TEXT NOT NULL,size INTEGER NOT NULL,modified_at TEXT NOT NULL,seen_at TEXT NOT NULL,present INTEGER NOT NULL DEFAULT 1);
   CREATE INDEX IF NOT EXISTS device_file_name ON device_files(name);
   CREATE TABLE IF NOT EXISTS private_accounts(id TEXT PRIMARY KEY,encrypted BLOB NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS alerts(id TEXT PRIMARY KEY,source TEXT NOT NULL,title TEXT NOT NULL,summary TEXT NOT NULL,url TEXT NOT NULL,published_at TEXT NOT NULL,received_at TEXT NOT NULL,read INTEGER NOT NULL DEFAULT 0,notified INTEGER NOT NULL DEFAULT 0);
   PRAGMA user_version=1;`);
 }
 require(){if(!this.db||!this.account)throw Error('Yerel hafızayı açmak için giriş yapın.');return this.db;}
 check(epoch){if(epoch!==this.epoch)throw Error('Hesap değişti; önceki işlem durduruldu.');return this.require();}
 setting(key,fallback=null){const row=this.require().prepare('SELECT value FROM settings WHERE key=?').get(key);return row?JSON.parse(row.value):fallback;}
 setSetting(key,value){this.require().prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));return value;}
 log(kind,summary,{status='completed',details={}}={}){
  const safe={};for(const [key,value]of Object.entries(details))if(!/password|parola|secret|token|audio|image|text|content/i.test(key))safe[key]=typeof value==='string'?redact(value).slice(0,600):value;
  this.require().prepare('INSERT INTO operations(kind,status,summary,details,created_at) VALUES(?,?,?,?,?)').run(bounded(kind,80),bounded(status,40),redact(summary).slice(0,500),JSON.stringify(safe),this.now());
 }
 archiveConversation(conversation,messages=[]){
  if(!conversation?.id)return;const db=this.require(),now=this.now();
  db.prepare("INSERT INTO conversations VALUES(?,?,?,0,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,updated_at=excluded.updated_at,remote_deleted=0").run(String(conversation.id),bounded(conversation.title||'Sohbet',200),conversation.localSource||'chat',conversation.createdAt||now,now);
  const conversationNode=this.putNode({kind:'conversation',title:bounded(conversation.title||'Sohbet',200),content:'Sohbet arşivi: '+String(conversation.id),key:'conversation:'+conversation.id});
  db.exec('BEGIN');try{
   for(const message of messages){
    if(!message?.id||!['user','assistant','system'].includes(String(message.role).toLowerCase()))continue;
    const id=String(message.id),role=String(message.role).toLowerCase(),content=bounded(message.content,200000);
    if(role==='user'&&!id.startsWith('request:')){
     const pending=db.prepare("SELECT id FROM messages WHERE conversation_id=? AND role='user' AND content=? AND id LIKE 'request:%' AND status IN('pending','submitted') AND abs(julianday(created_at)-julianday(?))*86400<20 ORDER BY created_at LIMIT 1").get(String(conversation.id),content,message.createdAt||now);
     if(pending&&!db.prepare('SELECT id FROM messages WHERE id=?').get(id)){
      db.prepare('UPDATE messages SET id=?,status=? WHERE id=?').run(id,'saved',pending.id);db.prepare('UPDATE message_search SET id=? WHERE id=?').run(id,pending.id);db.prepare('UPDATE nodes SET source_message=? WHERE source_message=?').run(id,pending.id);
     }
    }
    const previous=db.prepare('SELECT content FROM messages WHERE id=?').get(id);
    if(previous?.content===content)continue;
    db.prepare('INSERT INTO messages VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content,status=excluded.status').run(id,String(conversation.id),role,content,message.status||'saved',message.createdAt||now);
    db.prepare('DELETE FROM message_search WHERE id=?').run(id);db.prepare('INSERT INTO message_search(id,content) VALUES(?,?)').run(id,fold(redact(content)));
    if(role==='user')for(const fact of factsFrom(content)){const node=this.putNode({...fact,sourceMessage:id});this.link(node,conversationNode,'source');}
   }
   db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
 }
 outgoing(conversationId,requestId,content,status='pending'){
  const conversation=this.require().prepare('SELECT * FROM conversations WHERE id=?').get(conversationId);
  this.archiveConversation({id:conversationId,title:conversation?.title||bounded(content,140)},[{id:'request:'+requestId,role:'user',content,status}]);
  this.require().prepare('UPDATE messages SET status=? WHERE id=?').run(status,'request:'+requestId);
 }
 markRemoteDeleted(id){this.require().prepare('UPDATE conversations SET remote_deleted=1 WHERE id=?').run(String(id));}
 putNode({id,kind='note',title,content,tags=[],key,sourceMessage}){
  const db=this.require(),now=this.now();title=bounded(title,200).trim();content=redact(content).trim();if(!title||!content)throw Error('Başlık ve hafıza metni gerekli.');
  if(!['note','profile','preference','device','decision','remote','conversation'].includes(kind))throw Error('Hafıza türü geçersiz.');
  const encodedTags=JSON.stringify(tags.slice(0,20).map(t=>bounded(t,60)));
  let previous=id?db.prepare('SELECT * FROM nodes WHERE id=?').get(id):key?db.prepare('SELECT * FROM nodes WHERE canonical_key=? AND active=1').get(key):db.prepare('SELECT * FROM nodes WHERE kind=? AND content=? AND active=1').get(kind,content);
  if(id&&!previous)throw Error('Hafıza kaydı bulunamadı.');
  if(previous?.content===content&&previous.title===title&&previous.tags===encodedTags)return previous.id;
  const nodeId=randomUUID();
  if(previous){db.prepare('UPDATE nodes SET active=0 WHERE id=?').run(previous.id);this.link(nodeId,previous.id,'replaces');}
  db.prepare('INSERT INTO nodes VALUES(?,?,?,?,?,?,?,1,?,?)').run(nodeId,kind,title,content,encodedTags,key||previous?.canonical_key||null,sourceMessage||previous?.source_message||null,now,now);
  if(previous)db.prepare('INSERT OR IGNORE INTO links SELECT source,?,relation FROM links WHERE target=?').run(nodeId,previous.id);
  for(const match of content.matchAll(/\[\[([^\]]{1,200})\]\]/g)){const target=db.prepare('SELECT id FROM nodes WHERE title=? AND active=1').get(match[1]);if(target)this.link(nodeId,target.id,'references');}
  return nodeId;
 }
 link(source,target,relation='related'){this.require().prepare('INSERT OR IGNORE INTO links VALUES(?,?,?)').run(source,target,relation);}
 archiveNode(id){this.require().prepare('UPDATE nodes SET active=0,updated_at=? WHERE id=?').run(this.now(),String(id));this.log('memory','Hafıza kaydı arşivlendi',{details:{id}});}
 search(query='',limit=30){
  const db=this.require(),words=fold(query).match(/[\p{L}\p{N}]{2,}/gu)||[],expression=words.slice(0,12).map(w=>'"'+w+'"*').join(' OR ');
  if(!expression)return [];
  return db.prepare('SELECT m.*,c.title AS conversation_title FROM message_search s JOIN messages m ON m.id=s.id JOIN conversations c ON c.id=m.conversation_id WHERE message_search MATCH ? ORDER BY bm25(message_search) LIMIT ?').all(expression,Math.min(100,limit));
 }
 snapshot({query='',kind='',limit=100}={}){
  const db=this.require(),filter=kind?' AND kind=?':'',params=kind?[kind,Math.min(200,limit)]:[Math.min(200,limit)];
  let nodes=db.prepare('SELECT * FROM nodes WHERE active=1'+filter+' ORDER BY updated_at DESC LIMIT ?').all(...params);
  if(query)nodes=nodes.filter(n=>fold(n.title+' '+n.content+' '+n.tags).includes(fold(query)));
  const ids=new Set(nodes.map(n=>n.id)),links=db.prepare('SELECT * FROM links').all().filter(l=>ids.has(l.source)&&ids.has(l.target));
  const count=table=>db.prepare('SELECT count(*) AS n FROM '+table).get().n;
  return {nodes:nodes.map(n=>({...n,tags:JSON.parse(n.tags)})),links,messages:query?this.search(query):[],conversations:db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 100').all(),operations:db.prepare('SELECT * FROM operations ORDER BY id DESC LIMIT 100').all().map(r=>({...r,details:JSON.parse(r.details)})),counts:{nodes:count('nodes'),messages:count('messages'),conversations:count('conversations'),files:count('device_files'),privateAccounts:count('private_accounts')},roots:this.setting('indexRoots',[])};
 }
 conversation(id){return this.require().prepare('SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at,id').all(String(id));}
 context(query){
  const db=this.require(),profile=db.prepare("SELECT kind,title,content,updated_at FROM nodes WHERE active=1 AND kind IN('profile','preference','decision') ORDER BY updated_at DESC LIMIT 18").all();
  const messages=this.search(query,5).map(m=>({date:m.created_at,conversation:m.conversation_title,role:m.role,text:redact(m.content).slice(0,650)}));
  const operations=db.prepare('SELECT summary,status,created_at FROM operations ORDER BY id DESC LIMIT 5').all();
  const words=fold(query).match(/[\p{L}\p{N}]{3,}/gu)||[];
  const notes=db.prepare("SELECT id,kind,title,content,source_message,updated_at FROM nodes WHERE active=1 AND kind IN('note','device','remote') ORDER BY updated_at DESC LIMIT 1000").all().map(n=>({...n,score:words.reduce((score,w)=>score+(fold(n.title+' '+n.content).includes(w)?1:0),0)})).filter(n=>n.score>0).sort((a,b)=>b.score-a.score).slice(0,8).map(({score,...n})=>({...n,content:n.content.slice(0,1200)}));
  return {profile,notes,messages,lastOperations:operations};
 }
 async savePrivate(input){
  if(!this.encrypt)throw Error('Windows güvenli saklama kullanılamıyor.');const epoch=this.epoch;this.require();
  const value={service:bounded(input.service,150).trim(),username:bounded(input.username,300),password:bounded(input.password,4000),notes:bounded(input.notes,4000)};
  if(!value.service)throw Error('Hesap adı gerekli.');const encrypted=await this.encrypt(JSON.stringify(value)),db=this.check(epoch),id=input.id||randomUUID(),now=this.now();
  if(input.id&&!db.prepare('SELECT id FROM private_accounts WHERE id=?').get(id))throw Error('Hesap kaydı bulunamadı.');
  db.prepare('INSERT INTO private_accounts VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET encrypted=excluded.encrypted,updated_at=excluded.updated_at').run(id,encrypted,now,now);this.log('private-account','Özel hesap kaydı kaydedildi',{details:{id}});return {id};
 }
 async privateAccounts(){
  const epoch=this.epoch,rows=this.require().prepare('SELECT * FROM private_accounts ORDER BY updated_at DESC').all(),result=[];
  for(const row of rows){const data=JSON.parse(await this.decrypt(Buffer.from(row.encrypted)));this.check(epoch);result.push({id:row.id,service:data.service,username:data.username,hasPassword:!!data.password,updatedAt:row.updated_at});}return result;
 }
 deletePrivate(id){this.require().prepare('DELETE FROM private_accounts WHERE id=?').run(String(id));this.log('private-account','Özel hesap kaydı silindi',{details:{id}});}
 findFiles(query){const pattern='%'+String(query).replace(/[!%_]/g,'!$&')+'%';return this.require().prepare("SELECT * FROM device_files WHERE name LIKE ? ESCAPE '!' OR path LIKE ? ESCAPE '!' ORDER BY present DESC,seen_at DESC LIMIT 100").all(pattern,pattern);}
 async indexFiles(roots,{onProgress=()=>{},cancelled=()=>false}={}){
  const epoch=this.epoch;this.require();const stamp=this.now(),excluded=new Set(['node_modules','.git','.venv','__pycache__','AppData','$Recycle.Bin','System Volume Information']);
  let count=0,unreadable=0;const canonical=[];
  for(const root of roots){const resolved=path.resolve(root);const stat=await fs.promises.stat(resolved).catch(()=>null);this.check(epoch);if(stat?.isDirectory())canonical.push(resolved);}
  if(!canonical.length)throw Error('İndekslenecek klasör bulunamadı.');this.setSetting('indexRoots',canonical);
  for(const root of canonical){
   let complete=true;const queue=[root];
   while(queue.length){
    this.check(epoch);if(cancelled())return {cancelled:true,count,unreadable};
    const current=queue.pop();let entries;
    try{entries=await fs.promises.readdir(current,{withFileTypes:true});}catch{unreadable++;complete=false;continue;}
    let batch=[];const flush=()=>{if(!batch.length)return;const db=this.check(epoch);db.exec('BEGIN');try{const insert=db.prepare('INSERT INTO device_files VALUES(?,?,?,?,?,?,?,1) ON CONFLICT(path) DO UPDATE SET size=excluded.size,modified_at=excluded.modified_at,seen_at=excluded.seen_at,present=1');for(const row of batch)insert.run(...row);db.exec('COMMIT');batch=[];}catch(error){db.exec('ROLLBACK');throw error;}};
    for(const entry of entries){
     if(entry.isSymbolicLink()||excluded.has(entry.name))continue;const file=path.join(current,entry.name);
     const stat=await fs.promises.stat(file).catch(()=>null);if(!stat){unreadable++;continue;}this.check(epoch);
     batch.push([file,entry.name,root,entry.isDirectory()?'directory':'file',stat.size,stat.mtime.toISOString(),stamp]);count++;
     if(entry.isDirectory())queue.push(file);
     if(count%100===0){flush();onProgress({count,unreadable,current});await new Promise(resolve=>setImmediate(resolve));}
    }
    flush();
   }
   if(complete)this.require().prepare('UPDATE device_files SET present=0 WHERE root=? AND seen_at<>?').run(root,stamp);
  }
  this.log('file-index','Dosya yolu hafızası güncellendi',{details:{count,unreadable}});return {count,unreadable,cancelled:false};
 }
 exportMarkdown(){const data=this.snapshot({limit:200});return '# Umay hafızası\n\n'+data.nodes.map(n=>'## '+n.title+'\n\nTür: '+n.kind+'\nEtiketler: '+n.tags.join(', ')+'\n\n'+n.content+'\n').join('\n')+'\n## Son işlemler\n\n'+data.operations.map(o=>'- '+o.created_at+' — '+o.summary+' ('+o.status+')').join('\n');}
 close(){this.activate(null);}
}
module.exports={LocalMemory,factsFrom,redact,fold};
