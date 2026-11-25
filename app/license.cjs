'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const PRODUCT='xunjian-desktop',MAX_LICENSE=16384;
function machineCode(identity){return 'XJ1-'+crypto.createHash('sha256').update(PRODUCT+'\0'+identity.trim().toLowerCase()).digest('hex').toUpperCase().match(/.{8}/g).join('-');}
async function readMachineCode(){
 let identity;
 if(process.platform==='win32'){
  const reg=path.join(process.env.SystemRoot||'C:\\Windows','System32','reg.exe');
  const {stdout}=await promisify(execFile)(reg,['query','HKLM\\SOFTWARE\\Microsoft\\Cryptography','/v','MachineGuid','/reg:64'],{windowsHide:true,timeout:10000,maxBuffer:65536});
  const match=stdout.match(/MachineGuid\s+REG_SZ\s+([a-f\d-]+)/i);
  if(!match||!/^\{?[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}\}?$/i.test(match[1]))throw Error('无法读取本机标识，请检查系统注册表读取权限后重新打开。');
  identity='windows:'+match[1];
 }else if(process.platform==='linux')identity='linux:'+await fs.readFile('/etc/machine-id','utf8');
 else throw Error('此授权版仅支持 Windows 电脑。');
 return machineCode(identity);
}
function verifyLicense(text,publicKey,machine){
 if(typeof text!=='string'||Buffer.byteLength(text)>MAX_LICENSE)throw Error('授权文件格式无效或过大。');
 let envelope;try{envelope=JSON.parse(text);}catch{throw Error('授权文件不是有效的 JSON。');}
 if(envelope?.format!=='xunjian-license-v1'||typeof envelope.payload!=='string'||typeof envelope.signature!=='string'||!/^[-_A-Za-z0-9]+$/.test(envelope.payload)||!/^[-_A-Za-z0-9]+$/.test(envelope.signature))throw Error('授权文件格式无效。');
 const payload=Buffer.from(envelope.payload,'base64url');
 if(!crypto.verify('sha256',payload,publicKey,Buffer.from(envelope.signature,'base64url')))throw Error('授权签名无效，请使用管理者签发的原始授权文件。');
 let data;try{data=JSON.parse(payload.toString('utf8'));}catch{throw Error('授权内容无效。');}
 if(data.version!==1||data.product!==PRODUCT||data.type!=='perpetual'||typeof data.licenseId!=='string'||!data.licenseId||typeof data.holder!=='string'||data.holder.length>120||!Number.isFinite(Date.parse(data.issuedAt)))throw Error('授权内容不适用于本程序。');
 if(data.machine!==machine)throw Error('此授权属于另一台电脑，请提供本机机器码重新申请。');
 return data;
}
class LicenseManager{
 constructor(directory,publicKey,getMachine=readMachineCode){this.directory=directory;this.publicKey=publicKey;this.getMachine=getMachine;this.active=null;this.machine='';this.error='';}
 async init(){
  try{this.machine=await this.getMachine();}catch(e){this.error=e.message;return;}
  try{this.active=verifyLicense(await fs.readFile(path.join(this.directory,'license.xjlic'),'utf8'),this.publicKey,this.machine);}catch(e){if(e.code!=='ENOENT')this.error=e.message;}
 }
 status(){return {active:!!this.active,machine:this.machine,error:this.error,holder:this.active?.holder||'',licenseId:this.active?.licenseId||'',type:this.active?'perpetual':null};}
 requireActive(){if(!this.active)throw Object.assign(Error('请先导入本机授权文件。'),{name:'NotAllowedError'});}
 async activate(text){
  if(!this.machine)throw Error(this.error||'本机标识不可用。');
  const data=verifyLicense(text,this.publicKey,this.machine);await fs.mkdir(this.directory,{recursive:true});
  const tmp=path.join(this.directory,'.license-'+crypto.randomUUID()+'.tmp');
  try{const h=await fs.open(tmp,'wx',0o600);try{await h.writeFile(text);await h.sync();}finally{await h.close();}await fs.rename(tmp,path.join(this.directory,'license.xjlic'));}catch(e){await fs.unlink(tmp).catch(()=>{});throw e;}
  this.active=data;this.error='';return this.status();
 }
}
module.exports={LicenseManager,verifyLicense,machineCode,readMachineCode,MAX_LICENSE};
