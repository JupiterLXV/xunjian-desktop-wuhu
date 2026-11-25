const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const {_electron}=require('@playwright/test');const run=promisify(execFile),hash=async p=>crypto.createHash('sha256').update(await fs.readFile(p)).digest('hex');
(async()=>{
 assert.equal(process.platform,'win32');
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'xunjian taskbar probe ')),install=path.join(tmp,'program');
 const installer=path.resolve('baseline-installer/Xunjian-Wuhu-Setup-50.4.4-x64.exe');
 await run(installer,['/S','/CURRENTUSER','/D='+install],{timeout:120000});
 const exe=path.join(install,'巡检缺陷工具.exe'),asar=path.join(install,'resources/app.asar'),before=await hash(asar);
 await run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.resolve('scripts/diagnostics/taskbar-desktop.ps1'),'-Mode','Prepare'],{timeout:60000});
 const app=await _electron.launch({executablePath:exe,args:['--user-data-dir='+path.join(tmp,'profile')],timeout:60000});
 try{
  const page=await app.firstWindow();await page.waitForFunction(()=>!!window.XunjianDesktop);
  const links=await app.evaluate(async({app,shell})=>{
   const fs=process.getBuiltinModule('fs/promises'),path=process.getBuiltinModule('path');
   const desktop=path.join(app.getPath('desktop'),'巡检缺陷工具.lnk'),start=path.join(app.getPath('appData'),'Microsoft/Windows/Start Menu/Programs/巡检缺陷工具.lnk');
   const rows=[];for(const p of [desktop,start])rows.push({path:p,bytes:(await fs.readFile(p)).toString('base64'),details:shell.readShortcutLink(p)});return rows;
  });
  const output=path.resolve('taskbar-probe-proof/automatic'),cmd=path.join(tmp,'含空格 probe.cmd');await fs.copyFile(path.resolve('dist/taskbar-probe/Xunjian-Taskbar-Probe.cmd'),cmd);
  const result=await run('powershell.exe',['-NoProfile','-Command','& $env:XUNJIAN_TASKBAR_PROBE_CMD; exit $LASTEXITCODE'],{env:{...process.env,XUNJIAN_TASKBAR_PROBE_AUTOMATIC:'1',XUNJIAN_TASKBAR_PROBE_OUTPUT:output,XUNJIAN_TASKBAR_PROBE_CMD:cmd},timeout:120000,maxBuffer:1024*1024});console.log(result.stdout);
  const report=JSON.parse((await fs.readFile(path.join(output,'taskbar-report.json'),'utf8')).replace(/^\uFEFF/,''));
  assert.equal(report.error,null);assert.equal(report.restoreError,null);assert.equal(report.restored,true);
  assert.equal(report.source.version,'50.4.4');assert.equal(report.source.hasSetAppDetails,false);
  assert.equal(report.source.asarSha256.toLowerCase(),before);assert.equal(await hash(asar),before);
  assert.equal(report.stages.length,3);assert.deepEqual(report.stages[0].properties,report.originalProperties);
  assert.equal(report.stages[1].properties.AppUserModelID,'local.xunjian.desktop');
  assert.match(report.stages[1].properties.RelaunchIconResource,/original-logo\.ico,0$/);
  assert.match(report.stages[2].properties.AppUserModelID,/^Local\.Xunjian\.TaskbarProbe\./);
  assert.deepEqual(report.restoredProperties,report.originalProperties);
  for(const row of links)assert.equal((await fs.readFile(row.path)).toString('base64'),row.bytes,'Existing shortcut was modified');
  for(const stage of report.stages){assert.equal(stage.userObserved,'not-executed');assert(stage.taskbars.length>0);assert(stage.taskbars.some(t=>t.visible&&t.file&&!t.error));for(const icon of stage.icons)assert.equal(icon.error,null);}
  console.log('Actual Windows desktop probe: ASAR extraction, both window-property comparisons, original-logo hash, original-property restoration and unchanged shortcuts/source verified. User-machine white-paper issue not reproduced or marked as passed.');
  console.log('TASKBAR_PROBE_SUMMARY '+JSON.stringify({windows:report.windows,source:report.source,restored:report.restored,stages:report.stages.map(s=>({label:s.label,properties:s.properties,userObserved:s.userObserved,icons:s.icons,taskbars:s.taskbars}))}));
  for(const stage of report.stages)for(const shot of stage.taskbars)if(shot.file)console.log('TASKBAR_PROBE_IMAGE '+shot.file+' '+(await fs.readFile(path.join(output,shot.file))).toString('base64'));
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1});
