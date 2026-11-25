// Isolated test host. Packaged files never include this directory.
const {app,BrowserWindow,ipcMain,protocol,net}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {FileService,normalizeError}=require('../../app/fs-service.cjs');
protocol.registerSchemesAsPrivileged([{scheme:'xunjian-file',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true,corsEnabled:true}}]);
app.setPath('userData',path.join(process.env.XUNJIAN_TEST_DIR,'profile'));
app.whenReady().then(async()=>{
 const dir=process.env.XUNJIAN_TEST_DIR,service=new FileService(path.join(dir,'data'));await service.init();
 global.testService=service;
 global.testOutput=path.join(dir,'成果');
 global.testInput=path.join(dir,'原始照片');
 protocol.handle('xunjian-file',async request=>{
  try{const u=new URL(request.url),rel=u.pathname.slice(1).split('/').map(decodeURIComponent).join('/');return net.fetch(pathToFileURL(await service.locate({root:u.hostname,rel})).href);}catch{return new Response('',{status:404});}
 });
 ipcMain.handle('desktop:request',async(_event,op,args={})=>{try{
  let value;
  if(op==='defect-rules')value=JSON.parse(await fs.readFile(path.join(__dirname,'../../app/wuhu-rules.json'),'utf8'));
  else if(op==='pick')value=await service.grant(op&&args.id?.includes('output')?global.testOutput:global.testInput);
  else value=await service.call(op,args);
  return {ok:true,value};
 }catch(e){return {ok:false,error:normalizeError(e)};}});
 const win=new BrowserWindow({width:1440,height:960,show:true,webPreferences:{preload:path.join(__dirname,'../../app/preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
 service.onFilesChanged=()=>{if(!win.isDestroyed())win.webContents.send('desktop:files-changed');};
 await win.loadFile(path.join(dir,'app/index.html'));
});
app.on('window-all-closed',()=>app.quit());
