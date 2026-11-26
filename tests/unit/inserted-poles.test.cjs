const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../../app/wuhu-core.js'),blocks=require('../source-blocks.cjs');
test('inserted poles retain + and leading zeros across local, UNC and selected-root paths and six-field names',()=>{
 for(const pole of ['#088+1','#088+2','#088+3','#088+10','88+1','88+2','#088','#088-1','#088_2','#088~3','#088A','#088+1号杆']){
  const expected={line:'10kV测试线',branch:'主线',pole,valid:true};
  for(const full of ['D:\\照片\\10kV测试线\\主线\\'+pole+'\\DJI_0000_V.JPG','\\\\NAS\\照片\\10kV测试线\\主线\\'+pole+'\\DJI_0000_V.JPG'])assert.deepEqual(core.parseLocation(full),expected);
  assert.deepEqual(core.parseLocation('主线/'+pole+'/DJI_0000_V.JPG','Z:/照片/10kV测试线'),expected);
  assert.deepEqual(core.parseLocation('DJI_0000_V.JPG','Z:/照片/10kV测试线/主线/'+pole),expected);
  assert.equal(core.filename(expected,{component:'绝缘子',description:'脱落',severity:'严重'}),'10kV测试线-主线-'+pole+'-绝缘子-脱落-严重.jpg');
 }
 for(const pole of ['#088+','#088++1','#088+1x','#088+1.5','DJI_88+1_V'])assert.equal(core.parseLocation('D:/照片/10kV测试线/主线/'+pole+'/photo.jpg').valid,false,pole);
 assert.equal(core.parseLocation('DJI_88+1_V.jpg','D:/照片').valid,false);
});
test('existing renderer sorts inserted poles numerically and keeps every inserted pole distinct',()=>{
 const source=blocks(fs.readFileSync('app/renderer.js','utf8'));
 const parse=vm.runInNewContext('('+source.get('_rawParseFilePrefixAndLocation')+')',{sourceLocation62:p=>core.parseLocation(p)});
 const compare=vm.runInNewContext('('+source.get('comparePhotos')+')',{parseFilePrefixAndLocation:parse,naturalCollator48:new Intl.Collator('zh-CN',{numeric:true,sensitivity:'base'}),dirOf:p=>p.slice(0,p.lastIndexOf('/'))});
 const expected=['#087','#088','#088+1','#088+2','#088+3','#088+10','#089'];
 const files=expected.slice().reverse().map(pole=>({name:'DJI_0000_V.jpg',relPath:'10kV测试线/主线/'+pole+'/DJI_0000_V.jpg'}));
 files.sort(compare);assert.deepEqual(files.map(f=>parse(f.name,f.relPath).tower),expected);
 assert.equal(new Set(files.map(f=>parse(f.name,f.relPath).tower)).size,7);
});
