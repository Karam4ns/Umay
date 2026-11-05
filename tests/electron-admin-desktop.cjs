// Interactive, opt-in integration test. Requires the user's actual UAC consent.
// Creates its own temporary elevated WinForms window; closes it with the helper.
const {app,screen,desktopCapturer}=require('electron'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {DesktopAccess,createElevationTransport,launchAdministrator}=require('../src/desktop-access.cjs'),{ComputerControl}=require('../src/computer-control.cjs');
let access,control;const timeout=setTimeout(()=>{console.error('FAIL administrator test timed out');access?.close();app.exit(1);},160000);
app.whenReady().then(async()=>{
 try{
  const form=`Add-Type -AssemblyName System.Windows.Forms;$form=New-Object Windows.Forms.Form;$form.Text='Umay elevated disposable fixture';$form.Width=540;$form.Height=240;$form.TopMost=$true;$edit=New-Object Windows.Forms.TextBox;$edit.AccessibleName='Umay elevated test editor';$edit.Multiline=$true;$edit.Width=460;$edit.Height=120;$edit.Left=20;$edit.Top=20;$form.Controls.Add($edit);$form.Add_Shown({$form.Activate();$edit.Focus()});[Windows.Forms.Application]::Run($form)`;
  access=new DesktopAccess({transportFactory:()=>createElevationTransport({launch:({encodedCommand,...input})=>{
   const original=Buffer.from(encodedCommand,'base64').toString('utf16le');
   const withFixture="$fixture=Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -WindowStyle Hidden -ArgumentList @('-NoLogo','-NoProfile','-STA','-EncodedCommand','"+Buffer.from(form,'utf16le').toString('base64')+"') -PassThru;try{\n"+original+"\n}finally{if($fixture -and -not $fixture.HasExited){Stop-Process -Id $fixture.Id -Force -ErrorAction SilentlyContinue}}";
   const command=Buffer.from(withFixture,'utf16le').toString('base64');assert.ok(command.length<30000,'Windows command line limit');return launchAdministrator({...input,encodedCommand:command});
  }})});
  const normal=await access.normal.request('privileges');console.log('CLIENT_ALREADY_ADMINISTRATOR='+normal.administrator);
  console.log(normal.administrator?'Existing administrator authorization; Windows may not show UAC again.':'WAITING genuine Windows UAC: approve only the Umay PowerShell test helper');
  await access.elevate();const elevated=await access.request('privileges');assert.equal(elevated.administrator,true);
  let observed;const end=Date.now()+10000;while(Date.now()<end){observed=await access.request('observe');const target=observed.windows.find(w=>w.title==='Umay elevated disposable fixture');if(target){await access.request('focus',{handle:target.handle,expectedHandle:observed.handle});break;}await new Promise(r=>setTimeout(r,100));}
  const blocked=await access.normal.request('observe');assert.equal(blocked.requiresElevation,!normal.administrator,'Worker detects whether this target needs additional elevation');
  control=new ComputerControl({native:access,screen,capture:async()=>{const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:1200,height:800}});return sources.map(s=>({displayId:s.display_id,width:s.thumbnail.getSize().width,height:s.thumbnail.getSize().height,image:s.thumbnail.toDataURL()}));}});control.enable(true);
  observed=await control.observe();assert.equal(observed.title,'Umay elevated disposable fixture');const edit=observed.elements.find(e=>e.name==='Umay elevated test editor');assert.ok(edit,'Administrator UIA can read the elevated editor');
  await control.perform({action:'click',elementId:edit.id},observed.id);observed=await control.observe();await control.perform({action:'type',text:'Umay yönetici erişimi ığüşöç doğrulandı.'},observed.id);
  observed=await control.observe();assert.ok(observed.elements.some(e=>e.value==='Umay yönetici erişimi ığüşöç doğrulandı.'));
  await access.cancel();assert.equal(access.state().administrator,false);
  let alive=true;for(let i=0;i<30;i++){const check=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`[bool](Get-Process -Id ${Number(elevated.pid)} -ErrorAction SilentlyContinue)`],{encoding:'utf8',windowsHide:true});alive=check.trim()==='True';if(!alive)break;await new Promise(r=>setTimeout(r,100));}assert.equal(alive,false,'Elevated helper terminates after its session ends');
  console.log('PASS Windows administrator helper, target-token detection, elevated UI Automation/SendInput Unicode, privilege revocation and helper exit; see CLIENT_ALREADY_ADMINISTRATOR for UAC applicability');
  access.close();clearTimeout(timeout);app.quit();
 }catch(error){console.error(error.code||'',error.message);access?.close();clearTimeout(timeout);app.exit(1);}
});
