'use strict';
const fs=require('node:fs');
const path=require('node:path');

async function main(){
 const certificate=process.env.WIN_CSC_LINK||process.env.CSC_LINK;
 const thumbprint=process.env.UMAY_CERT_SHA1;
 if(!certificate&&!thumbprint)throw Error('Kod imzalama sertifikası gerekli: CSC_LINK veya UMAY_CERT_SHA1 tanımlayın.');
 if(certificate&&thumbprint)throw Error('Tek bir imzalama yöntemi seçin.');
 if(certificate&&!fs.existsSync(certificate))throw Error('CSC_LINK mevcut yerel PFX/P12 dosyasını göstermeli.');
 if(thumbprint&&!/^[a-f\d]{40}$/i.test(thumbprint))throw Error('Sertifika parmak izi 40 onaltılık karakter olmalı.');
 if(process.argv.includes('--check-only')){console.log('İmzalama girdileri mevcut; sertifika geçerliliği derlemede doğrulanacak.');return;}
 if(process.platform!=='win32')throw Error('Bu imzalama komutu Windows içindir.');
 const {build,Platform}=require('electron-builder');
 await build({targets:Platform.WINDOWS.createTarget('nsis'),publish:'never',
  config:{forceCodeSigning:true,win:{signtoolOptions:{
   signingHashAlgorithms:['sha256'],
   rfc3161TimeStampServer:'http://timestamp.digicert.com',
   ...(thumbprint?{certificateSha1:thumbprint}:{})
  }}}
 });
 // Validate the installer, not merely whether the build command exited successfully.
 const {spawnSync}=require('node:child_process');
 const file=path.resolve('dist',`Umay Setup ${require('../package.json').version}.exe`);
 const check=spawnSync('powershell',['-NoProfile','-NonInteractive','-Command',
  '$s=Get-AuthenticodeSignature -LiteralPath $env:UMAY_VERIFY_FILE; if($s.Status -ne "Valid"){exit 1}'],
  {env:{...process.env,UMAY_VERIFY_FILE:file},encoding:'utf8',windowsHide:true});
 if(check.status!==0)throw Error('Installer Authenticode doğrulaması geçmedi; paket yayımlanmadı.');
 console.log('İmzalı installer üretildi ve Windows tarafından doğrulandı.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
