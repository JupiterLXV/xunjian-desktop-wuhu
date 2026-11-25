const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),asar=require('@electron/asar');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const archive='dist/win-unpacked/resources/app.asar';
for(const name of asar.listPackage(archive))if(/(?:tests|node_modules|\.xjlic|private.*\.pem)/i.test(name))throw Error('Unexpected packaged file '+name);
for(const name of fs.readdirSync('app')){const p='app/'+name;if(!fs.statSync(p).isFile())continue;if(hash(asar.extractFile(archive,p))!==hash(fs.readFileSync(p)))throw Error('Packaged source mismatch: '+p);}
const packaged=JSON.parse(asar.extractFile(archive,'package.json'));if(packaged.version!==require('../package.json').version)throw Error('Version mismatch');
const artifacts=fs.readdirSync('dist').filter(n=>/^Xunjian-Wuhu-Setup-.*\.exe$/.test(n)).map(n=>{const b=fs.readFileSync(path.join('dist',n));if(b.subarray(0,2).toString()!=='MZ'||b.subarray(b.readUInt32LE(60),b.readUInt32LE(60)+4).toString()!=='PE\0\0')throw Error('Invalid PE executable');return {name:n,size:b.length,sha256:hash(b)};});
if(!artifacts.length)throw Error('Installer missing');
let sourceCommit='uncommitted',sourceDirty=true;try{sourceCommit=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();sourceDirty=!!cp.execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();}catch{}
fs.writeFileSync('dist/build-manifest.json',JSON.stringify({version:packaged.version,sourceCommit,sourceDirty,builtAt:new Date().toISOString(),buildPlatform:process.platform,electron:require('electron/package.json').version,originalAsarSha256:require('../docs/recovery-baseline.json').sha256,packagedAsarSha256:hash(fs.readFileSync(archive)),packagedSourceVerified:true,artifacts},null,2)+'\n');
fs.writeFileSync('dist/SHA256SUMS.txt',artifacts.map(r=>r.sha256+'  '+r.name).join('\n')+'\n');
console.log('Packaged source, version, PE format and artifact checksums verified');
