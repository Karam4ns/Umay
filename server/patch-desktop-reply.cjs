'use strict';
// Narrow, fail-closed overlay on the deployed execution module. Website replies
// retain their existing processing; only an advertised desktop client opts in.
function patchDesktopReply(source,{worker=true}={}){
 const replace=(before,after)=>{if(source.split(before).length!==2)throw Error('Desktop reply anchor changed: '+before.slice(0,100));source=source.replace(before,after);};
 replace("''::text AS \"draftContent\",id,",`CASE WHEN media_options->>'desktopSpeechDraft'='true' AND status='RUNNING' AND phase='generating' THEN draft_content ELSE '' END AS "draftContent",user_message_id AS "userMessageId",assistant_message_id AS "assistantMessageId",id,`);
 if(!worker)return source;
 replace('const desktop_context_1 = require("./desktop-context");','const desktop_context_1 = require("./desktop-context");\nconst desktop_reply_1 = require("./desktop-reply.cjs");');
 // Planner observations already carry the task's scoped context. The existing
 // code discarded recall.context/clarification after paying for its DB search.
 replace('const memory = await this.memory.recall(run.user_id, run.conversation_id, run.user_message_id, messages, client);','const umayDirectTask = !isDesktop && !documentContext && !imageParts.length ? desktop_reply_1.directTask(run.media_options,messages.at(-1)?.content) : null;\n                const memory = isDesktop || umayDirectTask ? await desktop_reply_1.plannerMemory(client,run.user_id) : await this.memory.recall(run.user_id, run.conversation_id, run.user_message_id, messages, client);');
 replace('const knowledgeCatalog = !isDesktop && run.source', 'const knowledgeCatalog = !isDesktop && !umayDirectTask && run.source');
 replace('if (profileAcknowledgement) {\n                        trace.stages.push({',`if (umayDirectTask) {
                        trace.stages.push({stage:"desktop_direct_handoff",providerCalled:false,executed:false});
                        result={choices:[{message:{content:umayDirectTask}}],usage:{prompt_tokens:0,completion_tokens:0}};
                    }
                    else if (profileAcknowledgement) {
                        trace.stages.push({`);
 replace('const qualityInstructions = isDesktop || capabilitiesQuestion || socialQuestion',`if (!isDesktop && desktop_reply_1.fastRoute(run.media_options,messages.at(-1)?.content)) instructions = identityInstructions + "Route the actual user request using the Umay response contract. Preserve their entire authorized scope. Do not plan individual UI steps, research a site before opening it, or claim success. Ask only for genuinely missing user choices.";
                const qualityInstructions = isDesktop || desktop_reply_1.fastRoute(run.media_options,messages.at(-1)?.content) || capabilitiesQuestion || socialQuestion`);
 replace('+ desktop_context_1.desktopChatInstructionsFor(run.media_options) + memoryContext','+ (desktop_reply_1.performanceEnabled(run.media_options) ? "" : desktop_context_1.desktopChatInstructionsFor(run.media_options)) + memoryContext');
 replace('const documentContext = (0, desktop_context_1.deviceContext)(run.media_options) +\n                    codeResults', 'const umayDeviceContext = (0, desktop_context_1.deviceContext)(run.media_options);\n                const documentContext = codeResults');
 replace('const attachmentMessage = conversation.at(-1);',`const attachmentMessage = conversation.at(-1);
                if (umayDeviceContext && attachmentMessage) attachmentMessage.content = String(attachmentMessage.content) + umayDeviceContext;`);
 // Every planner turn already carries goal, original authority, prior steps,
 // feedback and the current observation. Older screenshots are stale evidence.
 replace('(0, chat_memory_1.fitHistory)(messages, Math.max(0, capacity -','(0, chat_memory_1.fitHistory)(isDesktop ? messages.slice(-1) : desktop_reply_1.enabled(run.media_options) ? messages.slice(-12) : messages, Math.max(0, capacity -');
 replace('let structuredAnswer = false, reasoningEnabled',`const umayConversation = desktop_reply_1.enabled(run.media_options);
                const umaySpeechDraft = umayConversation && socialQuestion && !memory.clarification && !knowledgePassages.length;
                if (umaySpeechDraft) await this.db.connection.query("UPDATE chat_runs SET media_options=media_options||'{\\"desktopSpeechDraft\\":true}'::jsonb WHERE id=$1", [run.id]);
                let desktopRepair = 0, desktopTools = true, draftWrite = Promise.resolve(), draftWrittenAt = 0;
                let structuredAnswer = false, reasoningEnabled`);
 replace('const publishDraft = (content) => {',`const publishDraft = (content) => {
                    if (umaySpeechDraft) {
                        const draft = desktop_reply_1.publicDraft(content);
                        if (draft && performance.now() - draftWrittenAt > 100) {
                            draftWrittenAt = performance.now();
                            draftWrite = draftWrite.then(() => this.db.connection.query("UPDATE chat_runs SET draft_content=$2 WHERE id=$1 AND status='RUNNING' AND phase='generating'", [run.id, draft])).catch(() => {});
                        }
                    }`);
 // Declarations are before inference/callback invocation; the callback closure
 // is only called after umayConversation/umaySpeechDraft initialize above.
 replace(': message),\n                        stream: streamingEnabled,',`: message).concat(umayConversation ? [{role:"system",content:desktop_reply_1.replyInstructions+(desktop_reply_1.browserEnabled(run.media_options)?"\\n"+desktop_reply_1.browserReplyInstructions:"")}] : []),
                        stream: streamingEnabled,`);
 replace('...(toolRecovery || textOnly ? { tool_choice: "none" } : {}),','...(toolRecovery || textOnly ? { tool_choice: "none" } : {}),\n                        ...(umayConversation && !socialQuestion && desktopTools ? desktop_reply_1.toolOptions : {}),');
 replace('if (knownOptions?.effort === "low")\n                    reasoningEffort = "low";',`if (knownOptions?.effort === "low")
                    reasoningEffort = "low";
                if ((isDesktop || umayConversation && !(0, chat_quality_1.needsConsistencyReview)(messages.at(-1)?.content ?? "")) && desktop_reply_1.noThoughtsAllowed(optionKey)) reasoningEffort = "none";`);
 replace('catch (error) {\n                            if (error instanceof chat_provider_1.ChatProviderError &&',`catch (error) {
                            if (isDesktop && error instanceof chat_provider_1.ChatProviderError && error.parameter === "response_format" && [400,422].includes(error.status) && desktop_reply_1.rejectPlannerFormat(optionKey)) {optionRetries++;continue;}
                            if (reasoningEffort === "none" && error instanceof chat_provider_1.ChatProviderError && error.message === "PROVIDER_REJECTED" && [400,422].includes(error.status)) {desktop_reply_1.rejectNoThoughts(optionKey);reasoningEffort="minimal";optionRetries++;continue;}
                            if (umayConversation && desktopTools && error instanceof chat_provider_1.ChatProviderError && ["tools","tool_choice"].includes(error.parameter || "")) {desktopTools=false;continue;}
                            if (error instanceof chat_provider_1.ChatProviderError &&`);
 // Some providers buffer an entire reasoning pass when json_object is forced.
 // Start with the explicit contract plus strict parsing; use schema mode only
 // for the single bounded repair, preserving native streaming on the fast path.
 replace('...(structuredAnswer\n                            ? { response_format:', '...((structuredAnswer || umayConversation && desktopRepair > 0)\n                            ? { response_format:');
 replace('max_tokens: responseBudget,','max_tokens: responseBudget,\n                        ...(isDesktop ? desktop_reply_1.plannerOptions(optionKey, messages.at(-1)?.content) : {}),');
 replace('// Clear previous tool/partial attempts before processing another round.','// Clear previous tool/partial attempts before processing another round.\n                    await draftWrite;');
 replace('const text = (isDesktop || desktop_context_1.desktopChatTask(message?.content, run.media_options)) ?', 'const text = (isDesktop || umayConversation || desktop_context_1.desktopChatTask(message?.content, run.media_options)) ?');
 replace('const message = result.choices?.[0]?.message;',`let message = result.choices?.[0]?.message;
                    const desktopTool = umayConversation ? desktop_reply_1.toolTask(message) : null;
                    if (desktopTool) {message={content:desktopTool};trace.stages.push({stage:"desktop_function_handoff",executed:false});}`);
 replace('answer = text;\n                    {',`if (umayConversation && !profileAcknowledgement && !memory.clarification && !desktop_context_1.desktopChatTask(text, run.media_options) && desktop_reply_1.publicReply(text) === null) {
                        if (desktopRepair++ >= 1) throw new chat_provider_1.ChatProviderError("INVALID_PROVIDER_RESPONSE");
                        conversation.push({role:"assistant",content:text},{role:"system",content:"Your reply violated the app response contract. No task was started. Return the correct JSON object; ordinary chat uses umayChatReply and actual device operations use umayComputerTask. Do not claim inability or completed work."});
                        continue;
                    }
                    answer = umayConversation ? (desktop_reply_1.publicReply(text) ?? text) : text;
                    {`);
 source=source.replaceAll('desktop_context_1.desktopChatTask(', 'desktop_reply_1.plannedTask(');
 source=source.replaceAll('desktop_context_1.computerInstructions', 'desktop_reply_1.plannerInstructions(desktop_context_1.computerInstructions, messages.at(-1)?.content)');
 return source;
}
module.exports={patchDesktopReply};
