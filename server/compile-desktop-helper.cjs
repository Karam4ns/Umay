// Helper-only overlay: no controller/execution patching or route changes.
const fs=require('node:fs'),ts=require('/app/node_modules/typescript');
const source=fs.readFileSync('/tmp/umay-desktop-helper/desktop-context.ts','utf8');
const result=ts.transpileModule(source,{fileName:'desktop-context.ts',reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
if(result.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error))throw Error('Desktop helper TypeScript diagnostics');
const target='/app/apps/api/dist/desktop-context.js';fs.writeFileSync(target,result.outputText);const helper=require(target);
for(const action of ['watch','hold','move_relative'])if(!helper.computerInstructions.includes(action))throw Error('Missing capability '+action);
if(helper.desktopChatInstructionsFor({desktopMode:'context',desktopContext:'{"capabilities":{"computerControl":true,"protocol":"umay-computer-task-v1"}}'})==='')throw Error('Conversational dispatch disabled');
console.log('PASS helper-only general computer capability overlay');
