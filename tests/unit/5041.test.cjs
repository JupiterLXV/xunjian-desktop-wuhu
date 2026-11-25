const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const core=require('../../app/wuhu-core.js'),blocks=require('../source-blocks.cjs'),{FileService}=require('../../app/fs-service.cjs');
test('50.4.1: reproduce the 50.4.0 empty display binding, retain virtual-tree algorithm, and restore real photo labels',async()=>{
 const old=require('../../docs/5040-parser-baseline.json'),next=await fs.readFile('app/renderer.js','utf8'),fake=()=>({line:'10kV测试线',branch:'主线',pole:'#001',valid:true});
 const oldParse=vm.runInNewContext('('+old.parseFunction+')',{sourceLocation62:fake});
 const nextParse=vm.runInNewContext('('+blocks(next).get('_rawParseFilePrefixAndLocation')+')',{sourceLocation62:fake});
 assert.equal(oldParse('DJI_0024_V.JPG','主线/#001/DJI_0024_V.JPG').loc,'');assert.equal(nextParse('DJI_0024_V.JPG','主线/#001/DJI_0024_V.JPG').loc,'DJI_0024_V');
 assert.equal(crypto.createHash('sha256').update(blocks(next).get('VirtualTree48')).digest('hex'),old.virtualTreeSha256);
});
test('50.4.1: a serialized old directory handle is refreshed from the granted filesystem path',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'xj-handle-'));
 try{const data=path.join(dir,'profile'),pole=path.join(dir,'10kV测试线','主线','#001');await fs.mkdir(pole,{recursive:true});const service=new FileService(data);await service.init();const h=await service.grant(pole);delete h.sourcePath;const restored=new FileService(data);await restored.init();const fresh=await restored.call('describe',{h});assert.equal(fresh.sourcePath,await fs.realpath(pole));assert.equal(core.parseLocation('DJI_0024.JPG',fresh.sourcePath).line,'10kV测试线');await service.cleanup();await restored.cleanup();}finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('50.4.1: arbitrary real branch names and full UNC paths do not depend on camera filenames',()=>{
 assert.deepEqual(core.parseLocation('\\\\NAS\\照片\\10kV测试线\\良久支线（北段）\\#001\\DJI_1.JPG','Z:/unrelated'),{line:'10kV测试线',branch:'良久支线（北段）',pole:'#001',valid:true});assert.deepEqual(core.OUTPUT_DIRS,['大图','小图','原图']);
});
test('50.4.1: ICO is a conversion of the original logo and window/installer identities agree',async()=>{
 const R=await import('resedit'),icons=R.Data.IconFile.from(await fs.readFile('app/icon.ico'));assert.deepEqual(icons.icons.map(i=>i.data.width),[16,24,32,48,64,128,256]);
 const p=require('../../package.json'),main=await fs.readFile('app/main.cjs','utf8');assert.equal(p.version,'50.4.4');assert.equal(p.build.appId,'local.xunjian.desktop');assert.equal(p.build.win.signExecutable,false);assert.notEqual(p.build.win.signAndEditExecutable,false);assert.equal(p.build.win.icon,p.build.nsis.installerIcon);assert.equal(p.build.win.icon,p.build.nsis.uninstallerIcon);assert.doesNotMatch(main,/win\.setAppDetails\(/);assert.match(main,/app\.setAppUserModelId\('local.xunjian.desktop'\)/);
});
