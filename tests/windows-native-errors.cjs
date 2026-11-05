// Real PowerShell/C# protocol; SendInput is substituted at the OS boundary so
// rejection/partial-delivery tests produce no keyboard or mouse input.
const fs=require('node:fs'),{spawnSync}=require('node:child_process'),assert=require('node:assert/strict');
const original=fs.readFileSync('src/native-desktop.ps1','utf8');
function run(method,params,sendBody){
 const script=original.replace('[DllImport("user32.dll")] static extern uint SendInput(uint count,Input[] inputs,int size);','static int calls;static uint SendInput(uint count,Input[] inputs,int size){calls+=0;'+sendBody+'}');
 const requests=JSON.stringify({id:'fixture',method,params});
 const command="$reader=New-Object IO.StringReader('"+requests.replaceAll("'","''")+"');$writer=New-Object IO.StringWriter;& ([ScriptBlock]::Create([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('"+Buffer.from(script).toString('base64')+"')))) -RequestReader $reader -ResponseWriter $writer;[Console]::WriteLine($writer.ToString())";
 const file='.superpowers/native-error-fixture.ps1';fs.writeFileSync(file,'\ufeff'+command);
 let result;try{result=spawnSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',file],{encoding:'utf8',windowsHide:true,timeout:15000});}finally{fs.unlinkSync(file);}
 assert.equal(result.status,0,result.stderr);const lines=result.stdout.split(/\r?\n/).filter(line=>line.startsWith('{'));assert.equal(lines.length,1,result.stdout);return JSON.parse(lines[0]);
}
assert.equal(run('focus',{handle:0},'return count;').error,'NATIVE_WINDOW_UNAVAILABLE');
assert.equal(run('text',{text:'abc'},'return calls++==0?count:0;').error,'NATIVE_PARTIAL_INPUT');
assert.equal(run('text',{text:'a'},'return 1;').error,'NATIVE_PARTIAL_INPUT');
assert.equal(run('text',{text:'a'},'return 0;').error,'NATIVE_INPUT_DENIED');
assert.equal(run('text',{text:'\n'},'return calls++==0?count:0;').error,'NATIVE_PARTIAL_INPUT');
console.log('PASS actual PowerShell/C# protocol normalizes wrapped errors and marks first-chunk/first-pair/newline partial input; zero OS input generated');
