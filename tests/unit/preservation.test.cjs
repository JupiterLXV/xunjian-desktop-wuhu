const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const manifest=require('../../docs/performance-baseline.json');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
test('50.3.1 performance algorithms and UI motion/theme blocks remain byte-for-byte identical',()=>{
 const s=fs.readFileSync('app/renderer.js','utf8'),blocks=require('../source-blocks.cjs')(s);
 for(const [name,b]of Object.entries(manifest.blocks)){
  assert.ok(blocks.has(name),name);assert.equal(hash(blocks.get(name)),b.sha256,name+' changed');
 }
 assert.equal(hash(blocks.get('getImage').split('\n    if(c&&c.img')[1]),manifest.getImageCacheBodySha256,'image cache algorithm changed');
 assert.match(s,/edge:1440/);assert.match(s,/var CACHE_BYTES=Math\.max\(48,Math\.min\(96,/);
});
test('all original inline CSS, theme backgrounds, icon and authorization resources are intact',()=>{
 const html=fs.readFileSync('app/index.html','utf8');
 assert.deepEqual([...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>hash(m[1])),manifest.styleHashes);
 for(const [file,expected]of Object.entries(manifest.unchangedFiles))assert.equal(hash(fs.readFileSync(file)),expected,file);
});
