const {test,expect,_electron}=require('@playwright/test');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {PNG}=require('pngjs'),jpeg=require('jpeg-js');
let fixtureJpeg=null;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const linuxArgs=process.platform==='linux'?['--no-sandbox','--ozone-platform=headless','--disable-gpu']:[];
async function fixture(options={}){
 const count=options.count||8;
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'xj-wuhu-'));
 await fs.cp('app',path.join(dir,'app'),{recursive:true});
 const r=path.join(dir,'app/renderer.js');let source=await fs.readFile(r,'utf8');
 // Introspection lives ONLY in the temporary fixture; the actual packaged renderer has no test hook.
 source=source.replace('  window.XunjianDesktop={',`  window.__test62={state:state,getMeta:getMeta,curName:curName,currentCrop:currentCrop62,newName:newNamePreview,save:saveBothFolders,clear:clearForSecondaryEdit,switchTo:switchTo,undo:undoLastAction,del:deleteSelectedBox,detail:detail38,evict:evictLRU,preload:schedulePreload,render:render,updateHud:updateHud,record:saveDrafts50,busyDetail:function(){return {ioBusy:ioBusy,nav:state.navBusy,scan:!!outputScanTask46,navigationPrompt:navigationPrompt,mode:mode,dragged:!!draggedItem,queue:SaveQueue48.stats(),boxed:state.cache.get(curName())?.isBoxed,meta:getMeta(curName())};},cancelDetails:cancelDetails38,trim:trimForExport46,fast:FastIndex,tree:VirtualTree48,cacheBytes:CACHE_BYTES,review:reviewOf,viewed:function(){return viewedPhotosMap;}};\n  window.XunjianDesktop={`);
 await fs.writeFile(r,source);
 let image=fixtureJpeg;
 if(!image||options.png){
  const png=new PNG({width:4096,height:2048});
  for(let y=0;y<png.height;y++)for(let x=0;x<png.width;x++){const i=(y*png.width+x)*4;png.data[i]=60+(x%120);png.data[i+1]=90+(y%100);png.data[i+2]=120;png.data[i+3]=255;}
  if(options.png)image=PNG.sync.write(png);
  else {const encoded=jpeg.encode(png,90).data,comment=Buffer.from('Synthetic original metadata: preserve these bytes'),segment=Buffer.alloc(4);segment[0]=255;segment[1]=254;segment.writeUInt16BE(comment.length+2,2);image=Buffer.concat([encoded.subarray(0,2),segment,comment,encoded.subarray(2)]);fixtureJpeg=image;}
 }
 const input=path.join(dir,'原始照片','10kV枫墩188线','良久支线','#001');await fs.mkdir(input,{recursive:true});await fs.mkdir(path.join(dir,'成果'));
 for(let n=0;n<count;n++){const dest=path.join(input,`DJI_20260724131310_${String(n).padStart(4,'0')}_V.${options.png?'png':'jpg'}`);if(n===0)await fs.writeFile(dest,image);else await fs.link(path.join(input,`DJI_20260724131310_0000_V.${options.png?'png':'jpg'}`),dest);}
 const app=await _electron.launch({args:[...linuxArgs,'tests/fixture/main.cjs'],env:{...process.env,XUNJIAN_TEST_DIR:dir}});
 const page=await app.firstWindow();await page.setViewportSize({width:1440,height:960});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.waitForFunction(()=>window.XunjianDesktop&&window.__test62);
 await page.locator('#noticeClose').click();
 await page.locator('#btnFolder').click();
 await page.waitForFunction(count=>__test62.state.files.length===count&&!__test62.state.navBusy&&__test62.state.natural.w===4096,count);
 await page.locator('#btnOutput').click();
 await page.waitForFunction(()=>XunjianDesktop.roots().output&&!XunjianDesktop.busy());
 await page.waitForFunction(()=>document.getElementById('desktopSyncStatus').textContent.startsWith('已同步')&&!XunjianDesktop.busy());
 return {dir,app,page,errors,input,image,output:path.join(dir,'成果')};
}
async function draw(page,x1,y1,x2,y2){
 const p=await page.evaluate(({x1,y1,x2,y2})=>{const v=__test62.state.view,r=document.getElementById('overlayCanvas').getBoundingClientRect();const p=(x,y)=>({x:r.left+v.cx+v.panX+(x*v.s-v.cx)*v.zoom,y:r.top+v.cy+v.panY+(y*v.s-v.cy)*v.zoom});return {a:p(x1,y1),b:p(x2,y2)};},{x1,y1,x2,y2});
 await page.mouse.move(p.a.x,p.a.y);await page.mouse.down();await page.mouse.move(p.b.x,p.b.y,{steps:8});await page.mouse.up();
}
async function choose(page,tag='_横担端U型挂板-螺母松动-严重'){
 await expect(async()=>{
  await page.waitForFunction(()=>!XunjianDesktop.busy()&&!document.getElementById('sideScroll').inert);
  const item=page.locator(`.def-item[data-text="${tag}"]`),toggle=item.locator('..').locator('..').locator('.pos-toggle43');
  if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
  await page.locator(`.def-item[data-text="${tag}"]`).click();
  await page.waitForFunction(t=>__test62.getMeta(__test62.curName()).appended[0]===t,tag,{timeout:1000});
 }).toPass({timeout:10000,intervals:[200,500]});
}
async function save(page){
 return page.evaluate(async()=>{const deadline=Date.now()+20000;while(XunjianDesktop.busy()){if(Date.now()>deadline)throw Error('Application remains busy');await new Promise(r=>setTimeout(r,20));}return __test62.save();});
}
async function cleanup(f){await f.app.evaluate(({app})=>app.exit(0)).catch(()=>{});await f.app.close().catch(()=>{});await fs.rm(f.dir,{recursive:true,force:true});}

