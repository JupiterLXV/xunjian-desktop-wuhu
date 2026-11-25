'use strict';
const $=id=>document.getElementById(id);async function call(op){const r=await desktopAPI.invoke(op);if(!r.ok)throw Error(r.error.message);return r.value;}
function message(text,error=false){$('status').textContent=text;$('status').className=error?'error':'';}
(async()=>{try{const s=await call('license-status');$('machine').value=s.machine||'机器码读取失败';$('copy').disabled=!s.machine;$('activate').disabled=!s.machine;message(s.error||'等待导入本机授权文件。',!!s.error);}catch(e){message(e.message,true);}})();
$('copy').onclick=async()=>{try{await call('license-copy');message('机器码已复制，请发给管理者。');}catch(e){message(e.message,true);}};
$('activate').onclick=async()=>{$('activate').disabled=true;try{const r=await call('license-import');message(r?'授权成功，正在进入程序…':'已取消选择。');}catch(e){message(e.message,true);}finally{$('activate').disabled=false;}};
