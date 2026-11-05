// Narrow overlay on the deployed worker. Fail if any expected anchor drifts.
function patchChatDispatch(source){
 if(!source.includes('const desktop_context_1 = require("./desktop-context");'))return source;
 const replace=(before,after)=>{if(source.split(before).length!==2)throw Error('Chat dispatch anchor changed: '+before.slice(0,90));source=source.replace(before,after);};
 replace('content: instructions + qualityInstructions + memoryContext,','content: instructions + qualityInstructions + desktop_context_1.desktopChatInstructionsFor(run.media_options) + memoryContext,');
 replace('const text = isDesktop ?','const text = (isDesktop || desktop_context_1.desktopChatTask(message?.content, run.media_options)) ?');
 replace('const question = messages.at(-1)?.content ?? "";',`const question = messages.at(-1)?.content ?? "";
                const desktopChatTask = desktop_context_1.desktopChatTask(answer, run.media_options);
                const isChatDispatch = !!desktopChatTask;
                if (desktopChatTask) {
                    await this.db.connection.query("UPDATE chat_runs SET media_options=media_options||$2::jsonb WHERE id=$1", [run.id, JSON.stringify({desktopChatTask:{...desktopChatTask,userRequest:question}})]);
                    answer = desktopChatTask.acknowledgement;
                    trace.stages.push({stage:"desktop_chat_handoff",executed:false});
                }`);
 replace('if (!isDesktop &&\n                    !memory.clarification','if (!isDesktop && !isChatDispatch &&\n                    !memory.clarification');
 replace('const personalized = isDesktop ? answer :','const personalized = isDesktop || isChatDispatch ? answer :');
 replace('if (!isDesktop && [...answer.matchAll','if (!isDesktop && !isChatDispatch && [...answer.matchAll');
 replace('let validationError = qualityError ??','let validationError = isChatDispatch ? null : qualityError ??');
 replace('if (!isDesktop && !billingError && !memory.clarification)','if (!isDesktop && !isChatDispatch && !billingError && !memory.clarification)');
 replace('await finish.query("UPDATE chat_conversations SET updated_at=now() WHERE id=$1 AND user_id=$2", [run.conversation_id, run.user_id]);',`if (isChatDispatch && message?.id) await finish.query("UPDATE chat_runs SET media_options=jsonb_set(media_options,'{desktopChatTask,anchorMessageId}',to_jsonb($2::text)) WHERE id=$1", [run.id, message.id]);
                    await finish.query("UPDATE chat_conversations SET updated_at=now() WHERE id=$1 AND user_id=$2", [run.conversation_id, run.user_id]);`);
 return source;
}
module.exports={patchChatDispatch};
