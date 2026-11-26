// This check runs after building on the Windows Actions runner.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const {_electron}=require('@playwright/test');
(async()=>{
 if(process.platform!=='win32')throw Error('Installed EXE testing requires Windows');
 const dir=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'xj-installed-'))),install=path.join(dir,'program');
 const exe=(await fs.readdir('dist')).find(n=>n==='Xunjian-Wuhu-Setup-'+require('../package.json').version+'-x64.exe');if(!exe)throw Error('Installer missing');
 await promisify(execFile)(path.resolve('dist',exe),['/S','/CURRENTUSER','/D='+install],{timeout:120000});
 const uninstall=(await fs.readdir(install)).find(n=>/^Uninstall .*\.exe$/.test(n));if(!uninstall)throw Error('Installed uninstaller missing');
 await require('./verify-icons.cjs').verifyIcons([path.join(install,'巡检缺陷工具-芜湖.exe'),path.join(install,uninstall),path.resolve('dist',exe)]);
 const proofDir=path.resolve('taskbar-proof');await fs.mkdir(proofDir,{recursive:true});
 const desktopScript=path.resolve('scripts/diagnostics/taskbar-desktop.ps1');
 const desktop=await promisify(execFile)('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',desktopScript,'-Mode','Prepare'],{timeout:60000});console.log('TASKBAR_DESKTOP '+desktop.stdout.trim());
 const app=await _electron.launch({executablePath:path.join(install,'巡检缺陷工具-芜湖.exe'),args:['--user-data-dir='+path.join(dir,'profile')],timeout:60000});
 try{
  const page=await app.firstWindow();await page.waitForFunction(()=>!!window.XunjianDesktop);
  if(await app.evaluate(({app})=>app.getName())!=='巡检缺陷工具-芜湖'||await page.title()!=='巡检缺陷工具-芜湖')throw Error('Application display name mismatch');
  const removed=await app.evaluate(({app})=>{const fs=process.getBuiltinModule('fs'),path=process.getBuiltinModule('path');return ['report-ui.js','report-service.cjs'].every(n=>!fs.existsSync(path.join(app.getAppPath(),'app',n)));});if(!removed)throw Error('Removed report modules were packaged');
  const rules=await page.evaluate(()=>desktopAPI.invoke('defect-rules'));if(!rules.ok||!Array.isArray(rules.value)||rules.value.length!==45)throw Error('Direct startup failed');
  const image=await app.evaluate(async({app,nativeImage})=>{const ico=nativeImage.createFromBuffer(process.getBuiltinModule('fs').readFileSync(process.getBuiltinModule('path').join(app.getAppPath(),'app/icon.png')));const shell=await app.getFileIcon(process.execPath,{size:'normal'});return {icoEmpty:ico.isEmpty(),shellEmpty:shell.isEmpty()};});if(image.icoEmpty||image.shellEmpty)throw Error('Native Windows icon loading failed');
  const hwnd=await app.evaluate(({BrowserWindow})=>{const b=BrowserWindow.getAllWindows()[0].getNativeWindowHandle();return (b.length===8?b.readBigUInt64LE(0):BigInt(b.readUInt32LE(0))).toString();});
  const check=await promisify(execFile)('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.resolve('scripts/verify-window-icon.ps1'),'-WindowHandle',hwnd,'-OriginalPng',path.resolve('app/icon.png')],{timeout:30000});console.log(check.stdout);
  await new Promise(r=>setTimeout(r,2000));
  const capture=await promisify(execFile)('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',desktopScript,'-Mode','Capture','-WindowHandle',hwnd,'-Label','release-50.4.6','-OutputDirectory',proofDir],{timeout:60000,maxBuffer:4*1024*1024});
  const taskbar=JSON.parse(capture.stdout.replace(/^\uFEFF/,''));
  for(const key of ['RelaunchIconResource','RelaunchCommand','RelaunchDisplayNameResource'])if(taskbar.properties[key]!==null)throw Error('Unexpected window relaunch override: '+key);
  await fs.writeFile(path.join(proofDir,'release.json'),JSON.stringify(taskbar,null,2));console.log('TASKBAR_RELEASE_PROOF '+JSON.stringify(taskbar));
  for(const file of taskbar.captures)console.log('TASKBAR_RELEASE_IMAGE '+path.basename(file)+' '+(await fs.readFile(file)).toString('base64'));
  if(!taskbar.explorerTaskbarPresent||!taskbar.buttons.length)console.log('Actual taskbar display requires manual verification: no identifiable visible Explorer button');
  const shortcuts=await app.evaluate(async({app,shell})=>{
   const fs=process.getBuiltinModule('fs/promises'),path=process.getBuiltinModule('path');
   const start=path.join(app.getPath('appData'),'Microsoft','Windows','Start Menu','Programs');
   async function find(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory()){const found=await find(p);if(found)return found;}else if(item.name==='巡检缺陷工具-芜湖.lnk')return p;}}
   const links=[path.join(app.getPath('desktop'),'巡检缺陷工具-芜湖.lnk'),await find(start)];
   const rows=[];for(const link of links){if(!link)throw Error('Start Menu shortcut missing');const bytes=await fs.readFile(link);rows.push({link,size:bytes.length,header:bytes.subarray(0,20).toString('hex'),details:shell.readShortcutLink(link)});}return rows;
  });
  console.log('Native shortcut details:',JSON.stringify(shortcuts));
  const target=await fs.realpath(path.join(install,'巡检缺陷工具-芜湖.exe'));
  for(const row of shortcuts){const d=row.details;if(!d.target||(await fs.realpath(d.target)).toLowerCase()!==target.toLowerCase())throw Error('Shortcut target mismatch: '+JSON.stringify(row));if(d.icon&&(await fs.realpath(d.icon)).toLowerCase()!==target.toLowerCase())throw Error('Shortcut icon mismatch');if(d.appUserModelId!=='local.xunjian.desktop')throw Error('Shortcut AppUserModelID mismatch');}
  console.log('Windows installer, direct startup, actual large/small window icons, original PE logos and both shortcut identities passed');
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1});
