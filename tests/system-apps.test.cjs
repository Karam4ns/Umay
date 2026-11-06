'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {ApplicationTools,parseSearch}=require('../src/system-apps.cjs');
const task={taskId:'task-a'};
function fixture(){
 const calls=[],launched=[],events=[];
 const runner={platform:'win32',async run(executable,args,options){
  calls.push({executable,args,options});
  if(executable==='powershell.exe')return {stdout:JSON.stringify({startApps:[{Name:'Özgün Editor',AppID:'Vendor.Editor!Main'}],startMenu:[{name:'Terminal Z',path:'C:\\Start Menu\\Terminal Z.lnk'}],installed:[{name:'Installed Only',registryKey:'HKCU\\Software\\Test',version:'2.3',publisher:'Vendor',installLocation:'C:\\Vendor',launchPath:null}]}),exitCode:0};
  if(args[0]==='--version')return {stdout:'v1.12.0',exitCode:0};
  if(args[0]==='search')return {stdout:'Name          Id                 Version Source\n------------------------------------------------\nNew Editor    Vendor.NewEditor   1.2     winget\n',exitCode:0};
  throw Error('Unexpected external call');
 }};
 const apps=new ApplicationTools({runner,openPath:async target=>{launched.push(target);return '';},publish:event=>events.push(event)});
 return {apps,calls,launched,events,runner};
}
test('discovers generic Windows launch targets and stable ids, with bounded query pages',async t=>{
 const f=fixture();t.after(()=>f.apps.close());const list=await f.apps.perform('apps_list',{limit:2},task);
 assert.equal(list.total,3);assert.equal(list.apps.length,2);assert.equal(list.nextOffset,2);
 const found=await f.apps.perform('apps_list',{query:'özgün'},task);assert.equal(found.apps.length,1);
 assert.deepEqual(found.apps[0].launchTarget,{kind:'appId',value:'Vendor.Editor!Main'});
 const again=await f.apps.perform('apps_list',{query:'özgün',refresh:true},task);assert.equal(again.apps[0].id,found.apps[0].id);
 const defs=f.apps.definitions();assert.deepEqual(defs.map(d=>d.name).sort(),['apps_launch','apps_list','packages_install','packages_search','packages_uninstall','process_run','process_status','process_stop']);
 assert.ok(defs.every(d=>d.inputSchema.type==='object'));
});
test('launches only cached discovered targets and never executes registry uninstall commands',async t=>{
 const f=fixture();t.after(()=>f.apps.close());await assert.rejects(f.apps.perform('apps_launch',{appId:'C:\\evil.exe'},task),{code:'APP_NOT_FOUND'});
 const list=await f.apps.perform('apps_list',{},task),app=list.apps.find(a=>a.name==='Özgün Editor');
 const result=await f.apps.perform('apps_launch',{appId:app.id},task);assert.equal(result.launched,true);assert.deepEqual(f.launched,['shell:AppsFolder\\Vendor.Editor!Main']);
 const installed=list.apps.find(a=>a.name==='Installed Only');await assert.rejects(f.apps.perform('apps_launch',{appId:installed.id},task),{code:'APP_NOT_LAUNCHABLE'});
 await f.apps.reset();await assert.rejects(f.apps.perform('apps_launch',{appId:app.id},task),{code:'APP_NOT_FOUND'});assert.equal(f.launched.length,1);
});
test('winget search resolves ids and package jobs use exact id/source with literal argument arrays',async t=>{
 const f=fixture();t.after(()=>f.apps.close());const found=await f.apps.perform('packages_search',{query:'new',source:'winget'},task);
 assert.deepEqual(found.packages,[{name:'New Editor',id:'Vendor.NewEditor',version:'1.2',source:'winget'}]);
 let command;f.apps.jobs.run=async(spec,context)=>{command={spec,context};return {jobId:'owned-package-job',state:'running'};};
 const install=await f.apps.perform('packages_install',{packageId:'Vendor.NewEditor',source:'winget'},task);
 assert.equal(install.jobId,'owned-package-job');assert.equal(command.spec.executable,'winget.exe');
 assert.deepEqual(command.spec.args,['install','--id','Vendor.NewEditor','--exact','--source','winget','--disable-interactivity']);assert.equal(command.context.taskId,'task-a');
 await f.apps.perform('packages_uninstall',{packageId:'Vendor.NewEditor',source:'winget'},task);assert.equal(command.spec.args[0],'uninstall');
 await assert.rejects(f.apps.perform('packages_install',{packageId:'--override',source:'winget'},task),{code:'PLANNER_INVALID'});
 assert.ok(f.events.length>0);
});
test('missing winget, cancellation and Windows access errors are reported without false completion',async t=>{
 const f=fixture();t.after(()=>f.apps.close());f.runner.run=async()=>{throw Object.assign(Error('missing'),{code:'ENOENT'});};
 await assert.rejects(f.apps.perform('packages_search',{query:'thing'},task),{code:'WINGET_UNAVAILABLE'});
 f.runner.run=async()=>{throw Object.assign(Error('denied'),{code:'EACCES'});};
 await assert.rejects(f.apps.perform('apps_list',{},task),{code:'EACCES'});
 const abort=new AbortController();abort.abort();await assert.rejects(f.apps.perform('apps_list',{}, {...task,signal:abort.signal}),{code:'ABORT_ERR'});
});
test('process tools execute actual owned jobs and task cancellation stays separate from GUI launches',async t=>{
 const f=fixture();t.after(()=>f.apps.close());const job=await f.apps.perform('process_run',{executable:process.execPath,args:['-e','console.log("actual");setInterval(()=>{},1000)']},task);
 assert.equal(job.state,'running');await f.apps.cancelTask('task-a');const done=await f.apps.perform('process_status',{jobId:job.jobId,waitMs:5000},task);assert.equal(done.state,'cancelled');
});

