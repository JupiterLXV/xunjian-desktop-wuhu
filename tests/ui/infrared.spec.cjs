const {test,expect,_electron}=require('@playwright/test');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {PNG}=require('pngjs'),jpeg=require('jpeg-js');
const linuxArgs=process.platform==='linux'?['--no-sandbox','--ozone-platform=headless','--disable-gpu']:[];

function makeJpeg(){
 const png=new PNG({width:800,height:600});
 for(let y=0;y<png.height;y++)for(let x=0;x<png.width;x++){const i=(y*png.width+x)*4;png.data[i]=80;png.data[i+1]=120;png.data[i+2]=160;png.data[i+3]=255;}
 return jpeg.encode(png,85).data;
}

test('skip infrared toggle hides trailing-T photos from directory tree and image navigation',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'xj-ir-'));
 await fs.cp('app',path.join(dir,'app'),{recursive:true});
 const r=path.join(dir,'app/renderer.js');
 let source=await fs.readFile(r,'utf8');
 source=source.replace('  window.XunjianDesktop={',`  window.__test62={state:state,curName:curName};\n  window.XunjianDesktop={`);
 await fs.writeFile(r,source);

 const image=makeJpeg();
 const t1=path.join(dir,'原始照片','10kV测试线','主线','#001');
 const t2=path.join(dir,'原始照片','10kV测试线','主线','#002');
 await fs.mkdir(t1,{recursive:true});await fs.mkdir(t2,{recursive:true});await fs.mkdir(path.join(dir,'成果'));
 await fs.writeFile(path.join(t1,'DJI_20260724131310_0001_V.jpg'),image);
 await fs.writeFile(path.join(t1,'DJI_20260724131310_0002_T.jpg'),image);
 await fs.writeFile(path.join(t1,'DJI_20260724131310_0003_V.jpg'),image);
 await fs.writeFile(path.join(t2,'DJI_20260724131310_0004_T.jpg'),image);

 const app=await _electron.launch({args:[...linuxArgs,'tests/fixture/main.cjs'],env:{...process.env,XUNJIAN_TEST_DIR:dir}});
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.setViewportSize({width:1440,height:960});
  await page.waitForFunction(()=>window.XunjianDesktop&&window.__test62);
  await page.locator('#noticeClose').click();
  await page.locator('#btnFolder').click();
  await page.waitForFunction(()=>__test62.state.files.length===2&&!__test62.state.navBusy);

  const btn=page.locator('#btnSkipInfrared');
  await expect(btn).toHaveClass(/active/);
  await expect(btn).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#counter')).toHaveText('1 / 2');

  const visibleNames=await page.evaluate(()=>__test62.state.files.map(f=>f.name));
  expect(visibleNames).toEqual(['DJI_20260724131310_0001_V.jpg','DJI_20260724131310_0003_V.jpg']);

  await page.locator('#btnExpandAll').click();
  const treePhotos=await page.locator('#pathTree .photo-name-text').evaluateAll(es=>es.map(e=>e.dataset.rawName));
  expect(treePhotos).toEqual(['DJI_20260724131310_0001_V.jpg','DJI_20260724131310_0003_V.jpg']);
  const towerNames=await page.locator('#pathTree .folder-tower-name').evaluateAll(es=>es.map(e=>e.textContent));
  expect(towerNames).toEqual(['#001']);

  await page.keyboard.press('d');
  await page.waitForFunction(()=>__test62.state.index===1&&!__test62.state.navBusy);
  expect(await page.evaluate(()=>__test62.state.files[__test62.state.index].name)).toBe('DJI_20260724131310_0003_V.jpg');
  await expect(page.locator('#btnNext')).toBeDisabled();

  // Turn off skip infrared: _T photos and #002 tower become visible and navigable
  await btn.click();
  await page.waitForFunction(()=>__test62.state.files.length===4);
  await expect(btn).not.toHaveClass(/active/);
  await expect(btn).toHaveAttribute('aria-pressed','false');
  await page.locator('#btnExpandAll').click();
  const allTreePhotos=await page.locator('#pathTree .photo-name-text').evaluateAll(es=>es.map(e=>e.dataset.rawName));
  expect(allTreePhotos).toEqual([
   'DJI_20260724131310_0001_V.jpg',
   'DJI_20260724131310_0002_T.jpg',
   'DJI_20260724131310_0003_V.jpg',
   'DJI_20260724131310_0004_T.jpg'
  ]);
  const allTowers=await page.locator('#pathTree .folder-tower-name').evaluateAll(es=>es.map(e=>e.textContent));
  expect(allTowers).toEqual(['#001','#002']);

  // Navigate onto a _T photo, then turn skip infrared back ON
  await page.locator('#pathTree .loc-item[data-idx="1"] .photo-name-text').click();
  await page.waitForFunction(()=>__test62.state.index===1&&!__test62.state.navBusy);
  expect(await page.evaluate(()=>__test62.state.files[__test62.state.index].name)).toBe('DJI_20260724131310_0002_T.jpg');

  await btn.click();
  await page.waitForFunction(()=>__test62.state.files.length===2&&!__test62.state.navBusy);
  await expect(btn).toHaveClass(/active/);
  expect(await page.evaluate(()=>__test62.state.files[__test62.state.index].name)).toBe('DJI_20260724131310_0003_V.jpg');
  expect(errors).toEqual([]);
 }finally{
  await app.evaluate(({app})=>app.exit(0)).catch(()=>{});
  await app.close().catch(()=>{});
  await fs.rm(dir,{recursive:true,force:true});
 }
});
