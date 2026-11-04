const fs=require('node:fs'),ts=require('/app/node_modules/typescript');
const service='__SERVICE__';
const opts={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true};
const normal=s=>s.replace(/\/\/# sourceMappingURL=.*$/gm,'').replace(/var _a(?:, _[a-z])+;\n/g,'').replace(/__metadata\("design:paramtypes", \[[\s\S]*?\]\)/g,'__metadataTypes()').replace(/\s+/g,' ').trim();
for(const name of(service==='chat'?['chat.controller','desktop-context']:['chat.controller','chat-execution','desktop-context'])){
 const file='/tmp/umay-desktop/'+name+'.ts';
 const result=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:name+'.ts',reportDiagnostics:true,compilerOptions:opts});
 const errors=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);if(errors.length)throw Error(JSON.stringify(errors.map(d=>d.messageText)));
 if(name!=='desktop-context'){
  const base=ts.transpileModule(fs.readFileSync(file+'.base','utf8'),{fileName:name+'.ts',compilerOptions:opts}).outputText;
  const live=fs.readFileSync('/app/apps/api/dist/'+name+'.js','utf8');
  if(normal(base)!==normal(live))throw Error('Source snapshot does not reproduce live module '+name);
 }
 fs.writeFileSync('/app/apps/api/dist/'+name+'.js',result.outputText);
}
if(service==='chat'){
 const file='/app/apps/api/dist/chat-execution.js';let source=fs.readFileSync(file,'utf8');
 if(!source.includes('media_options AS'))throw Error('Run fields anchor missing');
 source=source.replace('media_options AS',"(media_options - 'desktopContext' - 'desktopImage') AS");
 source=source.replaceAll("UPDATE chat_runs SET draft_content='',status=","UPDATE chat_runs SET media_options=media_options-'desktopImage',draft_content='',status=");
 fs.writeFileSync(file,source);
}
require('/app/apps/api/dist/desktop-context');require('/app/apps/api/dist/chat.controller');require('/app/apps/api/dist/chat-execution');
console.log('PASS baseline matches live apart from checked decorator metadata/source map; new module syntax and loads passed');
