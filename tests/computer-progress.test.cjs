const {test}=require('node:test'),assert=require('node:assert/strict');
const {observeOutcome,focusedField}=require('../src/computer-progress.cjs');
test('text-only browser optimization excludes forms, quoted/how-to requests and follow-up operations',()=>{
 const {simpleNavigation,addressField}=require('../src/computer-navigation.cjs');assert.equal(simpleNavigation('Chrome ile https://example.org adresini aç.'),true);
 for(const text of ['https://example.org açma','https://example.org aç ve dosyayı indir','https://example.org aç ve giriş yap','https://example.org nasıl açılır?','Şu örneği çevir: open https://example.org','https://example.org adresini yaz','https://example.org ve https://other.org aç'])assert.equal(simpleNavigation(text),false,text);
 assert.equal(addressField({elements:[{name:'Address bar',type:'ControlType.Edit',inDocument:true}]}),undefined);
});
test('navigation readback requires the actual top document in the same window, not typed text or an iframe',()=>{
 const task={steps:[{action:'navigate',outcome:'input_sent'}],pendingNavigation:{url:'https://example.org',index:0,window:1}};
 observeOutcome(task,{handle:1,elements:[{type:'ControlType.Edit',value:'https://example.org'},{type:'ControlType.Document',value:'https://example.org',inDocument:true}]});assert.notEqual(task.steps[0].outcome,'document_matches_destination');
 const elements=[{type:'ControlType.Document',value:'https://example.org',inDocument:false}];observeOutcome(task,{handle:2,elements});assert.ok(task.pendingNavigation);
 observeOutcome(task,{handle:1,elements});assert.equal(task.steps[0].outcome,'document_matches_destination');assert.equal(task.pendingNavigation,undefined);
});
test('specific navigation query/path must be observed before the experience is verified',()=>{
 const task={steps:[{action:'navigate'}],pendingNavigation:{url:'https://example.org/search?q=umay',index:0,window:1}};
 observeOutcome(task,{handle:1,elements:[{type:'ControlType.Document',inDocument:false,value:'https://example.org/search?q=other'}]});assert.ok(task.pendingNavigation);
 observeOutcome(task,{handle:1,elements:[{type:'ControlType.Document',inDocument:false,value:'https://example.org/search?q=umay'}]});assert.equal(task.steps[0].outcome,'document_matches_destination');
});
test('a focused edit wins over Chromium ancestor focus hints',()=>{
 assert.equal(focusedField({elements:[{id:0,focused:true,type:'ControlType.Window'},{id:1,focused:true,type:'ControlType.Document'},{id:2,focused:true,type:'ControlType.Edit'}]}).id,2);
});
