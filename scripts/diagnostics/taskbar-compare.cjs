'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{execFile}=require('node:child_process'),{promisify}=require('node:util'),{_electron}=require('@playwright/test'),asar=require('@electron/asar');
const run=promisify(execFile);
(async()=>{
 if(process.platform!=='win32')throw Error('Requires a Windows desktop');
 const proof=path.resolve('taskbar-proof');await fs.mkdir(proof,{recursive:true});
 const temp=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'xj-taskbar44-'))),install=path.join(temp,'program with spaces');
 const setup=path.resolve(process.env.XUNJIAN_BASE_INSTALLER||'baseline-installer/Xunjian-Wuhu-Setup-50.4.3-x64.exe');
 await run(setup,['/S','/CURRENTUSER','/D='+install],{timeout:120000});
 const executable=path.join(install,'巡检缺陷工具.exe'),archive=path.join(install,'resources/app.asar'),original=await fs.readFile(archive),source=path.join(temp,'source');
 const fuses=require('@electron/fuses'),wire=await fuses.getCurrentFuseWire(executable);if(wire[fuses.FuseV1Options.EnableEmbeddedAsarIntegrityValidation]!==48)throw Error('Integrity is enforced; cannot create controlled ASAR variants without a rebuild');
 asar.extractAll(archive,source);const mainFile=path.join(source,'app/main.cjs'),main=await fs.readFile(mainFile,'utf8');
 const line=main.split('\n').find(s=>s.includes('win.setAppDetails('));if(!line)throw Error('Original window details call not found');
 const R=await import('resedit'),pe=R.NtExecutable.from(await fs.readFile(executable)),groups=R.Resource.IconGroupEntry.fromEntries(R.NtExecutableResource.from(pe).entries),id=groups[0].id;if(typeof id!=='number')throw Error('Expected numeric PE icon group ID');
 async function powershell(mode,hwnd='0',label='environment'){
  const r=await run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.resolve('scripts/diagnostics/taskbar-desktop.ps1'),'-Mode',mode,'-WindowHandle',hwnd,'-Label',label,'-OutputDirectory',proof],{timeout:60000,maxBuffer:4*1024*1024});return JSON.parse(r.stdout.replace(/^\uFEFF/,''));
 }
 const environment=await powershell('Prepare');console.log('TASKBAR_ENVIRONMENT '+JSON.stringify(environment));
 const cases=[['A-original',main],['B-no-window-details',main.replace(line,'')],['C-window-appid-only',main.replace(line," if(process.platform==='win32')win.setAppDetails({appId:'local.xunjian.desktop'});")],['D-negative-resource-id',main.replace('appIconIndex:0','appIconIndex:-'+id)],['E-process-implicit-id',main.replace(line,'').replace("app.setAppUserModelId('local.xunjian.desktop');",'')]];
 const results=[];
 // A second block checks direct EXE launches without installer-created shortcut lookup.
 let knownFolders=null;const movedLinks=[];
 cases.push(['F-no-shortcuts-original',main],['G-no-shortcuts-no-details',main.replace(line,'')],['H-no-shortcuts-negative-id',main.replace('appIconIndex:0','appIconIndex:-'+id)]);
 try{for(const [label,code]of cases){
  if(label==='F-no-shortcuts-original'){
   const desktop=path.join(knownFolders.desktop,'巡检缺陷工具.lnk'),start=path.join(knownFolders.appData,'Microsoft','Windows','Start Menu','Programs','巡检缺陷工具.lnk');
   for(const link of [desktop,start]){try{const backup=path.join(temp,'saved-'+movedLinks.length+'.lnk');await fs.rename(link,backup);movedLinks.push({link,backup});}catch(e){if(e.code!=='ENOENT')throw e;}}
  }
  if(label==='A-original')await fs.writeFile(archive,original);
  else{await fs.writeFile(mainFile,code);asar.uncacheAll();const staged=path.join(temp,label+'.asar');await asar.createPackage(source,staged);await fs.copyFile(staged,archive);}
  const app=await _electron.launch({executablePath:executable,args:['--user-data-dir='+path.join(temp,label)],timeout:60000});
  try{
   const page=await app.firstWindow();await page.waitForFunction(()=>!!window.XunjianDesktop);
   if(!knownFolders)knownFolders=await app.evaluate(({app})=>({desktop:app.getPath('desktop'),appData:app.getPath('appData')}));
   const hwnd=await app.evaluate(({BrowserWindow},label)=>{const w=BrowserWindow.getAllWindows()[0];w.setTitle('Xunjian taskbar '+label);w.show();w.focus();const b=w.getNativeWindowHandle();return b.readBigUInt64LE(0).toString();},label);
   await new Promise(r=>setTimeout(r,2500));
   const result=await powershell('Capture',hwnd,label);result.iconGroupId=id;results.push(result);console.log('TASKBAR_CASE '+JSON.stringify(result));
   await fs.writeFile(path.join(proof,label+'.json'),JSON.stringify(result,null,2));
   for(const file of result.captures)console.log('TASKBAR_IMAGE '+label+' '+path.basename(file)+' '+(await fs.readFile(file)).toString('base64'));
  }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
 }}finally{await fs.writeFile(archive,original);for(const row of movedLinks)await fs.rename(row.backup,row.link);}
 await fs.writeFile(path.join(proof,'comparison.json'),JSON.stringify({environment,iconGroupId:id,results,visualVerificationRequiresReview:true},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
