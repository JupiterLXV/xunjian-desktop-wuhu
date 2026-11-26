const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{execFile}=require('node:child_process'),{promisify}=require('node:util'),{_electron}=require('@playwright/test');
(async()=>{
 if(process.platform!=='win32')throw Error('Windows is required');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'xj-rename-upgrade-')),install=path.join(dir,'program'),run=promisify(execFile);
 const oldInstaller=path.resolve('upgrade-baseline/Xunjian-Wuhu-Setup-50.4.5-x64.exe'),nextInstaller=path.resolve('dist/Xunjian-Wuhu-Setup-50.4.6-x64.exe');
 await run(oldInstaller,['/S','/CURRENTUSER','/D='+install],{timeout:120000});
 let app=await _electron.launch({executablePath:path.join(install,'巡检缺陷工具.exe'),timeout:60000}),profile;
 try{const page=await app.firstWindow();await page.waitForFunction(()=>!!window.XunjianDesktop);profile=await app.evaluate(({app})=>app.getPath('userData'));await fs.writeFile(path.join(profile,'rename-50.4.6-proof.json'),JSON.stringify({saved:'unchanged'}));await page.evaluate(()=>localStorage.setItem('xunjian_rename_profile_proof','old-profile-50.4.5'));await page.evaluate(()=>XunjianDesktop.prepareClose());}
 finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
 await run(nextInstaller,['/S','/CURRENTUSER','/D='+install],{timeout:120000});
 app=await _electron.launch({executablePath:path.join(install,'巡检缺陷工具-芜湖.exe'),timeout:60000});
 try{
  const page=await app.firstWindow();await page.waitForFunction(()=>!!window.XunjianDesktop);
  assert.equal(await app.evaluate(({app})=>app.getName()),'巡检缺陷工具-芜湖');assert.equal(await page.title(),'巡检缺陷工具-芜湖');
  assert.equal(await fs.realpath(await app.evaluate(({app})=>app.getPath('userData'))),await fs.realpath(profile));
  assert.equal(await page.evaluate(()=>localStorage.getItem('xunjian_rename_profile_proof')),'old-profile-50.4.5');assert.deepEqual(JSON.parse(await fs.readFile(path.join(profile,'rename-50.4.6-proof.json'),'utf8')),{saved:'unchanged'});
  assert.equal(await page.locator('#desktopExportReport,#btnPrev,#btnNext,#btnMoreTools,#btnFocus48').count(),0);
  console.log('Installed 50.4.5 -> 50.4.6 product rename: same default profile, retained localStorage and files, new application/window name and removed controls verified');
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1});
