const {test,expect,_electron}=require('@playwright/test');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),jpeg=require('jpeg-js');
const args=process.platform==='linux'?['--no-sandbox','--ozone-platform=headless','--disable-gpu']:[];
test('categories start closed and keep user expansion; progress follows completed towers with unequal photo counts and survives restart',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'xj-towers43-'));
 await fs.cp('app',path.join(dir,'app'),{recursive:true});await fs.mkdir(path.join(dir,'成果'));
 const file=path.join(dir,'app/renderer.js');await fs.writeFile(file,(await fs.readFile(file,'utf8')).replace('  window.XunjianDesktop={','  window.__test43={state:state,switchTo:switchTo,record:saveDrafts50};\n  window.XunjianDesktop={'));
 const pixels=Buffer.alloc(800*600*4,120);for(let i=3;i<pixels.length;i+=4)pixels[i]=255;const jpg=jpeg.encode({data:pixels,width:800,height:600},80).data;
 for(const [branch,pole,count]of [['主线','#001',2],['主线','#002',3],['支线','#001',2]]){const p=path.join(dir,'原始照片','10kV测试线',branch,pole);await fs.mkdir(p,{recursive:true});for(let i=0;i<count;i++)await fs.writeFile(path.join(p,'DJI_'+String(i).padStart(4,'0')+'_V.jpg'),jpg);}
 let app,page;const errors=[];
 async function start(){app=await _electron.launch({args:[...args,'tests/fixture/main.cjs'],env:{...process.env,XUNJIAN_TEST_DIR:dir}});page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:960});await page.waitForFunction(()=>!!window.__test43&&!!window.XunjianDesktop);if(await page.locator('#noticeClose').isVisible())await page.locator('#noticeClose').click();await page.locator('#btnFolder').click();await page.waitForFunction(()=>__test43.state.files.length===7&&!__test43.state.navBusy&&!XunjianDesktop.busy());}
 async function stop(){if(app){await page.evaluate(()=>XunjianDesktop.prepareClose());await app.evaluate(({app})=>app.exit(0));await app.close();app=null;}}
 async function go(branch,pole,n){
  await expect(async()=>{
   await page.waitForFunction(()=>!XunjianDesktop.busy()&&!document.getElementById('sideScroll').inert);
   const moved=await page.evaluate(async({branch,pole,n})=>{const rows=__test43.state.files.map((f,i)=>({f,i})).filter(r=>r.f.relPath.includes('/'+branch+'/'+pole+'/'));return __test43.switchTo(rows[n].i,true);},{branch,pole,n});
   expect(moved).toBe(true);
   await page.waitForFunction(()=>!XunjianDesktop.busy()&&!document.getElementById('sideScroll').inert);
  }).toPass({timeout:15000,intervals:[100,200]});
 }
 async function progress(value){await expect(page.locator('#inspectionProgress48')).toHaveAttribute('max','3');await expect(page.locator('#inspectionProgress48')).toHaveJSProperty('value',value);await expect(page.locator('#dirSummaryText')).toContainText('已看 '+value+'/3 杆塔');}
 try{
  await start();await go('主线','#001',0);await progress(0);const toggles=page.locator('#sideScroll .pos-toggle43');await expect(toggles.first()).toBeVisible();expect(await toggles.count()).toBeGreaterThan(0);expect(await toggles.evaluateAll(es=>es.every(e=>e.getAttribute('aria-expanded')==='false'))).toBe(true);await expect(page.locator('#sideScroll .def-item').first()).toBeHidden();
  const toggle=toggles.first(),cat=await toggle.locator('..').getAttribute('data-category');await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','true');await expect(page.locator('#sideScroll .def-item').first()).toBeVisible();await page.locator('#sideScroll .def-item').first().click();
  await go('主线','#001',1);await progress(1);await expect(page.locator('#sideScroll .pos-group[data-category='+JSON.stringify(cat)+'] .pos-toggle43')).toHaveAttribute('aria-expanded','true');
  await go('主线','#002',0);await progress(1);await go('主线','#002',1);await progress(1);await go('主线','#002',2);await progress(2);await go('支线','#001',0);await go('支线','#001',1);await progress(3);await go('主线','#001',0);await progress(3);
  const fold=page.locator('#sideScroll .pos-group[data-category='+JSON.stringify(cat)+'] .pos-toggle43');await page.waitForFunction(()=>!XunjianDesktop.busy()&&!document.getElementById('sideScroll').inert);await fold.press('Enter');await expect(fold).toHaveAttribute('aria-expanded','false');await fold.press('Space');await expect(fold).toHaveAttribute('aria-expanded','true');
  await stop();await start();await progress(3);await expect(page.locator('#sideScroll .pos-toggle43').first()).toBeVisible();expect(await page.locator('#sideScroll .pos-toggle43').evaluateAll(es=>es.every(e=>e.getAttribute('aria-expanded')==='false'))).toBe(true);
  await page.locator('#btnSettings').click();await page.locator('#btnClearViewedSettings').click();await page.locator('#confirmModalConfirm').click();await page.waitForFunction(()=>!XunjianDesktop.busy());await progress(0);expect(errors).toEqual([]);
 }finally{if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}await fs.rm(dir,{recursive:true,force:true});}
});
