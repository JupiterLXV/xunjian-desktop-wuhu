// This check runs after building on the Windows Actions runner.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const {_electron}=require('@playwright/test');
(async()=>{
 if(process.platform!=='win32')throw Error('Installed EXE testing requires Windows');
 const dir=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'xj-installed-'))),install=path.join(dir,'program');
 const exe=(await fs.readdir('dist')).find(n=>n==='Xunjian-Wuhu-Setup-'+require('../package.json').version+'-x64.exe');if(!exe)throw Error('Installer missing');
 await promisify(execFile)(path.resolve('dist',exe),['/S','/CURRENTUSER','/D='+install],{timeout:120000});
 const uninstall=(await fs.readdir(install)).find(n=>/^Uninstall .*\.exe$/.test(n));if(!uninstall)throw Error('Installed uninstaller missing');
 await require('./verify-icons.cjs').verifyIcons([path.join(install,'巡检缺陷工具.exe'),path.join(install,uninstall),path.resolve('dist',exe)]);
 await promisify(execFile)('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.resolve('scripts/verify-shortcuts.ps1'),'-InstallDirectory',install],{timeout:30000});
 const app=await _electron.launch({executablePath:path.join(install,'巡检缺陷工具.exe'),args:['--user-data-dir='+path.join(dir,'profile')],timeout:60000});
 try{
  const page=await app.firstWindow();await page.waitForFunction(()=>/^XJ1-/.test(document.getElementById('machine')?.value));
  const status=await page.evaluate(()=>desktopAPI.invoke('license-status'));if(status.value.active)throw Error('Fresh installation unexpectedly licensed');
  const gate=await page.evaluate(()=>desktopAPI.invoke('defect-rules'));if(gate.ok||gate.error.name!=='NotAllowedError')throw Error('Activation gate failed');
  const image=await app.evaluate(async({app,nativeImage})=>{const ico=nativeImage.createFromPath(require('node:path').join(app.getAppPath(),'app/icon.ico'));const shell=await app.getFileIcon(process.execPath,{size:'normal'});return {icoEmpty:ico.isEmpty(),shellEmpty:shell.isEmpty()};});if(image.icoEmpty||image.shellEmpty)throw Error('Native Windows icon loading failed');
  console.log('Windows installer, startup, MachineGuid, inactive-license gate, original PE logos and both shortcut identities passed');
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1});
