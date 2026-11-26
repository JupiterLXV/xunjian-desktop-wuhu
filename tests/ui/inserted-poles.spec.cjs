const {test,expect,_electron}=require('@playwright/test');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),jpeg=require('jpeg-js');
const args=process.platform==='linux'?['--no-sandbox','--ozone-platform=headless','--disable-gpu']:[];
test('inserted poles: automatic fields, directory labels, independent tower progress, real triple save and restart persistence',async()=>{
 test.setTimeout(150000);
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'xj-inserted-poles-'));
 await fs.cp('app',path.join(dir,'app'),{recursive:true});await fs.mkdir(path.join(dir,'成果'));
 const renderer=path.join(dir,'app/renderer.js');await fs.writeFile(renderer,(await fs.readFile(renderer,'utf8')).replace('  window.XunjianDesktop={','  window.__polesTest={state:state,go:switchTo,name:newNamePreview,stats:SaveQueue48.stats};\n  window.XunjianDesktop={'));
 const expected=['#087','#088','#088+1','#088+2','#088+3','#088+10','#089'];
 const pixels=Buffer.alloc(2000*1000*4,110);for(let i=3;i<pixels.length;i+=4)pixels[i]=255;
 const base=jpeg.encode({data:pixels,width:2000,height:1000},85).data,originals=new Map();
 for(const pole of expected.slice().reverse()){
  const input=path.join(dir,'原始照片','10kV测试线','主线',pole);await fs.mkdir(input,{recursive:true});
  for(let i=0;i<(['#088','#088+1','#088+2'].includes(pole)?2:1);i++){
   const comment=Buffer.from('Untouched source metadata '+pole+'/'+i),segment=Buffer.alloc(4);segment[0]=255;segment[1]=254;segment.writeUInt16BE(comment.length+2,2);
   const bytes=Buffer.concat([base.subarray(0,2),segment,comment,base.subarray(2)]);originals.set(pole+'/'+i,bytes);await fs.writeFile(path.join(input,'DJI_000'+i+'_V.jpg'),bytes);
  }
 }
 let app,page;const errors=[];
 async function start(){app=await _electron.launch({args:[...args,'tests/fixture/main.cjs'],env:{...process.env,XUNJIAN_TEST_DIR:dir}});page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:960});await page.waitForFunction(()=>!!window.__polesTest&&!!window.XunjianDesktop);if(await page.locator('#noticeClose').isVisible())await page.locator('#noticeClose').click();await page.locator('#btnFolder').click();await page.waitForFunction(()=>__polesTest.state.files.length===10&&!__polesTest.state.navBusy&&!XunjianDesktop.busy());await page.locator('#btnOutput').click();await page.waitForFunction(()=>XunjianDesktop.roots().output&&!XunjianDesktop.busy()&&document.getElementById('desktopSyncStatus').textContent.startsWith('已同步'));}
 async function stop(){if(app){await page.evaluate(()=>XunjianDesktop.prepareClose());await app.evaluate(({app})=>app.exit(0));await app.close();app=null;}}
 async function go(pole,n=0){await expect(async()=>{await page.waitForFunction(()=>!XunjianDesktop.busy());expect(await page.evaluate(async({pole,n})=>{const rows=__polesTest.state.files.map((f,i)=>({f,i})).filter(r=>r.f.relPath.includes('/'+pole+'/'));return __polesTest.go(rows[n].i,true);},{pole,n})).toBe(true);await page.waitForFunction(()=>!XunjianDesktop.busy());}).toPass({timeout:15000,intervals:[100,200]});await expect(page.locator('#locationPole')).toHaveValue(pole);await expect(page.locator('#locationWarning')).toHaveText('');await expect(page.locator('#pathTree .current-tower .folder-tower-name')).toHaveText(pole);}
 async function progress(value){await expect(page.locator('#inspectionProgress48')).toHaveAttribute('max','7');await expect(page.locator('#inspectionProgress48')).toHaveJSProperty('value',value);await expect(page.locator('#dirSummaryText')).toContainText('已看 '+value+'/7 杆塔');}
 async function save(pole){
  const tag='_横担端U型挂板-螺母松动-严重',item=page.locator('.def-item[data-text='+JSON.stringify(tag)+']'),toggle=item.locator('..').locator('..').locator('.pos-toggle43');await page.waitForFunction(()=>!XunjianDesktop.busy()&&!document.getElementById('sideScroll').inert);if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();await item.click();
  const points=await page.evaluate(()=>{const v=__polesTest.state.view,r=document.getElementById('overlayCanvas').getBoundingClientRect();return [[250,200],[550,450]].map(([x,y])=>({x:r.left+v.cx+v.panX+(x*v.s-v.cx)*v.zoom,y:r.top+v.cy+v.panY+(y*v.s-v.cy)*v.zoom}));});await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();await page.mouse.move(points[1].x,points[1].y,{steps:6});await page.mouse.up();
  const name='10kV测试线-主线-'+pole+'-横担端U型挂板-螺母松动-严重.jpg';expect(await page.evaluate(()=>__polesTest.name().full)).toBe(name);await expect(page.locator('#btnBottomSave')).toBeEnabled();const before=await page.evaluate(()=>__polesTest.stats().completed);await page.locator('#btnBottomSave').click();await page.waitForFunction(n=>!XunjianDesktop.busy()&&__polesTest.stats().completed>n,before);
  for(const folder of ['大图','小图','原图'])expect((await fs.stat(path.join(dir,'成果',folder,name))).size).toBeGreaterThan(0);
  expect(await fs.readFile(path.join(dir,'成果','原图',name))).toEqual(originals.get(pole+'/0'));expect(await fs.readFile(path.join(dir,'原始照片','10kV测试线','主线',pole,'DJI_0000_V.jpg'))).toEqual(originals.get(pole+'/0'));
  expect(jpeg.decode(await fs.readFile(path.join(dir,'成果','大图',name)),{maxMemoryUsageInMB:256}).width).toBe(2000);
 }
 try{
  await start();expect(await page.evaluate(()=>Array.from(new Set(__polesTest.state.files.map(f=>f.relPath.split('/').at(-2)))))).toEqual(expected);await progress(1);
  await go('#088+1');await progress(1);await save('#088+1');await go('#088+1',1);await progress(2);
  await go('#088+2');await progress(2);await save('#088+2');await go('#088+2',1);await progress(3);
  await go('#088');await progress(3);await go('#088',1);await progress(4);await go('#088+3');await progress(5);await go('#088+10');await progress(6);await go('#089');await progress(7);
  for(const folder of ['大图','小图','原图'])expect((await fs.readdir(path.join(dir,'成果',folder))).sort()).toEqual(['#088+1','#088+2'].map(p=>'10kV测试线-主线-'+p+'-横担端U型挂板-螺母松动-严重.jpg'));
  await stop();await start();await progress(7);await go('#088+1');expect(await page.evaluate(()=>__polesTest.name().location.pole)).toBe('#088+1');expect(await page.evaluate(()=>XunjianDesktop.listOutputGroups(XunjianDesktop.currentId()))).toHaveLength(1);await go('#088+2');expect(await page.evaluate(()=>XunjianDesktop.listOutputGroups(XunjianDesktop.currentId()))).toHaveLength(1);expect(errors).toEqual([]);
 }finally{if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}await fs.rm(dir,{recursive:true,force:true});}
});
