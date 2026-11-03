// Safe live checks: no account credentials and no valid grant/session is created.
const assert=require('node:assert/strict');
const origin='https://veriussu.com';
const p={redirectUri:'http://127.0.0.1:34567/umay-auth/callback',state:'s'.repeat(43),challenge:'c'.repeat(43)};
async function request(path,status,body,siteOrigin=origin){
 const result=await fetch(origin+path,{method:body?'POST':'GET',headers:{'Origin':siteOrigin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000),redirect:'manual'});
 assert.equal(result.status,status,path);console.log('PASS',status,path.split('?')[0]);return result;
}
(async()=>{
 const page=await request('/site/desktop-auth/authorize?'+new URLSearchParams(p),200);
 assert.ok((await page.text()).includes('Hesabımı Umay'));
 assert.ok(page.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
 await request('/site/desktop-auth/authorize?'+new URLSearchParams({...p,redirectUri:'https://invalid.example/callback'}),400);
 await request('/site/desktop-auth/authorize',401,p);
 await request('/site/desktop-auth/authorize',400,p,'https://invalid.example');
 await request('/site/desktop-auth/exchange',401,{code:'invalid',verifier:'v'.repeat(43),redirectUri:p.redirectUri});
 await request('/site/desktop-auth/logout',200);
 await request('/site/desktop-auth/logout',403,{},'https://invalid.example');
 await request('/site/auth/me',401);
 const js=await request('/site/desktop-auth/client.js',200);new Function(await js.text());
})().catch(error=>{console.error(error.message);process.exitCode=1;});
