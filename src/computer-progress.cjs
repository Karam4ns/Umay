'use strict';
const {createHash}=require('node:crypto');
const hash=value=>createHash('sha256').update(value).digest('hex');
function focusedField(view){return view.elements?.find(e=>e.focused&&e.type==='ControlType.Edit')||view.elements?.find(e=>e.focused&&!['ControlType.Window','ControlType.Document'].includes(e.type))||view.elements?.find(e=>e.focused);}
function targetOf(view){
 const field=focusedField(view);
 return {window:view.handle??null,title:String(view.title||'').slice(0,120),...(field?{name:String(field.name||'').slice(0,100),automationId:field.automationId||'',type:field.type||''}:{})};
}
function inputSignature(action,view){
 // A changing screenshot/input value is NOT evidence that repeating a write is
 // useful. UIA ids can also be renumbered on each observation.
 const element=view.elements?.find(e=>e.id===action.elementId),target=element?{name:element.name,type:element.type,automationId:element.automationId,bounds:element.bounds}:null;
 return hash(JSON.stringify([action.action,targetOf(view),target,action.text,action.url,action.keys,action.windowHandle,action.x,action.y,action.displayId,action.amount,...(action.action==='type'?[]:[view.elements,view.screenshots?.map(s=>s.image)])]));
}
function repeatedWrite(task,action,view){
 if(action.action!=='type')return false;
 const previous=task.lastWrite;
 if(!previous||previous.text!==hash(action.text||'')||previous.window!==view.handle)return false;
 const target=JSON.stringify(targetOf(view));
 return (previous.target===target||task.steps.at(-1)?.action==='type')&&!task.writeReset&&!action.replace;
}
function noteInput(task,action,view){
 if(action.action==='navigate'){delete task.lastWrite;task.writeReset=false;return;}
 if(action.action==='type'){
  task.lastWrite={text:hash(action.text),window:view.handle,target:JSON.stringify(targetOf(view))};task.writeReset=false;
 }else if(action.action==='keys'&&action.keys?.map(k=>String(k).toUpperCase()).includes('A')&&action.keys?.some(k=>/^(CTRL|CONTROL)$/i.test(k)))task.writeReset=true;
 // A click does not prove the old content was erased. A different focused
 // target/window naturally gets its own signature on the next observation.
}
function stepRecord(action,view,elapsedMs){
 return {action:action.action,summary:String(action.summary||'').slice(0,180),target:targetOf(view),elapsedMs,...(action.keys?{keys:action.keys}:{}),...(action.action==='navigate'?{destination:new URL(action.url).origin}:{}),...(action.action==='type'?{characters:action.text.length,replace:action.replace===true,submit:action.submit===true}:{}),outcome:'input_sent'};
}
function observeOutcome(task,view){
 if(task.pendingNavigation){
  const expected=new URL(task.pendingNavigation.url),matched=view.handle===task.pendingNavigation.window&&view.elements?.some(e=>{if(e.type!=='ControlType.Document'||e.inDocument!==false)return false;try{const actual=new URL(e.value);return actual.origin===expected.origin&&(expected.pathname==='/'||actual.pathname===expected.pathname)&&(!expected.search||actual.search===expected.search)&&(!expected.hash||actual.hash===expected.hash);}catch{return false;}});
  if(matched){const record=task.steps[task.pendingNavigation.index];if(record)record.outcome='document_matches_destination';delete task.pendingNavigation;}
 }
 const last=task.steps.at(-1);if(!last||last.outcome!=='input_sent')return;
 last.after={window:view.handle??null,title:String(view.title||'').slice(0,120)};
 const field=focusedField(view);
 if(last.action==='type'&&view.handle===task.lastWrite?.window&&task.pendingText!=null&&field?.value===task.pendingText)last.outcome='field_matches_input';
 else last.outcome='observed_after_input';
 delete task.pendingText;
}
module.exports={inputSignature,repeatedWrite,noteInput,stepRecord,observeOutcome,focusedField};
