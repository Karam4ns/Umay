const {test}=require('node:test'),assert=require('node:assert/strict'),{chooseWatch}=require('../src/ui/computer-commands.js');
const jobs=[{id:'one',goal:'Uzun kod derlemesi'},{id:'two',goal:'Video dönüştürme'}];
test('spoken ordinals and numbers select one exact pending job without app-name shortcuts',()=>{for(const text of ['ikinci','İKİNCİSİ','2.','iki'])assert.equal(chooseWatch(text,jobs).id,'two');assert.equal(chooseWatch('kod derlemesi',jobs).id,'one');});
test('ambiguous acknowledgements and out-of-range selections do not grant a task continuation',()=>{for(const text of ['tamam','evet','devam et','0','13','iş'])assert.equal(chooseWatch(text,jobs),null);assert.equal(chooseWatch('kod',[...jobs,{id:'three',goal:'Başka kod işi'}]),null);});
