// This check runs after building on the Windows Actions runner.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const {_electron}=require('@playwright/test');
(async()=>{
 if(process.platform!=='win32')throw Error('Installed EXE testing requires Windows');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'xj-installed-')),install=path.join(dir,'program');
 const exe=(await fs.readdir('dist')).find(n=>/^Xunjian-Wuhu-Setup-.*\.exe$/.test(n));if(!exe)throw Error('Installer missing');
 await promisify(execFile)(path.resolve('dist',exe),['/S','/CURRENTUSER','/D='+install],{timeout:120000});
 const app=await _electron.launch({executablePath:path.join(install,'巡检缺陷工具.exe'),args:['--user-data-dir='+path.join(dir,'profile')],timeout:60000});
 try{
  const page=await app.firstWindow();await page.waitForFunction(()=>/^XJ1-/.test(document.getElementById('machine')?.value));
  const status=await page.evaluate(()=>desktopAPI.invoke('license-status'));if(status.value.active)throw Error('Fresh installation unexpectedly licensed');
  const gate=await page.evaluate(()=>desktopAPI.invoke('defect-rules'));if(gate.ok||gate.error.name!=='NotAllowedError')throw Error('Activation gate failed');
  console.log('Windows installer, startup, MachineGuid and inactive-license gate passed');
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1});
