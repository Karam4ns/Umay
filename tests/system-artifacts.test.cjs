const {test}=require('node:test'),assert=require('node:assert/strict'),{systemArtifacts}=require('../src/system-artifacts.cjs');
test('task artifacts keep actual paths/jobs/apps but exclude file bodies, command arguments and output',()=>{
 const value={result:{path:'C:\\Users\\Test\\rapor.txt',type:'file',version:'v1',content:'password=private',stdout:'secret',args:[{path:'C:\\secret.txt'}],job:{jobId:'job',state:'exited',exitCode:0},app:{appId:'id',name:'Example',launched:true}},receipt:{completed:[{path:'C:\\Users\\Test\\rapor.txt',effect:'copied-file'}]}};
 const artifacts=systemArtifacts(value);assert.ok(artifacts.some(a=>a.path?.endsWith('rapor.txt')));assert.ok(artifacts.some(a=>a.kind==='process'));assert.ok(artifacts.some(a=>a.kind==='application'));assert.doesNotMatch(JSON.stringify(artifacts),/private|secret|password/);
});