test('T06–17: real renderer paired export, target/slider preview, original protection, transactions, secondary edit, trash and refresh',async()=>{
 const f=await fixture(),{page}=f;
 try{
  const labels=await page.locator('#pathTree .photo-name-text').evaluateAll(es=>es.map(e=>({text:e.firstChild?.textContent||'',raw:e.dataset.rawName,index:Number(e.dataset.idx),width:e.getBoundingClientRect().width,color:getComputedStyle(e).color})));expect(labels.length).toBeGreaterThan(0);for(const label of labels){expect(label.text).toContain('DJI_');expect(label.width).toBeGreaterThan(20);expect(label.raw).toBe(await page.evaluate(i=>__test62.state.files[i].name,label.index));}
  await page.locator('#pathTree .loc-item[data-idx="1"] .photo-name-text').click();await page.waitForFunction(()=>__test62.state.index===1&&!__test62.state.navBusy);expect(await page.evaluate(()=>!!__test62.viewed()[__test62.curName()])).toBe(true);await page.locator('#pathTree .loc-item[data-idx="0"] .photo-name-text').click();await page.waitForFunction(()=>__test62.state.index===0&&!__test62.state.navBusy);
  await choose(page);await page.locator('#btnBottomSave').click();
  await expect(page.locator('#toast')).toContainText('有效红框');
  expect((await fs.readdir(f.output)).filter(n=>!n.startsWith('.'))).toEqual([]);
  await draw(page,300,500,500,750);await draw(page,2500,500,3000,900);await draw(page,2520,1010,2850,1160);
  await expect(page.locator('#cropTarget option')).toHaveCount(4);
  expect((await page.evaluate(()=>__test62.currentCrop())).target).toBe(1);
  await page.locator('#cropTarget').selectOption('0');
  await page.locator('#cropMargin').evaluate(e=>{e.value='75';e.dispatchEvent(new Event('input',{bubbles:true}));});
  const crop=await page.evaluate(()=>__test62.currentCrop());expect(crop.target).toBe(0);expect(crop.x+crop.w).toBeLessThan(2500);
  const result=await save(page);expect(result).toBe(true);
  const name='10kV枫墩188线-良久支线-#001-横担端U型挂板-螺母松动-严重.jpg';
  expect((await fs.readdir(f.output)).filter(n=>!n.startsWith('.')).sort()).toEqual(['原图','大图','小图']);
  expect(await fs.readdir(path.join(f.output,'大图'))).toEqual([name]);expect(await fs.readdir(path.join(f.output,'小图'))).toEqual([name]);expect(await fs.readdir(path.join(f.output,'原图'))).toEqual([name]);expect(await fs.readFile(path.join(f.output,'原图',name))).toEqual(f.image);
  const doc=JSON.parse(await fs.readFile(path.join(f.output,'.xunjian-output-v1.json')));expect(doc.records).toHaveLength(3);
  expect(doc.records[0].exportCrop62).toEqual(crop);
  // The viewer is 1440px or less. Export dimensions prove that it wasn't screenshotted.
  const dims=await page.evaluate(async({name,crop})=>{
   const root=XunjianDesktop.roots().output,large=await (await (await root.getDirectoryHandle('大图')).getFileHandle(name)).getFile(),small=await (await (await root.getDirectoryHandle('小图')).getFileHandle(name)).getFile();
   const a=await createImageBitmap(large),b=await createImageBitmap(small),cv=document.createElement('canvas');cv.width=a.width;cv.height=a.height;const ctx=cv.getContext('2d');ctx.drawImage(a,0,0);
   const pixel=(x,y)=>Array.from(ctx.getImageData(x,y,1,1).data),res={large:[a.width,a.height],small:[b.width,b.height],red:pixel(300,600),untouched:pixel(2100,1300)};a.close();b.close();cv.width=cv.height=1;return res;
  },{name,crop});
  expect(dims.large).toEqual([4096,2048]);expect(dims.small).toEqual([crop.w,crop.h]);expect(dims.red[0]).toBeGreaterThan(220);expect(dims.red[1]).toBeLessThan(55);expect(dims.untouched[0]).toBeLessThan(200);
  expect(hash(await fs.readFile(path.join(f.input,'DJI_20260724131310_0000_V.jpg')))).toBe(hash(f.image));
  if(!await page.locator('#currentPhotoDetails').evaluate(e=>e.open))await page.locator('#currentPhotoDetails > summary').click();
  await page.waitForFunction(()=>!XunjianDesktop.busy());await page.locator('#btnToggleBoxedView').click();await page.waitForFunction(()=>__test62.state.cache.get(__test62.curName()).isBoxed&&!XunjianDesktop.busy());
  await page.evaluate(()=>XunjianDesktop.refresh(true));expect(await page.evaluate(()=>__test62.state.cache.get(__test62.curName()).isBoxed)).toBe(true);
  await page.waitForFunction(()=>!XunjianDesktop.busy());await page.locator('#btnToggleBoxedView').click();await page.waitForFunction(()=>!__test62.state.cache.get(__test62.curName()).isBoxed&&!XunjianDesktop.busy());
  // Repeat ordinary save updates the same pair. Secondary save retains the original collision strategy.
  expect(await save(page)).toBe(true);expect(await fs.readdir(path.join(f.output,'大图'))).toHaveLength(1);
  await page.evaluate(()=>__test62.clear());await draw(page,1200,500,1450,750);await choose(page);expect(await save(page)).toBe(true);
  expect((await fs.readdir(path.join(f.output,'大图'))).sort()).toEqual([name,name.replace('.jpg','（2）.jpg')].sort());
  const id=await page.evaluate(()=>XunjianDesktop.currentId());
  let groups=await page.evaluate(id=>XunjianDesktop.listOutputGroups(id),id);expect(groups).toHaveLength(2);
  await page.evaluate(async({id,g})=>XunjianDesktop.deleteOutputGroup(id,g.key,g.paths),{id,g:groups[1]});
  const trash=await page.evaluate(()=>XunjianDesktop.listTrash());expect(trash).toHaveLength(1);expect(trash[0].count).toBe(3);
  await page.evaluate(id=>XunjianDesktop.restoreOutput(id),trash[0].id);expect(await page.evaluate(id=>XunjianDesktop.listOutputGroups(id),id)).toHaveLength(2);
  // External removal is reconciled; no migration/removal of unrelated legacy directories.
  await fs.mkdir(path.join(f.output,'缺陷圈示图'),{recursive:true});await fs.writeFile(path.join(f.output,'缺陷圈示图','unmatched.jpg'),f.image);
  await fs.unlink(path.join(f.output,'小图',name));await page.evaluate(()=>XunjianDesktop.refresh(true));
  groups=await page.evaluate(id=>XunjianDesktop.listOutputGroups(id),id);expect(groups.some(g=>g.paths.length===2)).toBe(true);
  await fs.unlink(path.join(f.output,'大图',name));await fs.unlink(path.join(f.output,'原图',name));await page.waitForFunction(id=>(__test62.state.markedCounts.get(id)||0)===1&&!XunjianDesktop.busy(),id);
  expect(await page.evaluate(id=>XunjianDesktop.listOutputGroups(id),id)).toHaveLength(1);
  expect(await fs.readFile(path.join(f.output,'缺陷圈示图','unmatched.jpg'))).toEqual(f.image);
  expect(f.errors).toEqual([]);
 }finally{await cleanup(f);}
});

