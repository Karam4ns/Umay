import {Body,Controller,Get,Post,Query,Req,Res,BadRequestException,UnauthorizedException} from '@nestjs/common';
import {RouteConfig} from '@nestjs/platform-fastify';
import {createHash,randomBytes} from 'node:crypto';
import type {FastifyRequest,FastifyReply} from 'fastify';
import {Database} from './database';
import {WebAuthController} from './web-auth.controller';
import {encryptServerKey,decryptServerKey} from './server-secret';
import {requestOriginAllowed} from './network-access';
import * as policy from './desktop-auth-policy';
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const entities:Record<string,string>={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>entities[c]!);
function page(reply:FastifyReply,body:string){
 reply.header('Cache-Control','no-store').header('Referrer-Policy','no-referrer');
 reply.header('Content-Security-Policy',"default-src 'none'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
 return reply.type('text/html; charset=utf-8').send(`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Umay · Veriüssü</title><main><h1>Umay · Veriüssü</h1>${body}<p id="status" role="status"></p></main><script src="/site/desktop-auth/client.js"></script></html>`);
}
@Controller('site/desktop-auth')
export class DesktopAuthController {
 constructor(private readonly db:Database,private readonly auth:WebAuthController){}
 @Get('client.js')
 client(@Res() reply:FastifyReply){return reply.header('Cache-Control','no-store').type('text/javascript; charset=utf-8').send(`document.querySelector('form')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const button=form.querySelector('button');button.disabled=true;try{const r=await fetch(form.action,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});if(!r.ok)throw Error('İşlem tamamlanamadı. Giriş yaptıktan sonra yeniden deneyin.');const data=await r.json();if(data.redirectUrl){const target=new URL(data.redirectUrl);if(target.protocol!=='http:'||target.hostname!=='127.0.0.1'||target.pathname!=='/umay-auth/callback')throw Error('Geçersiz dönüş.');location.assign(target.href);}else document.getElementById('status').textContent='Çıkış yapıldı. Bu sekmeyi kapatabilirsiniz.';}catch(e){document.getElementById('status').textContent=e.message;button.disabled=false;}});`);}
 @Get('authorize')
 async authorize(@Query() input:Record<string,string>,@Res() reply:FastifyReply){
  let p;try{p=policy.parameters(input);}catch{throw new BadRequestException('INVALID_AUTH_REQUEST');}
  const fields=Object.entries(p).map(([k,v])=>`<input type="hidden" name="${k}" value="${escape(String(v))}">`).join('');
  return page(reply,`<p>Veriüssü hesabınızı bu cihazdaki Umay uygulamasına bağlayın.</p><p><a href="/login" target="_blank" rel="noopener noreferrer">Giriş yap</a> · <a href="/register" target="_blank" rel="noopener noreferrer">Kayıt ol</a></p><p>Girişinizi tamamladıktan sonra bu sekmeye dönüp aşağıdaki düğmeye basın.</p><form method="post" action="/site/desktop-auth/authorize">${fields}<button type="submit">Hesabımı Umay’a bağla</button></form>`);
 }
 @Post('authorize')
 @RouteConfig({rateLimit:{max:15,timeWindow:60000}})
 async approve(@Body() input:Record<string,string>,@Req() req:FastifyRequest,@Res() reply:FastifyReply){
  if(!requestOriginAllowed(req,'frontend'))throw new BadRequestException('INVALID_ORIGIN');
  let p;try{p=policy.parameters(input);}catch{throw new BadRequestException('INVALID_AUTH_REQUEST');}
  const user=await this.auth.authorize(req);
  const id=randomBytes(32).toString('hex');
  // Existing session storage supplies atomic, expiring one-use redemption without a schema change.
  await this.db.connection.query("INSERT INTO web_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '90 seconds')",[digest(id),user.id]);
  const code=encryptServerKey('umay-desktop-grant',JSON.stringify({...p,id,user:user.id,expires:Date.now()+90000}));
  const callback=new URL(p.redirectUri);callback.searchParams.set('code',code);callback.searchParams.set('state',p.state);
  reply.header('Cache-Control','no-store').header('Referrer-Policy','no-referrer');
  return reply.send({redirectUrl:callback.toString()});
 }
 @Post('exchange')
 @RouteConfig({rateLimit:{max:30,timeWindow:60000}})
 async exchange(@Body() input:{code?:string;verifier?:string;redirectUri?:string},@Res() reply:FastifyReply){
  reply.header('Cache-Control','no-store');
  let grant;try{if(typeof input?.code!=='string'||input.code.length>4096)throw Error();grant=JSON.parse(decryptServerKey('umay-desktop-grant',input.code));policy.verify(grant,input);if(!/^[a-f0-9]{64}$/.test(grant.id))throw Error();}catch{throw new UnauthorizedException('INVALID_GRANT');}
  let issued:string|undefined,disconnected=false;
  reply.raw.once('close',()=>{if(!reply.raw.writableFinished){disconnected=true;if(issued)void this.db.connection.query('DELETE FROM web_sessions WHERE token_hash=$1',[issued]).catch(()=>{});}});
  const client=await this.db.connection.connect();
  try{
   if(disconnected||reply.raw.destroyed)throw new UnauthorizedException('LOGIN_CANCELLED');
   await client.query('BEGIN');
   const used=await client.query("DELETE FROM web_sessions s USING users u WHERE s.token_hash=$1 AND s.user_id=$2 AND s.expires_at>now() AND u.id=s.user_id AND u.active AND u.deleted_at IS NULL AND u.role_id IN(1,2) RETURNING s.user_id",[digest(grant.id),grant.user]);
   if(!used.rowCount)throw new UnauthorizedException('INVALID_GRANT');
   const token=randomBytes(32).toString('hex');
   const created=await client.query("INSERT INTO web_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days') RETURNING expires_at",[digest(token),grant.user]);
   issued=digest(token);await client.query('COMMIT');
   if(disconnected){await client.query('DELETE FROM web_sessions WHERE token_hash=$1',[issued]);throw new UnauthorizedException('LOGIN_CANCELLED');}
   return {sessionToken:token,expiresAt:new Date(created.rows[0].expires_at).getTime()};
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }
 @Get('logout')
 logoutPage(@Res() reply:FastifyReply){return page(reply,'<p>Umay uygulamasındaki oturum kapatıldı. Bu tarayıcıdaki Veriüssü oturumunu da kapatabilirsiniz.</p><form method="post" action="/site/desktop-auth/logout"><button type="submit">Veriüssü oturumundan çık</button></form>');}
 @Post('logout')
 async logout(@Req() req:FastifyRequest,@Res() reply:FastifyReply){await this.auth.logout(req,reply);return reply.send({ok:true});}
}
