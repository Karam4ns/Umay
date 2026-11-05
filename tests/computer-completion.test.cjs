const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {verifyComputerCompletion}=require('../src/computer-completion.cjs');
test('Desktop folder completion requires the actual requested directory, not a visible pending rename',async()=>{
 const desktop=fs.mkdtempSync(path.join(os.tmpdir(),'umay-completion-')),request='selam masaüstüne dosya adında yeni klasör oluştur';
 fs.mkdirSync(path.join(desktop,'Yeni klasör'));assert.equal((await verifyComputerCompletion(request,{desktop})).verified,false);
 fs.mkdirSync(path.join(desktop,'dosya'));assert.equal((await verifyComputerCompletion(request,{desktop})).verified,true);
});
test('completion checks do not create files, accept traversal, or confuse a file with a directory',async()=>{
 const desktop=fs.mkdtempSync(path.join(os.tmpdir(),'umay-completion-'));fs.writeFileSync(path.join(desktop,'dosya'),'fixture');
 assert.equal((await verifyComputerCompletion('Masaüstünde "dosya" adında bir klasör oluştur.',{desktop})).verified,false);
 assert.equal(await verifyComputerCompletion('Masaüstüne ../outside adında klasör oluştur',{desktop}),null);
 assert.equal(await verifyComputerCompletion('Not Defteri aç',{desktop}),null);assert.deepEqual(fs.readdirSync(desktop),['dosya']);
});
test('a creation clause inside a compound rename, move or delete task is not its final postcondition',async()=>{
 const desktop=fs.mkdtempSync(path.join(os.tmpdir(),'umay-completion-'));
 for(const suffix of [', sonra adını arşiv yap.',' ve Belgeler klasörüne taşı.','. Sonra bu klasörü sil.'])assert.equal(await verifyComputerCompletion('Masaüstüne dosya adında klasör oluştur'+suffix,{desktop}),null);
 assert.equal((await verifyComputerCompletion('Selam masaüstüne dosya adında yeni klasör oluştur. Yalnızca bu yeni klasörü oluştur; başka dosyaları değiştirme.',{desktop})).verified,false);
});
