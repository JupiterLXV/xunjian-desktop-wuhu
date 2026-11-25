const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path');
for(const p of ['app','scripts','tests']){
 const walk=d=>{for(const f of fs.readdirSync(d,{withFileTypes:true})){const n=path.join(d,f.name);if(f.isDirectory())walk(n);else if(/\.(c?js)$/.test(n))cp.execFileSync(process.execPath,['--check',n],{stdio:'inherit'});}};walk(p);
}
for(const p of ['package.json','app/wuhu-rules.json'])JSON.parse(fs.readFileSync(p,'utf8'));
console.log('JavaScript syntax and JSON validation passed');