test('T10–12 and performance: light previews, on-demand full bitmap, preloading, bounded cache, undo and per-photo crop',async()=>{
 test.setTimeout(180000);
 const f=await fixture({count:96}),{page}=f;
 try{
  const preview=await page.evaluate(()=>{const c=__test62.state.cache.get(__test62.curName());return {w:c.previewBitmap.width,h:c.previewBitmap.height,full:!!c.fullBitmap};});
  expect(Math.max(preview.w,preview.h)).toBe(1440);expect(preview.full).toBe(false);
  await page.evaluate(()=>__test62.preload(__test62.state.index,1)); // Resume after the fixture's initial directory synchronization.
  await page.waitForFunction(()=>__test62.state.cache.size>1); // Original adjacent-image preloading.
  await draw(page,100,200,500,500);await draw(page,2100,700,2700,1100);
  await page.locator('#cropTarget').selectOption('0');await page.locator('#cropMargin').evaluate(e=>{e.value='90';e.dispatchEvent(new Event('input'));});
  await page.evaluate(()=>{const s=__test62.state;s.view.zoom=6;__test62.render();__test62.detail();});
  await page.waitForFunction(()=>!!__test62.state.cache.get(__test62.curName()).fullBitmap);
  expect(await page.evaluate(()=>__test62.state.cache.get(__test62.curName()).fullBitmap.width)).toBe(4096);
  await page.evaluate(()=>{__test62.trim();});expect(await page.evaluate(()=>!!__test62.state.cache.get(__test62.curName()).fullBitmap)).toBe(false);
  // Switch using forced navigation to exercise unsaved drafts without handling its existing confirmation dialog.
  await page.evaluate(()=>__test62.switchTo(1,true));expect(await page.evaluate(()=>__test62.currentCrop())).toBe(null);
  await page.evaluate(()=>__test62.switchTo(0,true));expect((await page.evaluate(()=>__test62.currentCrop())).target).toBe(0);
  await page.evaluate(()=>__test62.undo());expect(await page.evaluate(()=>__test62.getMeta(__test62.curName()).boxes.length)).toBe(1);
  await page.evaluate(()=>__test62.del());expect(await page.evaluate(()=>__test62.currentCrop())).toBe(null);
  const traversed=await page.evaluate(async()=>{let ok=0;for(let i=0;i<32;i++)if(await __test62.switchTo(i,true))ok++;return ok;});expect(traversed).toBe(32);
  const memory=await page.evaluate(()=>{__test62.evict(__test62.state.index);return {size:__test62.state.cache.size,bytes:[...__test62.state.cache.values()].reduce((n,c)=>n+(c.previewBitmap?c.previewBitmap.width*c.previewBitmap.height*4:0),0),budget:__test62.cacheBytes,full:[...__test62.state.cache.values()].filter(c=>c.fullBitmap).length,rows:document.querySelectorAll('#pathTree .loc-item').length};});
  expect(memory.bytes).toBeLessThanOrEqual(memory.budget);expect(memory.size).toBeLessThanOrEqual(32);expect(memory.full).toBeLessThanOrEqual(1);expect(memory.rows).toBeLessThanOrEqual(60);
  const bounded=await page.evaluate(async()=>{const t=__test62,s=t.state,source=s.cache.get(t.curName()).previewBitmap;let released=0;
   for(let i=0;i<36;i++){const bitmap=await createImageBitmap(source);const item={img:{naturalWidth:4096,naturalHeight:2048,bitmap},previewBitmap:bitmap,fullBitmap:null,blob:new Blob(),used:i};s.cache.set('eviction-'+i,item);}
   t.evict(s.index);return {size:s.cache.size,bytes:[...s.cache.values()].reduce((n,c)=>n+(c.previewBitmap?c.previewBitmap.width*c.previewBitmap.height*4:0),0),budget:t.cacheBytes};
  });expect(bounded.size).toBeLessThanOrEqual(32);expect(bounded.bytes).toBeLessThanOrEqual(bounded.budget);
  const virtual=await page.evaluate(()=>{const t=__test62,s=t.state,f=s.files[0];s.files=Array.from({length:5000},(_,i)=>Object.assign({},f,{id:'virtual-'+i,relPath:'10kV测试线/主线/#001/DJI_'+i+'.jpg',name:'DJI_'+i+'.jpg'}));s.byName=new Map(s.files.map(f=>[f.id,f]));s.indexByName=new Map(s.files.map((f,i)=>[f.id,i]));s.index=0;t.fast.invalidate();t.tree.invalidate();t.tree.rebuild(false);return document.querySelectorAll('#pathTree .loc-item').length;});expect(virtual).toBeLessThan(60);
  expect(f.errors).toEqual([]);
 }finally{await cleanup(f);}
});

