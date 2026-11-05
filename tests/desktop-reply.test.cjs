const {test}=require('node:test'),assert=require('node:assert/strict');
// The same small module is loaded by the server overlay and the desktop tests.
const {replyInstructions,publicReply,publicDraft,toolOptions,toolTask}=require('../server/desktop-reply.cjs');
test('desktop replies have an explicit public answer or a task, never a claim-only handoff',()=>{
 assert.match(replyInstructions,/umayChatReply/);assert.match(replyInstructions,/umayComputerTask/);
 assert.equal(publicReply('{"umayChatReply":1,"answer":"Selam!"}'),'Selam!');
 assert.equal(publicReply('{"umayComputerTask":1,"goal":"Aç","acknowledgement":"Açıyorum."}'),null);
 assert.equal(publicReply('ordinary compatibility answer'),null);
});
test('a real desktop function call becomes a validated handoff while unknown or ambiguous calls never execute',()=>{
 assert.equal(toolOptions?.tools?.[0]?.function?.name,'umay_start_computer_task');
 const call={function:{name:'umay_start_computer_task',arguments:JSON.stringify({goal:'Bir uygulamayı aç',acknowledgement:'Açıyorum.'})}};
 assert.deepEqual(JSON.parse(toolTask({tool_calls:[call]})),{umayComputerTask:1,goal:'Bir uygulamayı aç',acknowledgement:'Açıyorum.'});
 assert.equal(toolTask({tool_calls:[call,call]}),null);assert.equal(toolTask({tool_calls:[{function:{name:'other',arguments:'{}'}}]}),null);assert.equal(toolTask({tool_calls:[{function:{name:'umay_start_computer_task',arguments:'{}'}}]}),null);
});
test('only the explicitly public JSON answer can be streamed; planner, reasoning and incomplete escape stay private',()=>{
 assert.equal(publicDraft('{"umayChatReply":1,"answer":"Selam, seni dinliyorum.'),'Selam, seni dinliyorum.');
 assert.equal(publicDraft('{"answer":"Selam, seni dinliyorum.'),'Selam, seni dinliyorum.');
 assert.equal(publicDraft('{"umayChatReply":1,"answer":"Birinci.\\nİkinci \\u015'),'Birinci.\nİkinci ');
 for(const value of ['<think>secret</think>{"umayChatReply":1,"answer":"x"}','{"umayComputerTask":1,"goal":"sil"}','{"umayChatReply":1,"answer":"<think>secret','{"umayChatReply":1,"answer":"Merhaba. \\'])assert.equal(publicDraft(value),value.endsWith(' \\')?'Merhaba. ':'');
});
