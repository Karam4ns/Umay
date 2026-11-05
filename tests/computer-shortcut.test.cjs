const {test}=require('node:test'),assert=require('node:assert/strict');
const {ComputerShortcut}=require('../src/computer-shortcut.cjs');
test('F8 remains active through permission/question/confirmation and resumes idempotently',()=>{
 let registered=false,callback,stops=0;const shortcut=new ComputerShortcut({isRegistered:()=>registered,register:(_key,handler)=>{if(registered)return false;registered=true;callback=handler;return true;},unregister:()=>registered=false},()=>stops++);
 shortcut.start();for(const status of ['permission','question','confirmation']){shortcut.finish({status});assert.equal(registered,true);callback();shortcut.start();}assert.equal(stops,3);shortcut.finish({status:'completed'});assert.equal(registered,false);
});
