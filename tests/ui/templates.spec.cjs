const {test,expect,_electron}=require('@playwright/test');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),jpeg=require('jpeg-js');
const template=require('../fixtures/imported-template-147.json');
const linuxArgs=process.platform==='linux'?['--no-sandbox','--ozone-platform=headless','--disable-gpu']:[];
const selector=(kind,value)=>kind+'[data-category='+JSON.stringify(value)+']';
test('dynamic templates: all 147 labels, new categories, selection, triple save, merge, overwrite and actual restart persistence',async()=>{
 test.setTimeout(180000);
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'xj-templates-'));
 const input=path.join(dir,'原始照片','10kV测试线','主线','#001'),output=path.join(dir,'成果');
 await fs.mkdir(input,{recursive:true});await fs.mkdir(output);await fs.cp('app',path.join(dir,'app'),{recursive:true});
 const render=path.join(dir,'app/renderer.js');await fs.writeFile(render,(await fs.readFile(render,'utf8')).replace('  window.XunjianDesktop={','  window.__templateTest={state:state,dict:function(){return defectDict;},critical:function(){return Array.from(criticalDefects);},name:newNamePreview,hide:hideDefect,stats:function(){return SaveQueue48.stats();}};\n  window.XunjianDesktop={'));
 const pixels=Buffer.alloc(800*600*4,150);for(let i=3;i<pixels.length;i+=4)pixels[i]=255;const original=jpeg.encode({width:800,height:600,data:pixels},85).data;await fs.writeFile(path.join(input,'DJI_0001_V.jpg'),original);
 let app,page;const errors=[];
 async function start(){
  app=await _electron.launch({args:[...linuxArgs,'tests/fixture/main.cjs'],env:{...process.env,XUNJIAN_TEST_DIR:dir}});page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:960});await page.waitForFunction(()=>!!window.XunjianDesktop&&!!window.__templateTest);
  if(await page.locator('#noticeModal').isVisible().catch(()=>false))await page.locator('#noticeClose').click();
  if(await page.locator('#noticeClose').isVisible())await page.locator('#noticeClose').click();
  await page.locator('#btnFolder').click();await page.waitForFunction(()=>__templateTest.state.files.length===1&&!__templateTest.state.navBusy);
  await page.locator('#btnOutput').click();await page.waitForFunction(()=>XunjianDesktop.roots().output&&!XunjianDesktop.busy());await page.waitForFunction(()=>document.getElementById('desktopSyncStatus').textContent.startsWith('已同步')&&!XunjianDesktop.busy());
 }
 async function stop(){if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});app=null;}}
 async function importData(data,merge=false){await page.locator('#templateFileInput').setInputFiles({name:'template.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await expect(page.locator('#importModal')).toHaveClass(/show/);await page.locator(merge?'#btnDoMergeImport':'#btnDoOverwriteImport').click();await expect(page.locator('#importModal')).not.toHaveClass(/show/);}
 async function check(dict){
  await expect(page.locator('#sideScroll .pos-group')).toHaveCount(Object.keys(dict).length);
  await page.locator('#sideScroll .pos-toggle43[aria-expanded="false"]').evaluateAll(es=>es.forEach(e=>e.click()));
  for(const [cat,tags]of Object.entries(dict)){const group=page.locator('#sideScroll '+selector('.pos-group',cat));await expect(group.locator('.pos-count')).toHaveText(String(tags.length));expect(await group.locator('.def-item').evaluateAll(es=>es.map(e=>e.dataset.text))).toEqual(tags);}
 }
 async function save(){await page.waitForFunction(()=>!XunjianDesktop.busy()&&!document.getElementById('btnBottomSave').disabled);const before=await page.evaluate(()=>__templateTest.stats().completed);await page.locator('#btnBottomSave').click();await page.waitForFunction(n=>!XunjianDesktop.busy()&&__templateTest.stats().completed>n,before);}
 try{
  await start();await page.evaluate(tag=>__templateTest.hide(tag),template.defectDict.绝缘子[0]);
  await importData(template);await check(template.defectDict);expect(await page.locator('#sideScroll .def-item').count()).toBe(147);
  // Use real mouse coordinates transformed from original pixels, then the real save button.
  const points=await page.evaluate(()=>{const v=__templateTest.state.view,r=document.getElementById('overlayCanvas').getBoundingClientRect();return [200,350].map(n=>({x:r.left+v.cx+v.panX+(n*v.s-v.cx)*v.zoom,y:r.top+v.cy+v.panY+(n*v.s-v.cy)*v.zoom}));});await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();await page.mouse.move(points[1].x,points[1].y,{steps:5});await page.mouse.up();
  const defaults=new Set(require('../../app/wuhu-rules.json').map(require('../../app/wuhu-core.js').tag));
  for(const cat of ['绝缘子','通道','变压器','线夹','横担']){
   const tag=template.defectDict[cat].find(t=>!defaults.has(t));expect(tag).toBeTruthy();await page.locator('#sideScroll .def-item[data-text='+JSON.stringify(tag)+']').click();await expect.poll(()=>page.evaluate(()=>__templateTest.name().appended[0])).toBe(tag);
   const name=await page.evaluate(()=>__templateTest.name().full);expect(name).toBe('10kV测试线-主线-#001-'+tag.slice(1)+'.jpg');await save();
   for(const folder of ['大图','小图','原图'])expect((await fs.stat(path.join(output,folder,name))).size).toBeGreaterThan(0);expect(await fs.readFile(path.join(output,'原图',name))).toEqual(original);
  }
  await page.locator('#btnSideAddCat').click();await page.locator('#promptModalInput').fill('自定义设备');await page.locator('#promptModalConfirm').click();await page.locator('#sideScroll '+selector('.add-to-cat-btn','自定义设备')).click();await page.locator('#promptModalInput').fill('_自定义设备-自定义新缺陷');await page.locator('#promptModalConfirm').click();await expect(page.locator('#sideScroll .def-item[data-text="_自定义设备-自定义新缺陷"]')).toBeVisible();await save();expect(await fs.readFile(path.join(output,'原图','10kV测试线-主线-#001-自定义设备-自定义新缺陷-一般.jpg'))).toEqual(original);
  const expected={...template.defectDict,自定义设备:['_自定义设备-自定义新缺陷']};await stop();await start();await check(expected);expect(await page.evaluate(()=>__templateTest.critical())).toEqual(template.criticalDefects);
  const merge={defectDict:{任意新分类:['_任意新分类-完全新增-危急'],绝缘子:['_绝缘子-合并新增-一般']},criticalDefects:['_任意新分类-完全新增-危急']};await importData(merge,true);expected.任意新分类=merge.defectDict.任意新分类;expected.绝缘子=[...expected.绝缘子,...merge.defectDict.绝缘子];await check(expected);
  await importData({defectDict:{唯一新分类:['_唯一新分类-新规则-严重']},criticalDefects:[]});await check({唯一新分类:['_唯一新分类-新规则-严重']});await stop();await start();await check({唯一新分类:['_唯一新分类-新规则-严重']});expect(errors).toEqual([]);
 }finally{await stop();await fs.rm(dir,{recursive:true,force:true});}
});