test('preserve all 11 themes, dark mode, original keyboard shortcuts and reduced motion controls',async()=>{
 const f=await fixture(),{page}=f;
 try{
  await page.locator('#btnSettings').click();
  const themes=await page.locator('#themeSelect option').evaluateAll(es=>es.map(e=>e.value));expect(themes).toHaveLength(11);
  for(const value of themes){await page.locator('#themeSelect').selectOption(value);if(value!=='light')await expect(page.locator('body')).toHaveClass(new RegExp('theme-'+value));}
  await page.emulateMedia({reducedMotion:'reduce'});expect(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await page.locator('#themeSelect').selectOption('light');await page.locator('#themeSwitch').click();await expect(page.locator('body')).toHaveClass(/dark/);
  await page.locator('#btnCloseSettings').click();await page.keyboard.press('d');await page.waitForFunction(()=>__test62.state.index===1&&!__test62.state.navBusy);await page.keyboard.press('a');await page.waitForFunction(()=>__test62.state.index===0&&!__test62.state.navBusy);
  expect(f.errors).toEqual([]);
 }finally{await cleanup(f);}
});

test('T16: third-file write failure rolls back all three outputs and does not report success',async()=>{
 const f=await fixture(),{page}=f;
 try{
  await draw(page,500,500,900,900);await choose(page);expect(await save(page)).toBe(true);
  const before=JSON.parse(await fs.readFile(path.join(f.output,'.xunjian-output-v1.json'))),name=before.records[0].path;
  const large=await fs.readFile(path.join(f.output,'大图',name)),small=await fs.readFile(path.join(f.output,'小图',name)),raw=await fs.readFile(path.join(f.output,'原图',name));
  await f.app.evaluate(()=>{const s=global.testService,original=s.call.bind(s);let armed=true;s.call=async(op,args)=>{if(armed&&op==='commit'){const w=s.writers.get(args.id);if(w&&w.h.rel.startsWith('原图/')){armed=false;throw Object.assign(new Error('Synthetic disk write failure'),{code:'ENOSPC'});}}return original(op,args);};});
  await page.locator('#cropMargin').evaluate(e=>{e.value='100';e.dispatchEvent(new Event('input'));});expect(await save(page)).toBe(false);
  expect(await fs.readFile(path.join(f.output,'大图',name))).toEqual(large);expect(await fs.readFile(path.join(f.output,'小图',name))).toEqual(small);
  expect(await fs.readFile(path.join(f.output,'原图',name))).toEqual(raw);
  expect(JSON.parse(await fs.readFile(path.join(f.output,'.xunjian-output-v1.json'))).records).toEqual(before.records);
  await expect(page.locator('#queuePanel48')).toHaveAttribute('open','');
  expect(f.errors).toEqual([]);
 }finally{await cleanup(f);}
});


test('T11, T14: portrait EXIF orientation, zoom/pan, edge frame and original-resolution export',async()=>{
 const f=await fixture(),{page}=f;
 try{
  const bytes=await page.evaluate(async()=>{const f=__test62.state.files[0],blob=await f.handle.getFile(),bmp=await createImageBitmap(blob),cv=document.createElement('canvas');cv.width=bmp.width;cv.height=bmp.height;cv.getContext('2d').drawImage(bmp,0,0);bmp.close();const jpg=await new Promise(r=>cv.toBlob(r,'image/jpeg',.95));cv.width=cv.height=1;return Array.from(new Uint8Array(await jpg.arrayBuffer()));});
  const jpeg=Buffer.from(bytes),exif=Buffer.from('ffe100224578696600004d4d002a00000008000101120003000000010006000000000000','hex');
  const portrait=Buffer.concat([jpeg.subarray(0,2),exif,jpeg.subarray(2)]),source=path.join(f.input,'DJI_PORTRAIT_V.jpg');await fs.writeFile(source,portrait);
  await page.evaluate(()=>XunjianDesktop.refresh(true));
  await page.evaluate(()=>__test62.switchTo(__test62.state.files.findIndex(f=>f.name==='DJI_PORTRAIT_V.jpg'),true));
  expect(await page.evaluate(()=>__test62.state.natural)).toEqual({w:2048,h:4096});
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:2,mobile:false});await page.waitForFunction(()=>devicePixelRatio===2);
  await draw(page,1850,3700,2035,4060);await choose(page,'_绝缘子-脱落-危急');
  let first=await page.evaluate(()=>__test62.currentCrop());expect(first.x+first.w).toBeLessThanOrEqual(2048);expect(first.y+first.h).toBeLessThanOrEqual(4096);
  await page.evaluate(()=>{const v=__test62.state.view;v.zoom=1.2;v.panX=(v.cx-1942*v.s)*v.zoom;v.panY=(v.cy-3880*v.s)*v.zoom;__test62.render();});
  expect(await page.evaluate(()=>__test62.currentCrop())).toEqual(first);
  await draw(page,1942,3880,1742,3680);const moved=await page.evaluate(()=>__test62.currentCrop());expect(moved.x).toBeLessThan(first.x);first=moved;
  expect(await save(page)).toBe(true);
  const doc=JSON.parse(await fs.readFile(path.join(f.output,'.xunjian-output-v1.json')));expect(doc.records).toHaveLength(3);expect(doc.records[0].exportCrop62).toEqual(first);const name=doc.records[0].path;
  const dims=await page.evaluate(async name=>{const root=XunjianDesktop.roots().output,out=[];for(const folder of ['大图','小图']){const file=await(await(await root.getDirectoryHandle(folder)).getFileHandle(name)).getFile(),bmp=await createImageBitmap(file);out.push([bmp.width,bmp.height]);bmp.close();}return out;},name);
  expect(dims).toEqual([[2048,4096],[first.w,first.h]]);expect(await fs.readFile(source)).toEqual(portrait);expect(await fs.readFile(path.join(f.output,'原图',name))).toEqual(portrait);expect(f.errors).toEqual([]);
 }finally{await cleanup(f);}
});



