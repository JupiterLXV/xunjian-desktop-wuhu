const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktopAPI',{
 invoke:(op,args)=>ipcRenderer.invoke('desktop:request',op,args),
 onFilesChanged:fn=>ipcRenderer.on('desktop:files-changed',()=>fn()),
 onProgress:fn=>ipcRenderer.on('desktop:progress',(_event,progress)=>fn(progress)),
 onAction:fn=>ipcRenderer.on('desktop:action',(_event,action)=>fn(action)),
 closeReady:result=>ipcRenderer.send('desktop:close-ready',result),
 onClose:fn=>ipcRenderer.on('desktop:prepare-close',()=>fn())
});
