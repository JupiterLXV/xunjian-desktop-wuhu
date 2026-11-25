'use strict';
(function () {
  if (!window.desktopAPI) return;

  const topRight = document.querySelector('.toolbar-top-right');
  const settingsBtn = document.getElementById('btnSettings');
  if (!topRight || !settingsBtn) return;

  const exportBtn = document.createElement('button');
  exportBtn.id = 'desktopExportReport';
  exportBtn.type = 'button';
  exportBtn.className = 'btn';
  exportBtn.title = '提取可见光坐标并导出 Word 巡检缺陷报告';
  exportBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" style="display:block"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/></svg><span>导出报告</span>';
  settingsBtn.before(exportBtn);

  let activeDialog = null;
  let running = false;

  async function invoke(op, args) {
    const r = await desktopAPI.invoke(op, args);
    if (!r.ok) throw new Error(r.error?.message || '操作失败');
    return r.value;
  }

  function makeEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  async function openReportDialog() {
    if (activeDialog) {
      activeDialog.focus();
      return;
    }

    const d = document.createElement('dialog');
    d.className = 'desktop-dialog report-dialog';

    const header = makeEl('header');
    const title = makeEl('strong', '', '导出巡检报告');
    const closeBtn = makeEl('button', 'btn', '关闭');
    closeBtn.type = 'button';
    header.append(title, closeBtn);

    const status = makeEl('p', 'desktop-dialog-status', '就绪');
    status.setAttribute('role', 'status');

    const body = makeEl('div', 'desktop-dialog-body');
    const form = makeEl('div', 'report-form');

    function makeFieldRow(id, labelText, placeholder, pickText) {
      const row = makeEl('div', 'report-field');
      const label = makeEl('label', '', labelText);
      label.htmlFor = id;
      const input = makeEl('input');
      input.id = id;
      input.type = 'text';
      input.placeholder = placeholder;
      const btn = makeEl('button', 'btn', pickText);
      btn.type = 'button';
      row.append(label, input, btn);
      return { row, input, btn };
    }

    const reportField = makeFieldRow('reportDirInput', '缺陷成果目录', '包含“大图”“小图”或“线路缺陷图”', '选择目录');
    const photoField = makeFieldRow('reportPhotoInput', '可见光照片目录', '提取经纬度坐标时选择', '选择目录');
    const excelField = makeFieldRow('reportExcelInput', '坐标表格(可选)', '自动识别目录内的 .xls / .xlsx', '选择表格');

    const lineRow = makeEl('div', 'report-field');
    const lineLabel = makeEl('label', '', '识别主线');
    const lineValue = makeEl('div', 'report-detected', '待识别');
    lineRow.append(lineLabel, lineValue);

    form.append(reportField.row, photoField.row, excelField.row, lineRow);

    const actions = makeEl('div', 'report-actions');
    const btnAll = makeEl('button', 'btn solid-primary', '提取坐标并导出报告');
    const btnExtract = makeEl('button', 'btn', '仅提取坐标');
    const btnReport = makeEl('button', 'btn', '仅导出 Word 报告');
    [btnAll, btnExtract, btnReport].forEach(b => { b.type = 'button'; });
    actions.append(btnAll, btnExtract, btnReport);

    const resultBox = makeEl('div', 'report-result');
    resultBox.hidden = true;
    const resultPath = makeEl('div', 'report-result-path');
    const resultBtns = makeEl('div', 'report-result-btns');
    const btnOpenFile = makeEl('button', 'btn', '打开文件');
    const btnRevealDir = makeEl('button', 'btn', '打开所在目录');
    btnOpenFile.type = 'button';
    btnRevealDir.type = 'button';
    resultBtns.append(btnOpenFile, btnRevealDir);
    resultBox.append(resultPath, resultBtns);

    const logBox = makeEl('pre', 'report-log', '');
    body.append(form, actions, resultBox, logBox);
    d.append(header, status, body);
    document.body.appendChild(d);
    activeDialog = d;

    let lastOutputTarget = '';

    function appendLog(line) {
      logBox.textContent += (logBox.textContent ? '\n' : '') + line;
      logBox.scrollTop = logBox.scrollHeight;
    }

    function setBusy(busy) {
      running = busy;
      [btnAll, btnExtract, btnReport, reportField.btn, photoField.btn, excelField.btn, closeBtn].forEach(b => {
        b.disabled = busy;
      });
    }

    async function refreshDetected() {
      try {
        const res = await invoke('report-detect', {
          reportDir: reportField.input.value.trim(),
          photoDir: photoField.input.value.trim(),
          excelPath: excelField.input.value.trim(),
        });
        if (!excelField.input.value.trim() && res.excelPath) {
          excelField.input.value = res.excelPath;
        }
        lineValue.textContent = res.lineName
          ? (res.source ? `${res.lineName}（${res.source}）` : res.lineName)
          : '未识别';
      } catch {
        lineValue.textContent = '未识别';
      }
    }

    closeBtn.onclick = () => { if (!running) d.close(); };
    d.addEventListener('cancel', e => { if (running) e.preventDefault(); });
    d.addEventListener('close', () => {
      if (activeDialog === d) activeDialog = null;
      d.remove();
    });

    reportField.btn.onclick = async () => {
      const picked = await invoke('report-pick-dir', {
        title: '选择缺陷成果目录',
        defaultPath: reportField.input.value.trim() || undefined,
      });
      if (picked?.path) {
        reportField.input.value = picked.path;
        excelField.input.value = '';
        await refreshDetected();
      }
    };

    photoField.btn.onclick = async () => {
      const picked = await invoke('report-pick-dir', {
        title: '选择可见光原始照片目录',
        defaultPath: photoField.input.value.trim() || reportField.input.value.trim() || undefined,
      });
      if (picked?.path) {
        photoField.input.value = picked.path;
        await refreshDetected();
      }
    };

    excelField.btn.onclick = async () => {
      const picked = await invoke('report-pick-excel', {
        defaultPath: excelField.input.value.trim() || reportField.input.value.trim() || undefined,
      });
      if (picked?.path) {
        excelField.input.value = picked.path;
        await refreshDetected();
      }
    };

    reportField.input.addEventListener('change', refreshDetected);
    photoField.input.addEventListener('change', refreshDetected);
    excelField.input.addEventListener('change', refreshDetected);

    btnOpenFile.onclick = async () => {
      if (lastOutputTarget) await invoke('report-open-path', { target: lastOutputTarget, revealOnly: false });
    };
    btnRevealDir.onclick = async () => {
      if (lastOutputTarget) await invoke('report-open-path', { target: lastOutputTarget, revealOnly: true });
    };

    async function runMode(mode) {
      let reportDir = reportField.input.value.trim();
      let photoDir = photoField.input.value.trim();
      const excelPath = excelField.input.value.trim();

      if (!reportDir) {
        const picked = await invoke('report-pick-dir', { title: '请先选择缺陷成果目录' });
        if (!picked?.path) return;
        reportDir = picked.path;
        reportField.input.value = reportDir;
      }

      if ((mode === 'extract' || mode === 'all') && !photoDir) {
        const picked = await invoke('report-pick-dir', {
          title: '请先选择可见光原始照片目录',
          defaultPath: reportDir,
        });
        if (!picked?.path) return;
        photoDir = picked.path;
        photoField.input.value = photoDir;
      }

      resultBox.hidden = true;
      logBox.textContent = '';
      setBusy(true);
      status.textContent = mode === 'extract'
        ? '正在提取可见光坐标…'
        : mode === 'report'
          ? '正在生成 Word 报告…'
          : '正在提取坐标并生成 Word 报告…';

      try {
        const res = await invoke('report-run', { mode, reportDir, photoDir, excelPath });
        if (res.outXlsPath) excelField.input.value = res.outXlsPath;
        await refreshDetected();
        lastOutputTarget = res.outDocxPath || res.outXlsPath || '';
        if (lastOutputTarget) {
          resultPath.textContent = lastOutputTarget;
          btnOpenFile.textContent = res.outDocxPath ? '打开 Word 报告' : '打开 Excel 表格';
          resultBox.hidden = false;
        }
        status.textContent = res.outDocxPath
          ? `完成，已写入 ${res.defectCount || 0} 处缺陷，${res.treeCount || 0} 处树障，${res.geoCount || 0} 条坐标`
          : `完成，已提取 ${res.coordCount || 0} 条杆塔坐标`;
      } catch (e) {
        status.textContent = '执行失败：' + e.message;
        appendLog('[错误] ' + e.message);
      } finally {
        setBusy(false);
      }
    }

    btnAll.onclick = () => runMode('all');
    btnExtract.onclick = () => runMode('extract');
    btnReport.onclick = () => runMode('report');

    d.showModal();

    try {
      const roots = window.XunjianDesktop ? window.XunjianDesktop.roots() : {};
      const defaults = await invoke('report-defaults', {
        inputHandle: roots.input || null,
        outputHandle: roots.output || null,
      });
      if (defaults.reportDir) reportField.input.value = defaults.reportDir;
      if (defaults.photoDir) photoField.input.value = defaults.photoDir;
      if (defaults.excelPath) excelField.input.value = defaults.excelPath;
      lineValue.textContent = defaults.lineName
        ? (defaults.source ? `${defaults.lineName}（${defaults.source}）` : defaults.lineName)
        : '未识别';
    } catch {}

    d._appendReportLog = appendLog;
    d._updateReportProgress = p => {
      if (p.total) status.textContent = `正在写入 Word 报告（${p.completed}/${p.total}）：${p.file}`;
    };
  }

  desktopAPI.onProgress(p => {
    if (!activeDialog || !p) return;
    if (p.kind === 'report-log' && activeDialog._appendReportLog) activeDialog._appendReportLog(p.text);
    if (p.kind === 'report-progress' && activeDialog._updateReportProgress) activeDialog._updateReportProgress(p);
  });

  desktopAPI.onAction(name => {
    if (name === 'export-report') openReportDialog();
  });

  exportBtn.addEventListener('click', openReportDialog);
})();
