const { test, expect, _electron } = require('@playwright/test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { PNG } = require('pngjs');
const jpeg = require('jpeg-js');
const linuxArgs = process.platform === 'linux' ? ['--no-sandbox', '--ozone-platform=headless', '--disable-gpu'] : [];

function makeJpeg() {
  const png = new PNG({ width: 120, height: 90 });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 50; png.data[i + 1] = 90; png.data[i + 2] = 140; png.data[i + 3] = 255;
  }
  return jpeg.encode(png, 85).data;
}

test('export report button opens dialog, auto-detects line name, and exports Word report', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'xj-report-ui-'));
  const userDir = path.join(dir, 'profile');
  const outDir = path.join(dir, '成果');
  await fs.mkdir(path.join(outDir, '大图'), { recursive: true });
  await fs.mkdir(path.join(outDir, '小图'), { recursive: true });
  const defectName = '10kV测试线-主线-#001-横担-变形-严重.jpg';
  const img = makeJpeg();
  await fs.writeFile(path.join(outDir, '大图', defectName), img);
  await fs.writeFile(path.join(outDir, '小图', defectName), img);

  const app = await _electron.launch({
    args: [...linuxArgs, 'tests/fixture/production-main.cjs'],
    env: { ...process.env, XUNJIAN_TEST_DIR: userDir },
  });
  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => !!window.XunjianDesktop && !!document.getElementById('desktopExportReport'));
    await page.locator('#noticeClose').click();

    const btn = page.locator('#desktopExportReport');
    await expect(btn).toBeVisible();
    await btn.click();

    const dialog = page.locator('dialog.report-dialog');
    await expect(dialog).toBeVisible();

    await page.locator('#reportDirInput').fill(outDir);
    await page.locator('#reportDirInput').dispatchEvent('change');
    await expect(page.locator('.report-detected')).toContainText('10kV测试线');

    await page.locator('.report-actions button', { hasText: '仅导出 Word 报告' }).click();
    await expect(page.locator('.report-result')).toBeVisible();
    await expect(page.locator('.report-result-path')).toContainText('10kV测试线无人机技术监督巡视分析报告.docx');
    const logColors = await page.locator('.report-log').evaluate(el => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, color: s.color };
    });
    expect(logColors.bg).not.toBe(logColors.color);
    expect(logColors.bg).toBe('rgb(255, 255, 255)');
    const docxStat = await fs.stat(path.join(outDir, '10kV测试线无人机技术监督巡视分析报告.docx'));
    expect(docxStat.size).toBeGreaterThan(3000);
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await app.close().catch(() => {});
    await fs.rm(dir, { recursive: true, force: true });
  }
});
