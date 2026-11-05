const {test}=require('node:test'),assert=require('node:assert/strict');
const {computerCommand}=require('../src/ui/computer-commands.js');
test('hands-free control commands are local and app-independent',()=>{
 for(const text of ['dur','Umay dur!','lütfen durdur','bekle','İşlemi durdur'])assert.equal(computerCommand(text),'pause',text);
 for(const text of ['devam et','Umay devam et','kaldığın yerden devam et'])assert.equal(computerCommand(text),'resume',text);
 for(const text of ['iptal et','görevi iptal et','vazgeç'])assert.equal(computerCommand(text),'stop',text);
});
test('negation, quotations and ordinary task text are never control commands',()=>{
 for(const text of ['durma','bekleme devam et','dur dediğimde dur','"dur" yaz','dur kelimesi ne demek','siteyi aç','oyuna devam et','devam et düğmesine bas','Umay durma',''])assert.equal(computerCommand(text),null,text);
});
