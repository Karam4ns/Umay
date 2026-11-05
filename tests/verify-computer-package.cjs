const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),asar=require('@electron/asar');
const root=path.join(__dirname,'..'),resources=path.join(root,'dist/win-unpacked/resources'),archive=path.join(resources,'app.asar');
const hash=value=>createHash('sha256').update(value).digest('hex');
let count=0;
function verify(directory){for(const item of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,item.name);if(item.isDirectory())verify(file);else {const relative=path.relative(root,file);assert.equal(hash(asar.extractFile(archive,relative)),hash(fs.readFileSync(file)),relative+' package mismatch');count++;}}}
verify(path.join(root,'src'));
const metadata=JSON.parse(asar.extractFile(archive,'package.json'));assert.equal(metadata.version,require('../package.json').version);
assert.equal(hash(fs.readFileSync(path.join(resources,'app.asar.unpacked/src/native-desktop.ps1'))),hash(fs.readFileSync(path.join(root,'src/native-desktop.ps1'))));
for(const name of ['worker.py','voice_cloning.py','turkish_speech.py','live_stt.py'])assert.equal(hash(fs.readFileSync(path.join(resources,'speech',name))),hash(fs.readFileSync(path.join(root,'speech',name))));
console.log('PASS packaged '+metadata.version+': '+count+' application files, unpacked native helper and 4 speech modules match sources');
