const {test}=require('node:test'),assert=require('node:assert/strict');
const helper=require('../server/desktop-context.ts');
const options={desktopMode:'context',desktopContext:JSON.stringify({capabilities:{computerControl:true,protocol:'umay-computer-task-v1'}})};
test('only an enabled desktop chat can receive a structured computer task',()=>{
 const raw=JSON.stringify({umayComputerTask:1,goal:'Not Defteri’ni aç',acknowledgement:'Açıyorum.'});
 assert.equal(helper.desktopChatTask(raw,{}),null);assert.equal(helper.desktopChatTask(raw,{...options,desktopMode:'computer'}),null);assert.equal(helper.desktopChatTask(raw,options).goal,'Not Defteri’ni aç');
 assert.equal(helper.desktopChatTask(JSON.stringify({answer:'Normal cevap'}),options),null);assert.equal(helper.desktopChatTask(JSON.stringify({umayComputerTask:1,goal:'',acknowledgement:'…'}),options),null);
});
test('normal web context remains data while chat capability adds dispatch instructions',()=>{
 assert.doesNotMatch(helper.deviceContext({desktopContext:'{"clock":"test"}'}),/UMAY CONVERSATIONAL COMPUTER CONTROL/);
 assert.equal(helper.desktopChatInstructionsFor({}), '');assert.match(helper.desktopChatInstructionsFor(options),/UMAY CONVERSATIONAL COMPUTER CONTROL/);assert.match(helper.desktopChatInstructionsFor(options),/umayComputerTask/);assert.doesNotMatch(helper.deviceContext(options),/UMAY CONVERSATIONAL COMPUTER CONTROL/);
});
