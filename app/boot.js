'use strict';
(async function () {
  try {
    if (window.desktopAPI) {
      const result = await desktopAPI.invoke('defect-rules');
      if (!result.ok) throw new Error(result.error.message);
      window.WuhuRules = result.value;
    } else window.WuhuRules = await (await fetch('wuhu-rules.json')).json();
    if (!Array.isArray(WuhuRules) || WuhuRules.length !== 45) throw new Error('芜湖缺陷规则配置不完整');
    for (const src of ['renderer.js', 'desktop-ui.js', 'report-ui.js']) await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src; script.onload = resolve; script.onerror = () => reject(new Error('无法加载 ' + src));
      document.body.appendChild(script);
    });
  } catch (e) {
    const message = document.createElement('p');
    message.textContent = '启动失败：' + e.message + '。请重新安装或检查本地配置。';
    document.body.replaceChildren(message);
  }
})();
