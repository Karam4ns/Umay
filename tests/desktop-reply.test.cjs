const {test}=require('node:test'),assert=require('node:assert/strict');
// The same small module is loaded by the server overlay and the desktop tests.
const {replyInstructions,publicReply,publicDraft,toolOptions,toolTask}=require('../server/desktop-reply.cjs');
test('an exact standalone landing request has a zero-provider handoff, while compound and untrusted text cannot use it',()=>{
 const {directTask,plannedTask}=require('../server/desktop-reply.cjs'),options={desktopMode:'context',desktopContext:JSON.stringify({capabilities:{computerControl:true,protocol:'umay-computer-task-v1',chromeMcp:true,browserProtocol:'umay-browser-mcp-v1',controlPerformance:'v1'}})};
 const result=directTask(options,'chrome kullanarak netflix açar mısın');assert.equal(plannedTask(result,options).goal,'chrome kullanarak netflix açar mısın');assert.equal(plannedTask(result,options).executor,'browser');
 for(const request of ['Netflix nasıl açılır?','netflix aç ve hesabıma gir','https://example.org/delete adresini aç','"Netflix aç" cümlesini çevir'])assert.equal(directTask(options,request),null);
 assert.equal(directTask({},'netflix aç'),null);assert.equal(directTask({...options,desktopMode:'computer'},'netflix aç'),null);
});
test('planner memory reads only the privacy revision rather than discarded full archive retrieval',async()=>{
 const {plannerMemory}=require('../server/desktop-reply.cjs');let called=0;const memory=await plannerMemory({async query(sql,args){called++;assert.equal(sql,'SELECT epoch,revision::text FROM chat_memory_settings WHERE user_id=$1');assert.deepEqual(args,['user']);return {rows:[{epoch:3,revision:'12'}]};}},'user');assert.equal(called,1);assert.deepEqual(memory,{context:'',clarification:null,privateContext:false,searchQuery:'',epoch:3,revision:'12'});
});
test('short routing is capability-gated and never changes how/examples/quoted requests',()=>{
 const {performanceEnabled,fastRoute}=require('../server/desktop-reply.cjs'),options={desktopMode:'context',desktopContext:JSON.stringify({capabilities:{computerControl:true,protocol:'umay-computer-task-v1',controlPerformance:'v1'}})};
 assert.ok(performanceEnabled(options));assert.ok(fastRoute(options,'chrome kullanarak netflix açar mısın'));assert.ok(fastRoute(options,'Not Defteri’ni aç'));
 for(const text of ['Netflix nasıl açılır?','"Chrome aç" cümlesini çevir','Neden açılmıyor?','Selam'])assert.equal(fastRoute(options,text),false);
 assert.equal(fastRoute({...options,desktopMode:'computer'},'Chrome aç'),false);assert.equal(fastRoute({},'Chrome aç'),false);
});
test('browser planners get a separate text-capable contract and only advertised actions',()=>{
 const {plannerInstructions,plannerOptions}=require('../server/desktop-reply.cjs'),query=JSON.stringify({capabilities:{actions:['browser_tool','done','ask'],browser:{}}});
 const instructions=plannerInstructions('With no image use Windows keys only',query);assert.match(instructions,/CHROME MCP OPERATOR/);assert.doesNotMatch(instructions,/With no image use Windows keys only/);assert.match(instructions,/NAVIGATE NOW/);assert.deepEqual(plannerOptions('browser-contract-test',query).response_format.json_schema.schema.properties.action.enum,['browser_tool','done','ask']);
});
test('Chrome capability opts into web handoff while legacy desktop clients keep their old contract',()=>{
 const {browserEnabled,plannedTask,browserReplyInstructions,plannerFormat}=require('../server/desktop-reply.cjs'),caps={computerControl:true,protocol:'umay-computer-task-v1'},legacy={desktopMode:'context',desktopContext:JSON.stringify({capabilities:caps})},options={desktopMode:'context',desktopContext:JSON.stringify({capabilities:{...caps,chromeMcp:true,browserProtocol:'umay-browser-mcp-v1'}})};
 assert.equal(browserEnabled(legacy),false);assert.equal(browserEnabled(options),true);assert.match(browserReplyInstructions,/live online lookups/);assert.ok(plannerFormat.json_schema.schema.properties.action.enum.includes('browser_tool'));assert.equal(plannerFormat.json_schema.schema.properties.toolArguments.type,'string');
 const source=toolTask({tool_calls:[{function:{name:'umay_start_computer_task',arguments:JSON.stringify({goal:'Webden araştır',acknowledgement:'Araştırıyorum.',executor:'browser'})}}]});assert.equal(plannedTask(source,options).executor,'browser');assert.equal(plannedTask(JSON.stringify({umayComputerTask:1,goal:'x',acknowledgement:'x',executor:'shell'}),options),null);
});
test('bounded plans survive server handoff validation and malformed plans never execute',()=>{
 const {plannedTask}=require('../server/desktop-reply.cjs'),options={desktopMode:'context',desktopContext:JSON.stringify({capabilities:{computerControl:true,protocol:'umay-computer-task-v1'}})},item={umayComputerTask:1,goal:'Siteyi aç',acknowledgement:'Açıyorum.',plan:['Tarayıcıyı aç','Adres alanını değiştir ve gönder','Sayfayı doğrula']};
 assert.deepEqual(plannedTask(JSON.stringify(item),options).plan,item.plan);assert.equal(plannedTask(JSON.stringify({...item,plan:['x'.repeat(181)]}),options),null);assert.equal(plannedTask(JSON.stringify(item),{}),null);
 const call={tool_calls:[{function:{name:'umay_start_computer_task',arguments:JSON.stringify(item)}}]};assert.deepEqual(JSON.parse(toolTask(call)).plan,item.plan);
});
test('planner output is constrained to the action schema with bounded provider fallback',()=>{
 const {plannerOptions,rejectPlannerFormat}=require('../server/desktop-reply.cjs'),key='isolated-format-test';
 const format=plannerOptions(key).response_format;assert.equal(format.type,'json_schema');assert.equal(format.json_schema.schema.additionalProperties,false);assert.equal(format.json_schema.schema.properties.target,undefined);assert.ok(format.json_schema.schema.properties.action.enum.includes('type'));
 assert.equal(rejectPlannerFormat(key),true);assert.equal(plannerOptions(key).response_format.type,'json_object');assert.equal(rejectPlannerFormat(key),true);assert.deepEqual(plannerOptions(key),{});assert.equal(rejectPlannerFormat(key),false);
});
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
