const {test}=require('node:test'),assert=require('node:assert/strict');
const {standaloneNavigation,landingVerified,preferDesktopText}=require('../src/control-performance.cjs');
test('only explicit standalone landing-page commands qualify for local navigation',()=>{
 for(const request of ['chrome kullanarak netflix açar mısın','Umay https://example.org adresini aç','Lütfen example.org sitesine git','Yalnızca Umay için açılan Chrome profilinde https://www.netflix.com adresini aç. Diğer pencerelere dokunma.'])assert.ok(standaloneNavigation(request),request);
 for(const request of ['Netflix nasıl açılır?','Netflix açma','"netflix aç" cümlesini çevir','netflix aç ve giriş yap','example.org aç ve dosyayı sil','https://example.org/?action=delete adresini aç','https://example.org/logout adresini aç','https://a.org ve https://b.org aç','yeni sekmede netflix aç','Netflix açmamı ister misin?','netflix açabilir miyim?','netflix aç, ardından videoyu oynat'])assert.equal(standaloneNavigation(request),null,request);
});
test('landing proof needs a real title and the requested host, never an unrelated redirect or error page',()=>{
 const view=url=>({browser:{pageId:1,pages:[{id:1,url}],snapshot:'uid=1_0 RootWebArea "Netflix Türkiye"'}});
 assert.ok(landingVerified(view('https://www.netflix.com/tr/'),'https://netflix.com/'));assert.equal(landingVerified(view('https://example.org/'),'https://netflix.com/'),false);assert.equal(landingVerified(view('https://netflix.com.evil.test/'),'https://netflix.com/'),false);
 const error=view('https://netflix.com/');error.browser.snapshot='uid=1_0 RootWebArea "This site can’t be reached"';assert.equal(landingVerified(error,'https://netflix.com/'),false);
});
test('text-first desktop requires usable accessibility controls and keeps graphical requests visual',()=>{
 const view={elements:['Button','Edit','MenuItem'].map(type=>({name:'Named control',type:'ControlType.'+type}))};assert.ok(preferDesktopText('Ayarlar uygulamasında ilerle',view));assert.equal(preferDesktopText('Oyunda ilerle',view),false);assert.equal(preferDesktopText('Ekrana bak',view),false);assert.equal(preferDesktopText('Ayarları aç',{elements:[]}),false);
});
