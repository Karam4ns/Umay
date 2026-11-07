'use strict';
// Checkpoints preserve references/receipts, never resume mutations at startup.
class TaskWorkspace{
 constructor({memory,now=()=>new Date().toISOString()}){Object.assign(this,{memory,now});}
 activate(){this.epoch=this.memory.epoch;this.memory.require().exec('CREATE TABLE IF NOT EXISTS task_checkpoints(id TEXT PRIMARY KEY,updated_at TEXT NOT NULL,payload TEXT NOT NULL)');}
 check(){this.memory.check(this.epoch);}
 checkpoint(task){this.check();if(!task?.id)return;const value={id:task.id,status:task.status,goal:task.goal,origin:task.origin?{conversationId:task.origin.conversationId,userRequest:task.origin.userRequest,anchorMessageId:task.origin.anchorMessageId}:null,target:task.activeTarget||null,steps:(task.steps||[]).slice(-24).map(s=>({action:s.action,toolName:s.toolName,outcome:s.outcome,summary:String(s.summary||'').slice(0,160)})),message:String(task.message||'').slice(0,500),restoredReadOnly:true};this.memory.require().prepare('INSERT INTO task_checkpoints VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at,payload=excluded.payload').run(task.id,this.now(),JSON.stringify(value));}
 list(){this.check();return this.memory.require().prepare('SELECT payload FROM task_checkpoints ORDER BY updated_at DESC LIMIT 20').all().map(r=>JSON.parse(r.payload));}
 restore(id){this.check();const row=this.memory.require().prepare('SELECT payload FROM task_checkpoints WHERE id=?').get(id);if(!row)throw Error('Görev kontrol noktası bulunamadı.');return {...JSON.parse(row.payload),status:'paused',requiresFreshObservation:true};}
 async pauseForNewTask(agent){this.check();const task=agent.task;if(!task||!['running','question','confirmation','permission','paused'].includes(task.status))return null;await agent.pause();this.check();if(task.stopUnconfirmed)throw Error('Önceki işlemin durduğu doğrulanamadı; yeni işe geçilmedi.');this.checkpoint(task);return this.restore(task.id);}
 finish(id,result){this.check();const task=this.restore(id);this.checkpoint({...task,status:result.status,message:result.message});}
}
module.exports={TaskWorkspace};
