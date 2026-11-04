const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');
const {renderDesktopAuthPage,desktopAuthStyles}=require('../server/desktop-auth-view.ts');
const {desktopAuthScript}=require('../server/desktop-auth-client.ts');

function browser(fetch,mode='authorize'){
 const nodes=new Map(),events={},calls=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,disabled:false,dataset:{},setAttribute(){},addEventListener(name,fn){this[name]=fn;}});return nodes.get(id);};
 const form=node('auth-form');form.dataset.mode=mode;form.action='https://veriussu.com/site/desktop-auth/'+mode;form.querySelector=()=>node('approve');
 const context=vm.createContext({URL,console,
  document:{getElementById:node,documentElement:{dataset:{}},addEventListener(name,fn){events[name]=fn;},visibilityState:'visible'},
  window:{addEventListener(name,fn){events[name]=fn;}},localStorage:{getItem:()=>null,setItem(){}},
  matchMedia:()=>({matches:false}),location:{assign:url=>calls.push({redirect:url})},
  FormData:class{*[Symbol.iterator](){yield ['state','saved-state'];yield ['challenge','saved-challenge'];yield ['redirectUri','http://127.0.0.1:34567/umay-auth/callback'];}},
  fetch:async(url,options)=>{calls.push({url,options});return fetch(url,options);}
 });
 vm.runInContext(desktopAuthScript,context);return {node,events,calls};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('registration entry offers registration as the primary browser action',()=>{
 const html=renderDesktopAuthPage('authorize','','register');assert.match(html,/<a class="primary" id="sign-in" href="\/register"/);assert.match(html,/Umay için hesap oluştur/);
});
test('account page uses external assets and responsive light/dark styling',()=>{
 const html=renderDesktopAuthPage('authorize','<input name="state" value="safe">');
 assert.match(html,/Umay ile devam et/);assert.match(html,/name="state" value="safe"/);
 assert.match(html,/href="\/site\/desktop-auth\/style.css"/);assert.match(html,/src="\/site\/desktop-auth\/client.js"/);
 assert.doesNotMatch(html,/<style|onclick=|<script>(?!<\/script>)/);
 assert.match(desktopAuthStyles,/prefers-color-scheme/);assert.match(desktopAuthStyles,/@media/);
});
test('signed in account is displayed as text and binding requires explicit submission',async()=>{
 const app=browser(async(_url,options)=>options?.method==='POST'?{ok:true,json:async()=>({redirectUrl:'http://127.0.0.1:34567/umay-auth/callback?code=test&state=saved-state'})}:{ok:true,json:async()=>({firstName:'<script>bad</script>',lastName:'Kullanıcı',email:'user@example.test'})});
 await flush();assert.equal(app.node('account-name').textContent,'<script>bad</script> Kullanıcı');
 assert.equal(app.node('account-email').textContent,'user@example.test');assert.equal(app.node('approve').disabled,false);
 assert.equal(app.calls.filter(c=>c.options?.method==='POST').length,0);
 await app.node('auth-form').submit({preventDefault(){}});
 const sent=app.calls.find(c=>c.options?.method==='POST');assert.equal(JSON.parse(sent.options.body).state,'saved-state');
 assert.equal(sent.options.credentials,'same-origin');assert.ok(app.calls.some(c=>c.redirect?.startsWith('http://127.0.0.1:34567/')));
});
test('signed out account shows login and keeps approval unavailable',async()=>{
 const app=browser(async()=>({ok:false,status:401}));await flush();
 assert.equal(app.node('sign-in').hidden,false);assert.equal(app.node('approve').hidden,true);
 assert.equal(app.node('approve').disabled,true);
});
test('binding rejects an unexpected callback target and offers a retry',async()=>{
 const app=browser(async(_url,options)=>options?.method==='POST'?{ok:true,json:async()=>({redirectUrl:'https://evil.example/callback'})}:{ok:true,json:async()=>({firstName:'Test',email:'user@example.test'})});
 await flush();await app.node('auth-form').submit({preventDefault(){}});
 assert.equal(app.calls.some(c=>c.redirect),false);assert.match(app.node('status').textContent,/dönüş/);assert.equal(app.node('approve').disabled,false);
});
test('account network failure is visible without enabling approval',async()=>{
 const app=browser(async()=>{throw Error('offline');});await flush();
 assert.match(app.node('status').textContent,/Hesap bilgisi/);assert.equal(app.node('approve').disabled,true);
});
test('a late account lookup cannot replace the account shown by a newer lookup',async()=>{
 let complete,requests=0;const earlier=new Promise(resolve=>complete=resolve);
 const app=browser(async()=>++requests===1?earlier:{ok:true,json:async()=>({firstName:'Yeni',email:'new@example.test'})});
 await app.events.focus();complete({ok:true,json:async()=>({firstName:'Eski',email:'old@example.test'})});await flush();
 assert.equal(app.node('account-email').textContent,'new@example.test');
});
test('browser logout submits explicitly and displays a finished state',async()=>{
 const app=browser(async(_url,options)=>options?.method==='POST'?{ok:true,json:async()=>({ok:true})}:{ok:true,json:async()=>({firstName:'Test',email:'user@example.test'})},'logout');
 await flush();assert.equal(app.calls.filter(c=>c.options?.method==='POST').length,0);
 await app.node('auth-form').submit({preventDefault(){}});
 assert.equal(app.node('title').textContent,'Çıkış tamamlandı');assert.equal(app.node('auth-form').hidden,true);
});
