'use strict';
const {safeUrl}=require('./browser-mcp.cjs');
const appIsUmay=title=>/^Umay(?: bilgisayar görevi)?$/i.test(title||'');
const followUp=request=>/(?:^|[^\p{L}\p{N}])\d+[.)]?\s*(?:sonuc|sonuç|sıradaki)|üçünc|ikinci|birinci|sıradaki|sonraki|önceki|bunu|şunu|orada|burada|devam|tam ekran|küçült|alta (?:al|koy)|kapat|kaydır|scroll|ara(?:t|ma)?\b/iu.test(request);
class WorkspaceContext{
 constructor({session,readForeground,readTarget,readBrowser=async()=>null,capture,analyze,now=()=>Date.now(),schedule=setInterval,cancelSchedule=clearInterval,publish=()=>{},isBusy=()=>false,isSensitive=()=>false}={}){Object.assign(this,{session,readForeground,readTarget,readBrowser,capture,analyze,now,schedule,cancelSchedule,publish,isBusy,isSensitive});this.epoch=0;this.settings={enabled:false,intervalMs:300000,excludedApps:[]};this.target=null;}
 activate(account){this.stop();this.account=account;this.target=null;this.summary=null;this.lastError=null;}
 configure(input={}){if(input.intervalMs!==undefined&&input.intervalMs!==300000)throw Error('Gözlem aralığı 5 dakikadır.');this.settings={enabled:!!input.enabled,intervalMs:300000,excludedApps:(input.excludedApps||[]).filter(v=>typeof v==='string').slice(0,30)};if(this.timer)this.cancelSchedule(this.timer);this.timer=null;if(this.account&&this.settings.enabled){this.timer=this.schedule(()=>{void this.refresh({reason:'timer'}).catch(()=>{});},300000);this.timer?.unref?.();}return this.state();}
 state(){return structuredClone({enabled:this.settings.enabled,intervalMs:300000,target:this.target,summary:this.summary,lastError:this.lastError});}
 rememberForeground(view){
  if(!this.account||!Number.isSafeInteger(view?.handle)||view.handle<=0||!Number.isInteger(view.processId)||view.processId<=0||view.isForeground===false||view.requiresElevation||view.browser||view.system||appIsUmay(view.title)||this.isSensitive(view)||this.settings.excludedApps.some(name=>String(view.title).toLowerCase().includes(name.toLowerCase())))return false;
  // This is only a reference for the next command's fresh PID/profile check.
  // A native focus receipt does not carry reusable element IDs or authority.
  this.target={handle:view.handle,processId:view.processId,title:String(view.title||'').slice(0,240),executor:/ - (?:Google )?Chrome$/i.test(view.title||'')?'browser':'desktop',observedAt:this.now()};return true;
 }
 stop(){this.epoch++;this.controller?.abort();this.controller=null;if(this.timer)this.cancelSchedule(this.timer);this.timer=null;this.flight=null;}
 async refresh({reason='command',signal,inspect=false}={}){
  if(!this.account)return {skipped:true};if(reason==='timer'&&(this.isBusy()||this.isSensitive()))return {skipped:true};
  if(this.flight){if(reason==='timer')return {skipped:true};this.controller?.abort();}
  const priorTarget=this.target;if(reason!=='timer')this.target=null;
  const epoch=this.epoch,account=this.account,controller=new AbortController();this.controller=controller;const check=()=>{if(epoch!==this.epoch||account!==this.account||controller.signal.aborted||signal?.aborted)throw Error('Çalışma bağlamı yenilemesi iptal edildi.');};
  const promise=(async()=>{try{let view=await this.readForeground({signal:controller.signal,reason});check();if(!view||view.requiresElevation||this.isSensitive(view)||this.settings.excludedApps.some(name=>String(view.title).toLowerCase().includes(name.toLowerCase())))return {skipped:true};
    if(appIsUmay(view.title)){if(reason==='timer')return {skipped:true};const prior=priorTarget,actual=(view.windows||[]).find(w=>w.handle===prior?.handle&&(!prior.processId||w.processId===prior.processId));if(actual)view={...actual,windows:view.windows,elements:[]};else return {skipped:true,needsTarget:true};}
    if(!view.handle||!view.processId)return {skipped:true};
    if(inspect&&this.readTarget){const detail=await this.readTarget({handle:view.handle,processId:view.processId,signal:controller.signal});check();if(!detail||detail.handle!==view.handle||detail.processId!==view.processId||detail.requiresElevation||this.isSensitive(detail))return {skipped:true};view={...detail,windows:view.windows};}
    const browser=await this.readBrowser({view,reason,passive:true,signal:controller.signal});check();
    const target={handle:view.handle,processId:view.processId,title:String(view.title||'').slice(0,240),executor:/ - (?:Google )?Chrome$/i.test(view.title||'')?'browser':'desktop',observedAt:this.now()};
    if(target.executor==='browser'&&browser?.connected){target.browser={profileKey:browser.profileKey,profileTrusted:!!browser.profileTrusted,pageId:browser.pageId,pages:(browser.pages||[]).slice(0,12).map(p=>({id:p.id,url:safeUrl(p.url),selected:!!p.selected})),summary:String(browser.snapshot||'').replace(/uid=\S+\s*/g,'').slice(0,2800),observedAt:browser.observedAt||this.now()};}
    this.target=target;this.session?.observe(view);this.lastError=null;if(reason==='timer'||inspect)this.summary={targetHandle:target.handle,targetProcessId:target.processId,text:[target.title,...(view.elements||[]).filter(e=>e.type!=='ControlType.Edit'&&!e.isPassword).slice(0,18).map(e=>String(e.name||'').slice(0,100))].filter(Boolean).join(' · ').slice(0,1000),observedAt:this.now(),usage:'Salt okunur çalışma ekranı; yeni görev veya izin değildir.'};
    if(reason==='timer'&&this.capture&&this.analyze&&!this.isSensitive(view)){const image=await this.capture(view,controller.signal);check();if(image){const summary=await this.analyze({image,target,signal:controller.signal});check();this.summary={targetHandle:target.handle,targetProcessId:target.processId,text:String(summary||'').slice(0,700),observedAt:this.now(),usage:'Salt okunur gözlem özeti; yeni görev, gerçek veya izin değildir.'};}}
    check();this.publish({event:'workspace-context',state:this.state()});return this.state();
   }catch(e){if(epoch!==this.epoch||controller.signal.aborted)return {skipped:true};this.lastError='Çalışma ekranı okunamadı; sonraki komutta tekrar doğrulanacak.';return {skipped:true,error:this.lastError};}})();
  this.flight=promise;try{return await promise;}finally{if(this.flight===promise)this.flight=null;}
 }
 resolve(request){const target=this.target;if(!target||this.now()-target.observedAt>90000)return {needsTarget:true};if(target.executor==='browser'&&!target.browser)return {executor:'browser',target:structuredClone(target),reference:followUp(request),needsTarget:true,reason:'Etkin Chrome penceresi seçili Umay profiliyle eşleşmiyor. Ayarlar → Modeller bölümünde doğru profili seç veya mevcut Chrome bağlantısını aç.'};return {executor:target.executor,target:structuredClone(target),summary:this.summary?.targetHandle===target.handle&&this.summary?.targetProcessId===target.processId?this.summary:null,freshness:'read-only-current',reference:followUp(request),needsTarget:false};}
}
module.exports={WorkspaceContext,followUp};
