'use strict';
const http=require('node:http');
const {randomBytes,createHash,timingSafeEqual}=require('node:crypto');
const ORIGIN='https://veriussu.com';
class BrowserAuth {
 constructor({openExternal,exchange,discard=async()=>{},timeoutMs=300000}){this.openExternal=openExternal;this.exchange=exchange;this.discard=discard;this.timeoutMs=timeoutMs;this.generation=0;}
 cancel(){++this.generation;this.pending?.cancel();}
 async start({entry='login'}={}){
  if(!['login','register'].includes(entry))throw Error('Giriş seçimi geçersiz.');
  this.cancel();
  const generation=this.generation;
  const state=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
  const challenge=createHash('sha256').update(verifier).digest('base64url');
  let resolve,reject,finished=false,claimed=false,timer;
  const controller=new AbortController();
  const completion=new Promise((yes,no)=>{resolve=yes;reject=no;});completion.catch(()=>{});
  const close=()=>{clearTimeout(timer);server.close();server.closeAllConnections();if(this.pending===pending)this.pending=null;};
  const pending={cancel:()=>{if(finished)return;finished=true;controller.abort();close();reject(Error('Tarayıcı girişi iptal edildi.'));}};
  const reply=(res,code,text)=>{res.writeHead(code,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'"});res.end(text);};
  const server=http.createServer(async(req,res)=>{
   try{
    if(req.method!=='GET'||(req.url||'').length>8192)return reply(res,400,'Geçersiz dönüş.');
    const url=new URL(req.url,redirectUri);
    const incoming=url.searchParams.getAll('state');const codes=url.searchParams.getAll('code');
    if(req.headers.host!==new URL(redirectUri).host||url.pathname!=='/umay-auth/callback'||incoming.length!==1||codes.length!==1||!/^[A-Za-z0-9_-]{43}$/.test(incoming[0])||!timingSafeEqual(Buffer.from(incoming[0]),Buffer.from(state))||!codes[0]||codes[0].length>4096||claimed||finished)return reply(res,400,'Geçersiz veya süresi dolmuş giriş.');
    claimed=true;
    const result=await this.exchange({code:codes[0],verifier,redirectUri},controller.signal);
    if(finished){await this.discard(result).catch(()=>{});return;}
    finished=true;reply(res,200,'Giriş tamamlandı. Umay uygulamasına dönebilirsiniz.');
    // Let the success response flush before closing the loopback listener.
    res.once('finish',close);resolve(result);
   }catch{
    if(finished)return;finished=true;reply(res,400,'Giriş aktarılamadı. Umay üzerinden yeniden deneyin.');res.once('finish',close);reject(Error('Tarayıcı oturumu Umay’a aktarılamadı.'));
   }
  });
  server.on('error',()=>{if(!finished){finished=true;clearTimeout(timer);reject(Error('Yerel giriş dönüşü açılamadı.'));}});
  await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
  const redirectUri=`http://127.0.0.1:${server.address().port}/umay-auth/callback`;
  if(generation!==this.generation){pending.cancel();return {completion};}
  this.pending=pending;
  timer=setTimeout(pending.cancel,this.timeoutMs);timer.unref();
  const url=new URL('/site/desktop-auth/authorize',ORIGIN);url.search=new URLSearchParams({redirectUri,state,challenge}).toString();
  if(entry==='register')url.searchParams.set('entry','register');
  try{await this.openExternal(url.toString());}catch(e){pending.cancel();throw e;}
  return {completion};
 }
}
module.exports={BrowserAuth};
