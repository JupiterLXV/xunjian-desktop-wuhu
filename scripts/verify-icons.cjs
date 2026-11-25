'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(Buffer.from(b)).digest('hex');
async function verifyIcons(files){
 const R=await import('resedit'),ico=R.Data.IconFile.from(fs.readFileSync('app/icon.ico'));
 const expected=new Set(ico.icons.map(i=>hash(i.data.bin||i.data.generate())));
 const source=hash(fs.readFileSync('app/icon.png')),baseline=require('../docs/performance-baseline.json').unchangedFiles['app/icon.png'];
 if(source!==baseline)throw Error('Original 50.3.1 PNG logo changed');
 const rows=[];
 for(const file of files){
  const pe=R.NtExecutable.from(fs.readFileSync(file),{ignoreCert:true}),resources=R.NtExecutableResource.from(pe),groups=R.Resource.IconGroupEntry.fromEntries(resources.entries);
  if(!groups.length)throw Error('Missing Windows icon group: '+file);
  for(const group of groups){
   const icons=group.getIconItemsFromEntries(resources.entries);
   if(!icons.length||icons.some(i=>!expected.has(hash(i.bin||i.generate()))))throw Error('Unexpected/default icon in '+file+' group '+group.id);
  }
  rows.push({file,groups:groups.length,sizes:groups[0].icons.map(i=>i.width||256)});
 }
 return rows;
}
module.exports={verifyIcons};
if(require.main===module)verifyIcons(process.argv.slice(2)).then(rows=>console.log(JSON.stringify({originalLogoVerified:true,executables:rows},null,2))).catch(e=>{console.error(e);process.exitCode=1});
