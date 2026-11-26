const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {FileService}=require('../../app/fs-service.cjs');
test('Windows SMB UNC: Chinese paths, byte-exact three-file writes and snapshot enumeration',async t=>{
 if(process.platform!=='win32'||!process.env.XUNJIAN_TEST_UNC)return t.skip('Requires the Windows runner local SMB test share; actual company NAS remains unverified.');
 const root=path.join(process.env.XUNJIAN_TEST_UNC,'中文线路成果'),profile=await fs.mkdtemp(path.join(os.tmpdir(),'xj-unc-profile-'));await fs.mkdir(root,{recursive:true});
 const service=new FileService(profile);await service.init();const h=await service.grant(root),name='10kV测试线-主线-#088+2-绝缘子-脱落-危急.jpg';
 const jpeg=require('jpeg-js').encode({width:2,height:2,data:Buffer.alloc(16,255)},90).data;
 try{
  for(const dir of ['大图','小图','原图']){const d=await service.call('child',{h,name:dir,kind:'directory',create:true}),f=await service.call('child',{h:d,name,kind:'file',create:true}),id=await service.call('begin',{h:f});await service.call('chunk',{id,bytes:jpeg});await service.call('commit',{id});assert.deepEqual(await fs.readFile(await service.locate(f)),jpeg);}
  const snap=await service.call('snapshot',{h,mode:'output'});assert.equal(snap.rows.length,3);
 }finally{await service.cleanup();await fs.rm(root,{recursive:true,force:true});await fs.rm(profile,{recursive:true,force:true});}
});
