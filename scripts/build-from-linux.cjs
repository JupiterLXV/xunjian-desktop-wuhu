// Cross build only. This does not substitute for the native Windows Actions tests.
// The pinned builder normally runs a temporary EXE to obtain its uninstaller.
// Its own UninstallerReader can instead extract that PE without executing Windows code.
// This build-only adapter does not change dependencies on disk or touch the application.
const {build,Platform,Arch}=require('electron-builder');
const path=require('node:path');
const {WineVmManager}=require('app-builder-lib/out/vm/WineVm');
const {UninstallerReader}=require('app-builder-lib/out/targets/nsis/nsisUtil');
const config=require('../package.json').build;
const original=WineVmManager.prototype.exec;
const expected=path.resolve('dist','Xunjian-Wuhu-Setup-'+require('../package.json').version+'-x64.exe');
WineVmManager.prototype.exec=async function(file,args,options){
  if(path.resolve(file)!==expected||args.length)throw Error('Unexpected Windows execution request during cross build');
  const output=path.join(path.dirname(file),path.basename(file,'exe')+'__uninstaller.exe');
  await UninstallerReader.exec(file,output);
  console.log('Extracted actual NSIS uninstaller using electron-builder UninstallerReader (no Wine execution).');
};
build({targets:Platform.WINDOWS.createTarget(['nsis'],Arch.x64),config,publish:'never'})
  .catch(e=>{console.error(e);process.exitCode=1;})
  .finally(()=>{WineVmManager.prototype.exec=original;});
