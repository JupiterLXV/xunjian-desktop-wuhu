const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const core=require('../../app/wuhu-core.js'),rules=require('../../app/wuhu-rules.json');
test('T01–03: all canonical rules, duplicate severities and UI-only notes match the guide',()=>{
 const table=fs.readFileSync('docs/IMPLEMENTATION_GUIDE_v1.0.md','utf8').split('\n').filter(s=>s.startsWith('| ')).map(s=>s.split('|').slice(1,-1).map(v=>v.trim())).filter(c=>c.length===4&&['一般','严重','危急'].includes(c[2]));
 assert.deepEqual(rules,table.map(([component,description,severity,note])=>({...{component,description,severity},...(note==='—'?{}:{note})})));
 assert.equal(rules.length,45);assert.equal(new Set(rules.map(core.tag)).size,45);
 assert.equal(Object.keys(core.dictionary(rules)).length,14);
 assert.deepEqual(['一般','严重','危急'].map(s=>rules.filter(r=>r.severity===s).length),[13,22,10]);
 assert.deepEqual(rules.filter(r=>r.component==='柱上开关'&&r.description==='鸟巢').map(r=>r.severity),['严重','危急']);
 assert.equal(rules.filter(r=>r.note).length,3);
 for(const r of rules.filter(r=>r.note))assert.ok(!core.filename({line:'线路',branch:'主线',pole:'#001'},r).includes(r.note));
});
test('T04–05: directory-only metadata works across Windows drive, mapped drive, UNC and selected subdirectories',()=>{
 const expected={line:'10kV枫墩188线',branch:'良久支线',pole:'#001',valid:true};
 for(const full of ['D:\\原始照片\\10kV枫墩188线\\良久支线\\#001\\DJI_20260724_0024_T.jpg','Z:/10kV枫墩188线/良久支线/#001/9999.jpg','\\\\服务器\\共享\\10kV枫墩188线\\良久支线\\#001\\photo_V.jpg'])assert.deepEqual(core.parseLocation(full),expected);
 assert.deepEqual(core.parseLocation('良久支线/#001/camera.jpg','E:/原始照片/10kV枫墩188线'),expected);
 assert.deepEqual(core.parseLocation('camera.jpg','E:/原始照片/10kV枫墩188线/良久支线/#001'),expected);
 assert.equal(core.parseLocation('DJI_20260724131310_0024_V.jpg','C:/照片').valid,false);
 assert.equal(core.parseLocation('10kV枫墩188线/主线/#003/a.jpg').branch,'主线');
 assert.equal(core.filename({...expected},rules.find(r=>r.component==='横担端U型挂板'&&r.description==='螺母松动')),'10kV枫墩188线-良久支线-#001-横担端U型挂板-螺母松动-严重.jpg');
 assert.throws(()=>core.filename({line:'',branch:'',pole:''},rules[0]));
});
test('T07–13: local crops preserve targets, avoid far-away frames, merge nearby frames and stay inside image bounds',()=>{
 const frames=[{x:40,y:100,w:80,h:100},{x:700,y:300,w:200,h:180},{x:710,y:500,w:160,h:70}];
 let r=core.crop(frames,1200,800);assert.equal(r.target,1);assert.ok(r.x>120);assert.ok(r.y+r.h>=570);
 r=core.crop(frames,1200,800,{target:0,margin:.1});assert.equal(r.target,0);assert.ok(r.x+r.w<700);
 assert.equal(core.crop([],1000,1000),null);assert.equal(core.crop([{x:NaN,y:0,w:10,h:10}],1000,1000),null);
 let seed=31;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
 for(let i=0;i<500;i++){
  const w=200+Math.floor(random()*6000),h=200+Math.floor(random()*6000),box={x:random()*(w-100),y:random()*(h-100),w:20+random()*80,h:20+random()*80};
  r=core.crop([box],w,h,{margin:random()*1.5});
  assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=w&&r.y+r.h<=h);
  assert.ok(r.x<=box.x&&r.y<=box.y&&r.x+r.w>=box.x+box.w&&r.y+r.h>=box.y+box.h);
 }
});