test('50.4.1: restored old directory handles retain ancestors and background synchronization disables the save control',async()=>{
 const f=await fixture(),{page}=f;
 try{
  const described=await page.evaluate(async()=>{const h=XunjianDesktop.roots().input;delete h.sourcePath;return DesktopFS.call('describe',{h});});expect(described.sourcePath).toContain('原始照片');
  await draw(page,500,500,950,950);await choose(page);
  await f.app.evaluate(()=>{const service=global.testService,original=service.call.bind(service);let armed=true;service.call=async(op,args)=>{if(armed&&op==='snapshot'){armed=false;await new Promise(resolve=>{global.releaseSnapshot=resolve;});}return original(op,args);};});
  const refreshing=page.evaluate(()=>XunjianDesktop.refresh(true));
  refreshing.catch(()=>{}); // Preserve the original assertion if cleanup closes a pending evaluation.
  await page.waitForFunction(()=>document.body.classList.contains('io-busy'));
  await expect(page.locator('#btnBottomSave')).toBeDisabled();await expect(page.locator('#btnBottomSave')).toContainText('同步');
  await f.app.evaluate(async()=>{const until=Date.now()+10000;while(typeof global.releaseSnapshot!=='function'){if(Date.now()>until)throw Error('Synthetic snapshot pause was not reached');await new Promise(r=>setTimeout(r,10));}global.releaseSnapshot();});await refreshing;
  await expect(page.locator('#btnBottomSave')).toBeEnabled();await page.locator('#btnBottomSave').click();
  await page.waitForFunction(()=>__test62.busyDetail().queue.completed===1&&!XunjianDesktop.busy());
  expect((await fs.readdir(f.output)).filter(n=>!n.startsWith('.')).sort()).toEqual(['原图','大图','小图']);expect(f.errors).toEqual([]);
 }finally{await cleanup(f);}
});

