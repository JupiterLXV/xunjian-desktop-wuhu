const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {LicenseManager,verifyLicense,machineCode}=require('../../app/license.cjs');
test('T18: original license validates genuine fixture signature, rejects tampering, foreign machine and foreign key',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'xj-license-'));
 try{
  const {privateKey,publicKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048}),machine=machineCode('windows:12345678-1234-1234-1234-123456789abc');
  const payload=Buffer.from(JSON.stringify({version:1,product:'xunjian-desktop',type:'perpetual',machine,licenseId:'synthetic',holder:'Test',issuedAt:'2026-11-25T00:00:00Z'}));
  const text=JSON.stringify({format:'xunjian-license-v1',payload:payload.toString('base64url'),signature:crypto.sign('sha256',payload,privateKey).toString('base64url')});
  assert.equal(verifyLicense(text,publicKey,machine).holder,'Test');
  assert.throws(()=>verifyLicense(text,publicKey,'another-machine'),/另一台/);
  assert.throws(()=>verifyLicense(text,awaitableKey(),machine),/签名/);
  function awaitableKey(){return crypto.generateKeyPairSync('rsa',{modulusLength:2048}).publicKey;}
  assert.throws(()=>verifyLicense(text.replace('synthetic','changed'),publicKey,'other'));
  const envelope=JSON.parse(text);envelope.payload=Buffer.from(payload.toString().replace('Test','Edited')).toString('base64url');assert.throws(()=>verifyLicense(JSON.stringify(envelope),publicKey,machine),/签名/);
  const m=new LicenseManager(dir,publicKey,async()=>machine);await m.init();assert.throws(()=>m.requireActive());await m.activate(text);
  const after=new LicenseManager(dir,publicKey,async()=>machine);await after.init();assert.equal(after.status().active,true);
  const companyKey=await fs.readFile('app/license-public.pem','utf8');assert.throws(()=>verifyLicense(text,companyKey,machine),/签名/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
