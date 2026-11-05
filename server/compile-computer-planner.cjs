// Overlay only the planner module on the currently deployed image. Other
// application modules, runtime configuration and database schema stay intact.
const fs=require('node:fs'),ts=require('/app/node_modules/typescript');
const source=fs.readFileSync('/tmp/umay-computer/desktop-context.ts','utf8');
const result=ts.transpileModule(source,{fileName:'desktop-context.ts',reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
const errors=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
if(errors.length)throw Error(JSON.stringify(errors.map(d=>d.messageText)));
const file='/app/apps/api/dist/desktop-context.js';fs.writeFileSync(file,result.outputText);
const helper=require(file);if(!helper.computerInstructions.includes('focus_window')||!helper.computerInstructions.includes('middle_click'))throw Error('Planner action schema incomplete');
console.log('PASS computer planner module compiled and loaded');
const execution='/app/apps/api/dist/chat-execution.js';
const {patchChatDispatch}=require('/tmp/umay-computer/patch-chat-dispatch.cjs');
fs.writeFileSync(execution,patchChatDispatch(fs.readFileSync(execution,'utf8')));
require(execution);
console.log('PASS conversational handoff overlay syntax and module load');
