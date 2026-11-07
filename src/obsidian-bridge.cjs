'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{createHash,randomUUID}=require('node:crypto');
const hash=value=>createHash('sha256').update(value).digest('hex');
const error=(code,message)=>Object.assign(Error(message),{code});
const blocked=new Set(['raw','.obsidian','.git']);
function checked(root,relative,{mkdir=false}={}){
 if(typeof relative!=='string'||!relative||path.isAbsolute(relative)||relative.split(/[\\/]/).some(p=>p==='..'||/[<>:"|?*\x00-\x1f]/.test(p)||blocked.has(p.toLowerCase())||/[. ]$/.test(p)))throw error('VAULT_PATH','Bu klasör Obsidian hafızası için kullanılamaz.');
 const target=path.resolve(root,relative),rel=path.relative(root,target);if(rel.startsWith('..')||path.isAbsolute(rel))throw error('VAULT_PATH','Vault dışına yazılamaz.');
 let current=path.parse(root).root;for(const part of path.resolve(target).slice(current.length).split(path.sep).filter(Boolean)){
  current=path.join(current,part);if(fs.existsSync(current)){const s=fs.lstatSync(current);if(s.isSymbolicLink()||s.isFile()&&s.nlink>1)throw error('VAULT_LINK','Bağlantılı dosya veya klasör kullanılamaz.');}
 }
 if(mkdir)fs.mkdirSync(target,{recursive:true});return target;
}
function read(file,max=256*1024){const s=fs.lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||s.nlink>1||s.size>max)throw error('VAULT_FILE','Not güvenli biçimde okunamadı.');return fs.readFileSync(file,'utf8');}
function atomic(file,content,expected){
 if(fs.existsSync(file)){if(expected===undefined||hash(read(file,64*1024*1024))!==expected)throw error('VAULT_CONFLICT','Not başka bir işlem tarafından değiştirildi.');}
 else if(expected!==undefined)throw error('VAULT_CONFLICT','Notun yolu değişti.');
 const tmp=file+'.'+randomUUID()+'.tmp';try{fs.writeFileSync(tmp,content,{flag:'wx',mode:0o600});if(expected!==undefined){if(hash(read(file,64*1024*1024))!==expected)throw error('VAULT_CONFLICT','Not yazılırken değişti.');fs.renameSync(tmp,file);}else{fs.copyFileSync(tmp,file,fs.constants.COPYFILE_EXCL);}}finally{try{fs.unlinkSync(tmp);}catch{}}
}
function metadata(text){const match=text.match(/<!-- umay-record:([A-Za-z0-9+/=]+) -->/);if(!match)return null;try{return JSON.parse(Buffer.from(match[1],'base64').toString('utf8'));}catch{return null;}}
function contentOf(text){const match=text.match(/<!-- umay-content -->\r?\n([\s\S]*?)\r?\n<!-- \/umay-content -->/);return match?.[1];}
function render(record,source){const meta=Buffer.from(JSON.stringify({id:record.id,owner:record.owner,revision:record.revision})).toString('base64');const clean=value=>String(value||'').replace(/[\r\n]/g,' ');return `---\ntags: [umay, ${JSON.stringify(record.type)}]\nsources: [${JSON.stringify('[['+source+']]')} ]\ncreated: ${String(record.updatedAt).slice(0,10)}\nupdated: ${String(record.updatedAt).slice(0,10)}\nstatus: olgun\n---\n<!-- umay-record:${meta} -->\n# ${clean(record.title)}\n\n<!-- umay-content -->\n${record.content}\n<!-- /umay-content -->\n\n## Alanlar\n\n\`\`\`json\n${JSON.stringify(record.fields,null,2)}\n\`\`\`\n\n## Kaynak\n\n[[${source}]]\n${record.secretRef?'\nŞifreli kasa referansı: '+record.secretRef.id+'\n':''}\n## Çelişkiler / Açık sorular\n\n${record.conflict?'Sürümler çakışıyor; Umay içinde inceleyin.':'Kayıt kaynaklıdır; yeni işlem izni vermez.'}\n\n## İlgili sayfalar\n\n[[${source}]]\n`;}
async function discoverVaults({configFile=path.join(os.homedir(),'AppData','Roaming','obsidian','obsidian.json')}={}){try{const data=JSON.parse(read(configFile));return Object.entries(data.vaults||{}).filter(([,v])=>typeof v.path==='string'&&fs.existsSync(path.join(v.path,'.obsidian'))).map(([id,v])=>({id,path:v.path,name:path.basename(v.path),open:!!v.open}));}catch{return [];}}
class ObsidianBridge{
 constructor({catalog,memory,openExternal=async()=>{},configFile,now=()=>new Date().toISOString()}={}){Object.assign(this,{catalog,memory,openExternal,configFile,now});this.generation=0;this.account=null;this.status={connected:false};}
 activate(account){this.generation++;this.seenSources={};this.account=account;this.connection=null;this.status={connected:false};if(account&&this.memory?.account===account){const saved=this.memory.setting('obsidianConnection');if(saved)try{this.setup(saved);}catch{this.status.error='Vault yolu kullanılamıyor; bağlantıyı yeniden seçin.';}}}
 setup({vaultPath,folder='entities/umay-hafızası'}){if(!this.account||!path.isAbsolute(vaultPath))throw error('VAULT_PATH','Önce hesabı ve gerçek vault klasörünü seçin.');const root=path.resolve(vaultPath);checked(root,'.umay-root-check');if(!fs.statSync(root).isDirectory()||!fs.statSync(path.join(root,'.obsidian')).isDirectory())throw error('NOT_VAULT','Seçilen klasör bir Obsidian vault değil.');checked(root,folder);this.owner=hash(String(this.account));this.connection={vaultPath:root,folder};this.status={connected:true,vaultPath:root,folder,lastSync:null,conflicts:[]};this.known=this.memory?.setting('obsidianKnown',{})||{};}
 async connect(input){this.setup(input);this.memory?.setSetting('obsidianConnection',this.connection);return this.state();}
 disconnect(){this.generation++;this.connection=null;this.status={connected:false};this.memory?.setSetting('obsidianConnection',null);return this.state();}
 state(){return structuredClone(this.status);}
 require(){if(!this.connection||!this.account)throw error('VAULT_DISCONNECTED','Önce Obsidian vault bağlantısını kurun.');return this.connection;}
 recordPath(id){const c=this.require();if(this.known?.[id]?.path)return checked(c.vaultPath,this.known[id].path);const title=this.catalog.get(id)?.title||'kayıt',slug=title.normalize('NFC').toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'').slice(0,60)||'kayıt';return checked(c.vaultPath,c.folder+'/'+this.owner+'/'+slug+'-'+hash(id).slice(0,16)+'.md');}
 sourceDirectory(){const c=this.require();return checked(c.vaultPath,'sources/umay/'+this.owner,{mkdir:true});}
 secretDirectory(){const c=this.require();return checked(c.vaultPath,'entities/umay-hafızası/'+this.owner+'/şifreli-aktarım',{mkdir:true});}
 protectedPaths(){return this.connection?[this.secretDirectory()]:[];}
 async publishSecretSnapshot({deviceId,bytes}){if(!Buffer.isBuffer(bytes)||bytes.length>64*1024*1024||typeof deviceId!=='string'||!deviceId)throw error('VAULT_SNAPSHOT','Şifreli aktarım paketi geçersiz.');const directory=this.secretDirectory(),file=checked(directory,hash(deviceId)+'.umay-encrypted');atomic(file,bytes,fs.existsSync(file)?hash(read(file,64*1024*1024)):undefined);return {path:file,size:bytes.length};}
 async secretSnapshots(){const dir=this.secretDirectory();return fs.readdirSync(dir).filter(n=>/^[a-f0-9]{64}\.umay-encrypted$/.test(n)).map(n=>{const file=checked(dir,n),s=fs.lstatSync(file);if(s.isSymbolicLink()||s.nlink>1||s.size>64*1024*1024)throw error('VAULT_SNAPSHOT','Aktarım paketi kullanılamıyor.');return {path:file,size:s.size,modifiedAt:s.mtime.toISOString()};});}
 async openRecord(id){const file=this.recordPath(id);read(file);await this.openExternal('obsidian://open?path='+encodeURIComponent(file));return true;}
 ownedNotes(directory){const result=[];let count=0;const visit=dir=>{if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(++count>10000)throw error('VAULT_LIMIT','Not klasörü çok büyük; taşıma denetimi tamamlanamadı.');const file=checked(this.connection.vaultPath,path.relative(this.connection.vaultPath,path.join(dir,entry.name)));if(entry.isDirectory())visit(file);else if(entry.isFile()&&entry.name.endsWith('.md')){const text=read(file),meta=metadata(text);if(meta?.owner===this.owner)result.push({file,meta});}}};visit(directory);return result;}
 updateNavigation(records){
  const root=this.connection.vaultPath,start='<!-- umay-index:'+this.owner+' -->',end='<!-- /umay-index:'+this.owner+' -->';
  const active=records.filter(r=>!r.deleted),lines=active.map(r=>'\u002d [['+path.relative(root,this.recordPath(r.id)).replace(/\\/g,'/').replace(/\.md$/,'')+'|'+String(r.title).replace(/[\r\n\[\]|]/g,' ') +']]'+(r.conflict?' · Çatışma':''));
  const block=start+'\n## Umay kişisel hafızası\n\n'+lines.join('\n')+'\n'+end,index=checked(root,'index.md');
  const previous=fs.existsSync(index)?read(index):'---\ntags: [umay]\nstatus: olgun\n---\n# Bilgi arşivi\n',from=previous.indexOf(start),to=previous.indexOf(end);
  if((from<0)!==(to<0)||from>=0&&to<from)throw error('VAULT_CONFLICT','İçerik kataloğundaki Umay alanı değişmiş; korunuyor.');
  const next=from<0?previous+'\n'+block+'\n':previous.slice(0,from)+block+previous.slice(to+end.length);if(next!==previous)atomic(index,next,fs.existsSync(index)?hash(previous):undefined);
  const journal=this.memory?.setting('obsidianJournal',{})||{},changed=records.filter(r=>journal[r.id]!==r.revision);if(!changed.length)return;
  const log=checked(root,'log.md');if(fs.existsSync(log))read(log);const text=changed.map(r=>'\n## ['+this.now().slice(0,10)+'] hafıza | '+String(r.title).replace(/[\r\n]/g,' ')+'\n\nUmay kaydı '+(r.deleted?'arşivlendi':r.conflict?'çatışmalı olarak korundu':'eşitlendi')+'. Kaynak: [[sources/umay/'+this.owner+'/'+hash(r.heads[0])+']].\n').join('');
  fs.appendFileSync(log,text,{encoding:'utf8',mode:0o600});for(const r of changed)journal[r.id]=r.revision;this.memory?.setSetting('obsidianJournal',journal);
 }
 async sync({signal}={}){
  if(this.syncing)throw error('VAULT_BUSY','Eşitleme sürüyor.');const generation=this.generation;this.require();const check=()=>{signal?.throwIfAborted();if(generation!==this.generation||this.account!==this.memory?.account&&this.memory)throw error('VAULT_CANCELLED','Eşitleme durduruldu.');};this.syncing=true;
  try{check();const c=this.connection,sourceDir=this.sourceDirectory(),managed=checked(c.vaultPath,c.folder+'/'+this.owner,{mkdir:true}),conflicts=[];
   // Immutable public source events preserve full ancestry for a new device.
   this.seenSources??={};const sourceNames=fs.readdirSync(sourceDir).filter(n=>n.endsWith('.md'));if(sourceNames.length>10000)throw error('VAULT_LIMIT','Kaynak geçmişi 10.000 olayı aştı; eşitleme tamamlanmadı. Geçmişi koruyarak bakım gerekiyor.');let sourceCount=0;
   for(const name of sourceNames){check();const text=read(checked(sourceDir,name)),digest=hash(text);if(this.seenSources[name]===digest)continue;const match=text.match(/```json\r?\n([\s\S]*?)\r?\n```/);if(!match)continue;this.catalog.ingest(JSON.parse(match[1]));this.seenSources[name]=digest;if(++sourceCount%10===0){await new Promise(r=>setImmediate(r));check();}}
   const known=this.known||{};
   const missing=Object.keys(known).filter(id=>!fs.existsSync(checked(c.vaultPath,known[id].path)));
   if(missing.length){const locations=this.ownedNotes(managed);for(const id of missing){const matches=locations.filter(n=>n.meta.id===id);if(matches.length===1)known[id]={...known[id],path:path.relative(c.vaultPath,matches[0].file)};else if(matches.length>1)conflicts.push({id,reason:'Aynı kaydın birden fazla taşınmış kopyası var; korunuyor.'});}}
   for(const [id,entry]of Object.entries(known)){check();if(conflicts.some(x=>x.id===id))continue;const file=checked(c.vaultPath,entry.path);if(!fs.existsSync(file)){const record=this.catalog.get(id);if(record&&!record.deleted)this.catalog.archive(id,record.revision);continue;}
    const text=read(file);if(hash(text)!==entry.hash){const record=this.catalog.get(id),meta=metadata(text),content=contentOf(text);if(!record||meta?.owner!==this.owner||meta.id!==id||content===undefined){conflicts.push({id,path:entry.path,reason:'Not kimliği/içeriği değişti; korunuyor.'});continue;}
     if(record.revision!==entry.revision){conflicts.push({id,path:entry.path,reason:'Hem yerel hem Obsidian sürümü değişti.'});continue;}
     try{const fieldsMatch=text.match(/## Alanlar\s+```json\r?\n([\s\S]*?)\r?\n```/);const title=text.match(/^# (.+)$/m)?.[1]||record.title;this.catalog.ingest({...record,title,content,fields:fieldsMatch?JSON.parse(fieldsMatch[1]):record.fields},{path:entry.path,parentRevision:entry.revision});known[id]={...entry,hash:hash(text)};}catch(e){conflicts.push({id,path:entry.path,reason:e.message});}
    }
   }
   const db=this.catalogMemory();const events=db?db.prepare("SELECT payload FROM memory_catalog_events WHERE status='valid' ORDER BY event_id").all().map(r=>JSON.parse(r.payload)):this.catalog.changes();
   for(const event of events){check();const name=hash(event.revision)+'.md',file=checked(sourceDir,name),body=`---\ntags: [source, umay]\ncreated: ${event.updatedAt.slice(0,10)}\nupdated: ${event.updatedAt.slice(0,10)}\nstatus: olgun\n---\n# Umay hafıza kaynağı\n\n\`\`\`json\n${JSON.stringify(event)}\n\`\`\`\n`;if(fs.existsSync(file)){if(read(file)!==body)throw error('VAULT_EVENT_CONFLICT','Kaynak olay dosyası değişmiş; üstüne yazılmadı.');}else atomic(file,body);}
   const records=[];for(let offset=0;;offset+=200){const page=this.catalog.list({includeArchived:true,limit:200,offset});records.push(...page);if(page.length<200)break;}
   for(const record of records){check();if(record.conflict||record.syncPending||conflicts.some(x=>x.id===record.id))continue;const file=this.recordPath(record.id),relative=path.relative(c.vaultPath,file);if(record.deleted){if(fs.existsSync(file)){const text=read(file),meta=metadata(text);if(meta?.id===record.id&&meta.owner===this.owner){const archived=checked(c.vaultPath,'archive/umay/'+this.owner,{mkdir:true});fs.renameSync(file,checked(archived,path.basename(file)+'-'+randomUUID()+'.md'));}}delete known[record.id];continue;}
    const text=render(record,'sources/umay/'+this.owner+'/'+hash(record.heads[0]));if(fs.existsSync(file)){const previous=read(file);if(!known[record.id]){const meta=metadata(previous);if(meta?.id!==record.id||meta.owner!==this.owner){conflicts.push({id:record.id,path:relative,reason:'Yabancı not korunuyor.'});continue;}}if(previous!==text){const backup=checked(c.vaultPath,'archive/umay/'+this.owner,{mkdir:true});atomic(checked(backup,hash(record.id)+'-'+randomUUID()+'.md'),previous);atomic(file,text,hash(previous));}}else atomic(file,text);known[record.id]={path:relative,hash:hash(text),revision:record.revision};
   }
   this.updateNavigation(records);
   // Acknowledge only source events whose immutable write and materialization succeeded.
   for(const event of this.catalog.changes())if(!conflicts.some(x=>x.id===event.id))this.catalog.ack(event.revision);
   check();this.known=known;this.memory?.setSetting('obsidianKnown',known);this.status={...this.status,lastSync:this.now(),conflicts,pending:this.catalog.changes().length};return this.state();
  }finally{this.syncing=false;}
 }
 catalogMemory(){return this.memory?.require();}
 close(){this.generation++;this.connection=null;this.account=null;}
}
module.exports={ObsidianBridge,discoverVaults};
