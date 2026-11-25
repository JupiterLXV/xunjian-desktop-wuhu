const {test,expect,_electron}=require('@playwright/test');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
test('T18: real Windows MachineGuid and production activation gate',async()=>{
 test.skip(process.platform!=='win32','Needs Windows registry and the native single-instance lock; Linux renderer/crypto tests run separately.');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'xj-production-'));
 const app=await _electron.launch({args:['tests/fixture/production-main.cjs'],env:{...process.env,XUNJIAN_TEST_DIR:dir}});
 try{
  const page=await app.firstWindow();await expect(page.locator('#machine')).toHaveValue(/^XJ1-(?:[A-F0-9]{8}-){7}[A-F0-9]{8}$/);
  const state=await page.evaluate(()=>desktopAPI.invoke('license-status'));expect(state.value.active).toBe(false);
  for(const op of ['pick','defect-rules','list']){const r=await page.evaluate(op=>desktopAPI.invoke(op),op);expect(r.ok).toBe(false);expect(r.error.name).toBe('NotAllowedError');}
  expect(await page.evaluate(()=>typeof window.XunjianDesktop)).toBe('undefined');
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});await fs.rm(dir,{recursive:true,force:true});}
});
