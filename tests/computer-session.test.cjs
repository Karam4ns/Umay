const {test}=require('node:test'),assert=require('node:assert/strict');
const {ComputerSession}=require('../src/computer-session.cjs');
test('follow-up tasks retain actual application and prior task context without application-name routing',()=>{
 const session=new ComputerSession();session.update({id:'one',status:'completed',goal:'Videoyu aç',message:'İlk bölüm açık.',origin:{userRequest:'Dizinin ilk bölümünü aç'},steps:[]});session.observe({handle:42,title:'Bir dizi — Bölüm1',windows:[{handle:42,title:'Bir dizi — Bölüm1'}]});
 session.update({id:'two',status:'running',goal:'Sıradaki bölüme geç',origin:{userRequest:'sıradaki bölüme geç'},steps:[]});const context=session.context();assert.equal(context.previous.userRequest,'Dizinin ilk bölümünü aç');assert.equal(context.foreground.handle,42);assert.equal(context.task.userRequest,'sıradaki bölüme geç');
 session.observe({handle:7,title:'Umay',windows:[{handle:42,title:'Bir dizi — Bölüm1'},{handle:7,title:'Umay'}]});assert.equal(session.context().foreground.handle,42);
});
test('session context is bounded, does not retain screenshots/values, and clears on account switch',()=>{
 const session=new ComputerSession();session.update({id:'one',goal:'x'.repeat(30000),steps:Array.from({length:80},()=>({summary:'y'.repeat(1000)}))});session.observe({handle:42,title:'App',elements:[{value:'private text'}],image:'private screenshot',windows:Array.from({length:80},()=>({handle:42,title:'z'.repeat(2000)}))});
 assert.ok(JSON.stringify(session.context()).length<6500);assert.doesNotMatch(JSON.stringify(session.context()),/private/);session.reset();assert.deepEqual(session.context(),{task:null,previous:null,foreground:null,windows:[]});
});