test('task cancellation prevents a late discovery from reintroducing stale launch targets',async t=>{
 const f=fixture();t.after(()=>f.apps.close());let finish,started;
 const ready=new Promise(resolve=>started=resolve);f.runner.run=()=>{started();return new Promise(resolve=>finish=resolve);};
 const listing=f.apps.perform('apps_list',{},task);await ready;await f.apps.cancelTask(task.taskId);
 finish({exitCode:0,stdout:JSON.stringify({startApps:[{Name:'Late',AppID:'Late.Main'}]})});await assert.rejects(listing,{code:'ABORT_ERR'});
 await assert.rejects(f.apps.perform('apps_launch',{appId:'startapp:late'},task),{code:'APP_NOT_FOUND'});
});

test('WinGet output without a source never invents a source from its version or match column',()=>{
 const missing='Name          Id                 Version\n-----------------------------------------\nNew Editor    Vendor.NewEditor   1.2\n';
 assert.deepEqual(parseSearch(missing),{packages:[],parsed:false});
 assert.deepEqual(parseSearch(missing,'Private Repo'),{packages:[{name:'New Editor',id:'Vendor.NewEditor',version:'1.2',source:'Private Repo'}],parsed:true});
});

test('malformed discovery data fails explicitly and retains no fake application cache',async t=>{
 const f=fixture();t.after(()=>f.apps.close());f.runner.run=async()=>({exitCode:0,stdout:'null'});
 await assert.rejects(f.apps.perform('apps_list',{},task),{code:'APP_DISCOVERY_FAILED'});
});

test('closing ApplicationTools refuses discovery, launch, packages and direct OS methods without new side effects',async t=>{
 const f=fixture();t.after(()=>f.apps.close());
 const list=await f.apps.perform('apps_list',{},task),app=list.apps.find(app=>app.launchTarget);
 await f.apps.close();const calls=f.calls.length;
 for(const [name,args]of [['apps_list',{}],['apps_launch',{appId:app.id}],['packages_search',{query:'new'}],['packages_install',{packageId:'Vendor.NewEditor',source:'winget'}]]){
  await assert.rejects(f.apps.perform(name,args,task),{code:'APPLICATION_CLOSED'});
 }
 await assert.rejects(f.apps.discover(task),{code:'APPLICATION_CLOSED'});
 await assert.rejects(f.apps.run('powershell.exe',[],task),{code:'APPLICATION_CLOSED'});
 assert.equal(f.calls.length,calls);assert.deepEqual(f.launched,[]);
});

test('reset between the OS response and discovery cache commit cannot restore another account application ids',async t=>{
 const f=fixture();t.after(()=>f.apps.close());
 const list=await f.apps.perform('apps_list',{},task),app=list.apps.find(app=>app.launchTarget);
 let finish;f.runner.run=()=>new Promise(resolve=>finish=resolve);
 const listing=f.apps.perform('apps_list',{refresh:true},task);
 finish({exitCode:0,stdout:JSON.stringify({startApps:[{Name:'Özgün Editor',AppID:'Vendor.Editor!Main'}]})});
 // First resume run()'s await; reset then happens before discover() resumes.
 await Promise.resolve();const reset=f.apps.reset();await reset;
 await assert.rejects(listing,{code:'ABORT_ERR'});
 await assert.rejects(f.apps.perform('apps_launch',{appId:app.id},task),{code:'APP_NOT_FOUND'});
 assert.deepEqual(f.launched,[]);
});

test('ApplicationTools rejects new operations until reset has finished stopping its owned jobs',async t=>{
 const f=fixture();t.after(()=>f.apps.close());
 await f.apps.perform('process_run',{executable:process.execPath,args:['-e','setInterval(()=>{},1000)']},task);
 const reset=f.apps.reset();const calls=f.calls.length;
 await assert.rejects(f.apps.perform('apps_list',{},task),{code:'APPLICATION_RESETTING'});
 assert.equal(f.calls.length,calls);await reset;
 assert.equal((await f.apps.perform('apps_list',{},task)).total,3);
});
