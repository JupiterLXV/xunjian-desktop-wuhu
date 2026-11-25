// Isolated test host. Packaged files never include this directory or its ephemeral signing key.
const {app,BrowserWindow,ipcMain,protocol,net}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {FileService,normalizeError}=require('../../app/fs-service.cjs');
const {LicenseManager,machineCode}=require('../../app/license.cjs');
protocol.registerSchemesAsPrivileged([{scheme:'xunjian-file',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true,corsEnabled:true}}]);
app.setPath('userData',path.join(process.env.XUNJIAN_TEST_DIR,'profile'));
app.whenReady().then(async()=>{
 const dir=process.env.XUNJIAN_TEST_DIR,service=new FileService(path.join(dir,'data'));await service.init();
 const {publicKey,privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
 const machine=machineCode('test-only-isolated-fixture');
 const license=new LicenseManager(path.join(dir,'license'),publicKey,async()=>machine);await license.init();
 const payload=Buffer.from(JSON.stringify({version:1,product:'xunjian-desktop',type:'perpetual',licenseId:'fixture',holder:'Synthetic test',issuedAt:new Date().toISOString(),machine}));
 await license.activate(JSON.stringify({format:'xunjian-license-v1',payload:payload.toString('base64url'),signature:crypto.sign('sha256',payload,privateKey).toString('base64url')}));
 global.testService=service;
 global.testOutput=path.join(dir,'成果');
 global.testInput=path.join(dir,'原始照片');
 protocol.handle('xunjian-file',async request=>{
  try{license.requireActive();const u=new URL(request.url),rel=u.pathname.slice(1).split('/').map(decodeURIComponent).join('/');return net.fetch(pathToFileURL(await service.locate({root:u.hostname,rel})).href);}catch{return new Response('',{status:404});}
 });
 ipcMain.handle('desktop:request',async(_event,op,args={})=>{try{
  license.requireActive();let value;
  if(op==='defect-rules')value=JSON.parse(await fs.readFile(path.join(__dirname,'../../app/wuhu-rules.json'),'utf8'));
  else if(op==='pick')value=await service.grant(op&&args.id?.includes('output')?global.testOutput:global.testInput);
  else value=await service.call(op,args);
  return {ok:true,value};
 }catch(e){return {ok:false,error:normalizeError(e)};}});
 const win=new BrowserWindow({width:1440,height:960,show:true,webPreferences:{preload:path.join(__dirname,'../../app/preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 service.onFilesChanged=()=>{if(!win.isDestroyed())win.webContents.send('desktop:files-changed');};
 await win.loadFile(path.join(dir,'app/index.html'));
});
app.on('window-all-closed',()=>app.quit());
