const {test}=require('node:test'),assert=require('node:assert/strict');
const {isSocialTurn,screenContextRequested}=require('../src/conversation-context.cjs');
test('assistant wake name does not turn a standalone greeting into an old task continuation',()=>{
 for(const text of ['Umay Selam','selam Umay!','Umay, nasılsın?','Merhaba','Teşekkür ederim Umay'])assert.equal(isSocialTurn(text),true,text);
 for(const text of ['Selam, üçüncü sonucu aç','Umay Chrome profilimle aç','selam ifadesini yaz','"selam" kelimesini çevir','Umay, ekranımda ne var?','nasılsın ve raporu aç'])assert.equal(isSocialTurn(text),false,text);
 assert.equal(screenContextRequested('Umay, hangi ekrandayım?'),true);assert.equal(screenContextRequested('Ekranda hangi belge açık?'),true);assert.equal(screenContextRequested('Ekran kartı nasıl çalışır?'),false);
});
