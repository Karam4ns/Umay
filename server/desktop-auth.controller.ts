import {Body,Controller,Get,Post,Query,Req,Res,BadRequestException,UnauthorizedException} from '@nestjs/common';
import {RouteConfig} from '@nestjs/platform-fastify';
import {createHash,randomBytes} from 'node:crypto';
import type {FastifyRequest,FastifyReply} from 'fastify';
import {Database} from './database';
import {WebAuthController} from './web-auth.controller';
import {encryptServerKey,decryptServerKey} from './server-secret';
import {requestOriginAllowed} from './network-access';
import * as policy from './desktop-auth-policy';
import {renderDesktopAuthPage,desktopAuthStyles} from './desktop-auth-view';
import {desktopAuthScript} from './desktop-auth-client';
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const entities:Record<string,string>={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>entities[c]!);
function page(reply:FastifyReply,mode:'authorize'|'logout',fields=''){
 reply.header('Cache-Control','no-store').header('Referrer-Policy','no-referrer');
 reply.header('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
 return reply.type('text/html; charset=utf-8').send(renderDesktopAuthPage(mode,fields));
}
@Controller('site/desktop-auth')
export class DesktopAuthController {
 constructor(private readonly db:Database,private readonly auth:WebAuthController){}
 @Get('client.js')
 client(@Res() reply:FastifyReply){return reply.header('Cache-Control','no-store').type('text/javascript; charset=utf-8').send(desktopAuthScript);}
 @Get('style.css')
 styles(@Res() reply:FastifyReply){return reply.header('Cache-Control','no-store').type('text/css; charset=utf-8').send(desktopAuthStyles);}
 @Get('authorize')
 async authorize(@Query() input:Record<string,string>,@Res() reply:FastifyReply){
  let p;try{p=policy.parameters(input);}catch{throw new BadRequestException('INVALID_AUTH_REQUEST');}
  const fields=Object.entries(p).map(([k,v])=>`<input type="hidden" name="${k}" value="${escape(String(v))}">`).join('');
  return page(reply,'authorize',fields);
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
 async exchange(@Body() input:{code?:string;verifier?:string;redirectUri?:string},@Res({passthrough:true}) reply:FastifyReply){
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
 logoutPage(@Res() reply:FastifyReply){return page(reply,'logout');}
 @Post('logout')
 async logout(@Req() req:FastifyRequest,@Res() reply:FastifyReply){await this.auth.logout(req,reply);return reply.send({ok:true});}
}