test('50.4.1: two-file historical groups are readable, removable, restorable, and receive an original only on explicit save',async()=>{
 const f=await fixture(),{page}=f;
 try{
  await draw(page,800,600,1200,1000);await choose(page);expect(await save(page)).toBe(true);
  const index=path.join(f.output,'.xunjian-output-v1.json'),doc=JSON.parse(await fs.readFile(index)),name=doc.records[0].path;
  await fs.unlink(path.join(f.output,'原图',name));await fs.rmdir(path.join(f.output,'原图'));doc.records=doc.records.filter(r=>r.dir!=='原图');doc.revision++;await fs.writeFile(index,JSON.stringify(doc));
  await page.evaluate(()=>XunjianDesktop.refresh(true));const id=await page.evaluate(()=>XunjianDesktop.currentId());let groups=await page.evaluate(id=>XunjianDesktop.listOutputGroups(id),id);expect(groups).toHaveLength(1);expect(groups[0].paths).toHaveLength(2);
  expect(await fs.readdir(f.output)).not.toContain('原图');
  await page.evaluate(({id,g})=>XunjianDesktop.deleteOutputGroup(id,g.key,g.paths),{id,g:groups[0]});const trash=await page.evaluate(()=>XunjianDesktop.listTrash());expect(trash[0].count).toBe(2);
  await page.evaluate(id=>XunjianDesktop.restoreOutput(id),trash[0].id);expect(await fs.readdir(f.output)).not.toContain('原图');
  expect(await save(page)).toBe(true);expect(await fs.readFile(path.join(f.output,'原图',name))).toEqual(f.image);expect(f.errors).toEqual([]);
 }finally{await cleanup(f);}
});

test('50.4.1: non-JPEG remains browsable and is never disguised or re-encoded as an untouched JPG original',async()=>{
 const f=await fixture({png:true}),{page}=f;
 try{await draw(page,500,500,950,950);await choose(page);expect(await save(page)).toBe(false);await expect(page.locator('#toast')).toContainText('JPG/JPEG');expect((await fs.readdir(f.output)).filter(n=>!n.startsWith('.'))).toEqual([]);expect(f.errors).toEqual([]);}finally{await cleanup(f);}
});
