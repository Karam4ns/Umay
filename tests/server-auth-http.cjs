// Run against the API's compiled dependencies: node tests/server-auth-http.cjs /app/apps/api
// Uses a separate Nest/Fastify instance with an in-memory fake DB, never a real account.
const assert=require('node:assert/strict');
const path=require('node:path');
const {createRequire}=require('node:module');
const {createHash}=require('node:crypto');
const root=path.resolve(process.argv[2]||'.');const apiRequire=createRequire(path.join(root,'package.json'));
apiRequire('reflect-metadata');
const {Module}=apiRequire('@nestjs/common');
const {NestFactory}=apiRequire('@nestjs/core');
const {FastifyAdapter}=apiRequire('@nestjs/platform-fastify');
const {DesktopAuthController}=apiRequire('./dist/desktop-auth.controller');
const {Database}=apiRequire('./dist/database');const {WebAuthController}=apiRequire('./dist/web-auth.controller');
let grantHash,consumed=false;
const client={async query(sql,args){
 if(sql.startsWith('DELETE')){const valid=!consumed&&args[0]===grantHash;consumed=true;return {rowCount:valid?1:0};}
 if(sql.startsWith('INSERT'))return {rows:[{expires_at:new Date(Date.now()+604800000)}]};
 return {rows:[]};},release(){}};
const db={connection:{async query(_sql,args){grantHash=args[0];},async connect(){return client;}}};
class TestModule{}
Module({controllers:[DesktopAuthController],providers:[{provide:Database,useValue:db},{provide:WebAuthController,useValue:{authorize:async()=>({id:'00000000-0000-4000-8000-000000000001'})}}]})(TestModule);
const deadline=setTimeout(()=>{console.error('FAIL successful exchange did not send an HTTP response');process.exit(1);},5000);
(async()=>{
 const app=await NestFactory.create(TestModule,new FastifyAdapter(),{logger:false});
 await app.init();const server=app.getHttpAdapter().getInstance();await server.ready();
 const verifier='v'.repeat(43);const parameters={redirectUri:'http://127.0.0.1:34567/umay-auth/callback',state:'s'.repeat(43),challenge:createHash('sha256').update(verifier).digest('base64url')};
 const approval=await server.inject({method:'POST',url:'/site/desktop-auth/authorize',headers:{origin:process.env.FRONTEND_ORIGIN||'https://veriussu.com'},payload:parameters});
 assert.equal(approval.statusCode,201,approval.body);
 const code=new URL(approval.json().redirectUrl).searchParams.get('code');
 const payload={code,verifier,redirectUri:parameters.redirectUri};
 const response=await server.inject({method:'POST',url:'/site/desktop-auth/exchange',payload});
 assert.equal(response.statusCode,201,response.body);
 assert.match(response.json().sessionToken,/^[a-f0-9]{64}$/);
 assert.ok(response.json().expiresAt>Date.now());
 assert.equal(response.headers['cache-control'],'no-store');
 const replay=await server.inject({method:'POST',url:'/site/desktop-auth/exchange',payload});assert.equal(replay.statusCode,401);
 await app.close();clearTimeout(deadline);console.log('PASS Nest/Fastify HTTP authorization, successful exchange body and one-use replay');
})().catch(error=>{clearTimeout(deadline);console.error(error);process.exit(1);});
