const {test,expect,_electron}=require('@playwright/test');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const linuxArgs=process.platform==='linux'?['--no-sandbox','--ozone-platform=headless','--disable-gpu']:[];
test('production entry opens directly without activation or license gate',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'xj-production-'));
 const app=await _electron.launch({args:[...linuxArgs,'tests/fixture/production-main.cjs'],env:{...process.env,XUNJIAN_TEST_DIR:dir}});
 try{
  const page=await app.firstWindow();
  await page.waitForFunction(()=>!!window.XunjianDesktop);
  expect(await page.evaluate(()=>location.pathname.endsWith('/index.html'))).toBe(true);
  const rules=await page.evaluate(()=>desktopAPI.invoke('defect-rules'));
  expect(rules.ok).toBe(true);
  expect(rules.value).toHaveLength(45);
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});await fs.rm(dir,{recursive:true,force:true});}
});
