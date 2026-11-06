'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {ProcessJobs}=require('../src/process-jobs.cjs');
const task={taskId:'task-a'};

test('jobs execute literal arguments without a shell and report real output/exit status',async t=>{
 const jobs=new ProcessJobs();t.after(()=>jobs.close());
 const job=await jobs.run({executable:process.execPath,args:['-e','process.stdout.write(process.argv[1]);process.stderr.write("err");process.exitCode=7','hello; $(echo bad) " Türkçe']},task);
 assert.ok(job.jobId);const done=await jobs.status(job.jobId,{...task,waitMs:5000});
 assert.equal(done.state,'exited');assert.equal(done.exitCode,7);assert.equal(done.stdout,'hello; $(echo bad) " Türkçe');assert.equal(done.stderr,'err');
});

test('jobs return while running, enforce task ownership, and stop only their owned child',async t=>{
 const jobs=new ProcessJobs();t.after(()=>jobs.close());
 const job=await jobs.run({executable:process.execPath,args:['-e','setInterval(()=>{},1000)']},task);
 assert.equal(job.state,'running');await assert.rejects(jobs.status(job.jobId,{taskId:'other'}),{code:'PROCESS_NOT_OWNED'});
 await assert.rejects(jobs.stop(job.jobId,{taskId:'other'}),{code:'PROCESS_NOT_OWNED'});
 const done=await jobs.stop(job.jobId,task);assert.equal(done.state,'cancelled');
 await assert.rejects(jobs.stop('external-pid-1',task),{code:'PROCESS_NOT_FOUND'});
});

test('abort and task cancellation stop owned work while leaving other tasks running',async t=>{
 const jobs=new ProcessJobs();t.after(()=>jobs.close());const abort=new AbortController();
 const one=await jobs.run({executable:process.execPath,args:['-e','setInterval(()=>{},1000)']},{...task,signal:abort.signal});
 const two=await jobs.run({executable:process.execPath,args:['-e','setInterval(()=>{},1000)']},{taskId:'task-b'});
 abort.abort();assert.equal((await jobs.status(one.jobId,{...task,waitMs:5000})).state,'cancelled');
 assert.equal((await jobs.status(two.jobId,{taskId:'task-b'})).state,'running');await jobs.cancelTask('task-b');
 assert.equal((await jobs.status(two.jobId,{taskId:'task-b'})).state,'cancelled');
});

test('output is bounded with readable offsets and reset cancels then forgets old jobs',async t=>{
 const jobs=new ProcessJobs({maxOutputChars:1024});t.after(()=>jobs.close());
 const job=await jobs.run({executable:process.execPath,args:['-e','process.stdout.write("a".repeat(10000)+"END")']},task);
 const done=await jobs.status(job.jobId,{...task,waitMs:5000,outputLimit:100});
 assert.ok(done.stdout.length<=100);assert.equal(done.stdoutTotal,10003);assert.ok(done.stdoutOffset>=8979);assert.equal(done.outputTruncated,true);
 const end=await jobs.status(job.jobId,{...task,stdoutOffset:9990,outputLimit:100});assert.equal(end.stdout,'aaaaaaaaaaEND');
 await jobs.reset();await assert.rejects(jobs.status(job.jobId,task),{code:'PROCESS_NOT_FOUND'});
});

test('invalid jobs and pre-cancelled tasks never spawn, and spawn errors retain OS codes',async t=>{
 const jobs=new ProcessJobs();t.after(()=>jobs.close());
 await assert.rejects(jobs.run({executable:process.execPath,args:'-e nope'},task),{code:'PLANNER_INVALID'});
 await assert.rejects(jobs.run({executable:process.execPath,args:[]},{}),{code:'PLANNER_INVALID'});
 const abort=new AbortController();abort.abort();await assert.rejects(jobs.run({executable:process.execPath,args:[]},{...task,signal:abort.signal}),{code:'ABORT_ERR'});
 await assert.rejects(jobs.run({executable:'umay-nonexistent-executable-591',args:[]},task),{code:'ENOENT'});
});

test('child jobs do not inherit Electron Node mode and permission errors are preserved',async t=>{
 const previous=process.env.ELECTRON_RUN_AS_NODE;process.env.ELECTRON_RUN_AS_NODE='1';
 t.after(()=>{if(previous===undefined)delete process.env.ELECTRON_RUN_AS_NODE;else process.env.ELECTRON_RUN_AS_NODE=previous;});
 const jobs=new ProcessJobs();t.after(()=>jobs.close());
 const job=await jobs.run({executable:process.execPath,args:['-e','process.stdout.write(String(process.env.ELECTRON_RUN_AS_NODE))']},task);
 assert.equal((await jobs.status(job.jobId,{...task,waitMs:5000})).stdout,'undefined');
 const denied=new ProcessJobs({spawn(){throw Object.assign(Error('denied'),{code:'EPERM'});}});t.after(()=>denied.close());
 await assert.rejects(denied.run({executable:'denied.exe'},task),{code:'EPERM'});
});

test('reset rejects new runs until owned jobs stop, then accepts and retains the next job',async t=>{
 const jobs=new ProcessJobs();t.after(()=>jobs.close());
 const previous=await jobs.run({executable:process.execPath,args:['-e','setInterval(()=>{},1000)']},task);
 const reset=jobs.reset();
 // The finite candidate also cleans itself up on the red path if reset loses
 // ownership of it. No unrelated process is used to exercise this race.
 const candidate=jobs.run({executable:process.execPath,args:['-e','setTimeout(()=>{},500)']},{taskId:'task-b'});
 await assert.rejects(candidate,{code:'PROCESS_RESETTING'});await reset;
 await assert.rejects(jobs.status(previous.jobId,task),{code:'PROCESS_NOT_FOUND'});
 const next=await jobs.run({executable:process.execPath,args:['-e','setInterval(()=>{},1000)']},{taskId:'task-b'});
 assert.equal((await jobs.status(next.jobId,{taskId:'task-b'})).state,'running');
 assert.equal((await jobs.stop(next.jobId,{taskId:'task-b'})).state,'cancelled');
});

test('overlapping resets drain the same owned work and close refuses all subsequent runs',async t=>{
 const jobs=new ProcessJobs();t.after(()=>jobs.close());
 await jobs.run({executable:process.execPath,args:['-e','setInterval(()=>{},1000)']},task);
 const first=jobs.reset(),second=jobs.reset();await Promise.all([first,second]);
 await jobs.close();await assert.rejects(jobs.run({executable:process.execPath},task),{code:'PROCESS_CLOSED'});
});
