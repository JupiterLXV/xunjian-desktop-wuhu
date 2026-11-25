'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const exifr = require('exifr');
const XLSX = require('xlsx');
const {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} = require('docx');

const naturalCollator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });
const compareNatural = (a, b) => naturalCollator.compare(String(a), String(b));

const GENERIC_DIR_NAMES = new Set([
  '芜湖报告生成',
  '线路缺陷图',
  '小图',
  '大图',
  '原图',
  '可见光',
  '可见光照片',
  '照片',
  '原始照片',
  '巡检照片',
  '数据',
  'wuhu',
]);

const CM_TO_TWIP = 567;
const CM_TO_PX = 96 / 2.54;
const GRID_BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const TABLE_GRID_BORDERS = {
  top: GRID_BORDER,
  bottom: GRID_BORDER,
  left: GRID_BORDER,
  right: GRID_BORDER,
  insideHorizontal: GRID_BORDER,
  insideVertical: GRID_BORDER,
};

function cmToTwips(cm) {
  return Math.round(cm * CM_TO_TWIP);
}

function isJpegName(name) {
  return /\.(jpe?g)$/i.test(String(name || ''));
}

function isInfraredName(name) {
  return /T$/i.test(String(name || '').replace(/\.[^.]+$/, ''));
}

function extractLineFromText(text) {
  const cleaned = String(text || '').trim();
  if (!cleaned) return '';
  const match = cleaned.match(/(\d+\s*kV[^\-\s\\/_]+?线)/i);
  return match ? match[1].replace(/\s+/g, '') : '';
}

function dirExists(p) {
  if (!p) return false;
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function fileExists(p) {
  if (!p) return false;
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function resolveDefectDir(reportDir) {
  if (!dirExists(reportDir)) {
    throw new Error('缺陷成果目录不存在，请重新选择');
  }
  const sub = path.join(reportDir, '线路缺陷图');
  if (dirExists(sub) && (dirExists(path.join(sub, '小图')) || dirExists(path.join(sub, '大图')))) {
    return { defectDir: sub, outputDir: reportDir };
  }
  if (dirExists(path.join(reportDir, '小图')) && dirExists(path.join(reportDir, '大图'))) {
    return { defectDir: reportDir, outputDir: reportDir };
  }
  throw new Error('所选目录中未找到“小图”和“大图”文件夹（或“线路缺陷图”子目录）');
}

function findExcelFile(reportDir, defectDir, explicitExcelPath) {
  if (explicitExcelPath && fileExists(explicitExcelPath)) {
    return explicitExcelPath;
  }
  const searchDirs = [defectDir, reportDir].filter(Boolean);
  for (const dir of searchDirs) {
    if (!dirExists(dir)) continue;
    const files = fs.readdirSync(dir)
      .filter(f => /\.(xlsx?)$/i.test(f) && !f.startsWith('~'))
      .sort(compareNatural);
    if (files.length) return path.join(dir, files[0]);
  }
  return null;
}

function detectLineName(reportDir = '', photoRoot = '', explicitExcelPath = '') {
  if (reportDir && dirExists(reportDir)) {
    const candidates = [
      path.join(reportDir, '线路缺陷图', '小图'),
      path.join(reportDir, '线路缺陷图', '大图'),
      path.join(reportDir, '小图'),
      path.join(reportDir, '大图'),
    ];
    const counts = new Map();
    for (const folder of candidates) {
      if (!dirExists(folder)) continue;
      for (const fname of fs.readdirSync(folder)) {
        if (isJpegName(fname) && fname.includes('-')) {
          const prefix = fname.split('-')[0].trim();
          if (prefix) counts.set(prefix, (counts.get(prefix) || 0) + 1);
        }
      }
      if (counts.size) {
        let best = '';
        let maxCount = 0;
        for (const [k, v] of counts) {
          if (v > maxCount) {
            best = k;
            maxCount = v;
          }
        }
        return { lineName: best, source: '自动识别自缺陷图命名' };
      }
    }

    if (explicitExcelPath && fileExists(explicitExcelPath)) {
      return {
        lineName: path.basename(explicitExcelPath, path.extname(explicitExcelPath)),
        source: '自动识别自坐标表格文件名',
      };
    }

    for (const folder of [path.join(reportDir, '线路缺陷图'), reportDir]) {
      if (!dirExists(folder)) continue;
      const xlsFiles = fs.readdirSync(folder)
        .filter(f => /\.(xlsx?)$/i.test(f) && !f.startsWith('~'))
        .sort(compareNatural);
      if (xlsFiles.length) {
        return {
          lineName: path.basename(xlsFiles[0], path.extname(xlsFiles[0])),
          source: '自动识别自坐标表格文件名',
        };
      }
    }
  } else if (explicitExcelPath && fileExists(explicitExcelPath)) {
    return {
      lineName: path.basename(explicitExcelPath, path.extname(explicitExcelPath)),
      source: '自动识别自坐标表格文件名',
    };
  }

  if (photoRoot && dirExists(photoRoot)) {
    const absPhoto = path.resolve(photoRoot);
    for (const p of [absPhoto, path.dirname(absPhoto)]) {
      const extracted = extractLineFromText(path.basename(p));
      if (extracted) return { lineName: extracted, source: '自动识别自照片目录名称' };
    }
    const photoBase = path.basename(absPhoto);
    if (photoBase && !GENERIC_DIR_NAMES.has(photoBase)) {
      return { lineName: photoBase, source: '自动识别自照片目录名称' };
    }
  }

  if (reportDir && dirExists(reportDir)) {
    const absReport = path.resolve(reportDir);
    for (const p of [absReport, path.dirname(absReport)]) {
      const extracted = extractLineFromText(path.basename(p));
      if (extracted) return { lineName: extracted, source: '自动识别自报告目录名称' };
    }
    const reportBase = path.basename(absReport);
    if (reportBase && !GENERIC_DIR_NAMES.has(reportBase)) {
      return { lineName: reportBase, source: '自动识别自报告目录名称' };
    }
  }

  return { lineName: '', source: '' };
}

async function readXmpChunk(filePath) {
  const handle = await fsp.open(filePath, 'r');
  try {
    const buf = Buffer.allocUnsafe(262144);
    const { bytesRead } = await handle.read(buf, 0, buf.length, 0);
    return buf.subarray(0, bytesRead).toString('utf8');
  } finally {
    await handle.close();
  }
}

async function getGimbalPitch(imgPath, xmpData) {
  let xmpText = '';
  if (typeof xmpData === 'string') {
    xmpText = xmpData;
  } else {
    const raw = await readXmpChunk(imgPath);
    const start = raw.indexOf('<rdf:Description ');
    if (start >= 0) {
      const end = raw.indexOf('</rdf:Description>', start);
      xmpText = end >= 0 ? raw.slice(start, end + 18) : raw.slice(start);
    }
  }
  if (!xmpText) return null;

  const match = xmpText.match(/drone-dji:GimbalPitchDegree="([+-]?\d+(?:\.\d+)?)"/i);
  if (match) {
    const pitch = Math.abs(parseFloat(match[1]));
    return Number.isFinite(pitch) && pitch > 80 ? pitch : null;
  }

  const djiLines = xmpText.split(/\r?\n/).filter(ln => ln.includes('drone-dji:'));
  if (djiLines.length > 6) {
    const idx = ((djiLines[2].includes('RTK') || djiLines[2].includes('Normal')) && djiLines.length > 10) ? 10 : 6;
    const nums = djiLines[idx].match(/[0-9][^"]*(?=")/);
    if (nums) {
      const val = Math.abs(parseFloat(nums[0]));
      return Number.isFinite(val) && val > 80 ? val : null;
    }
  }
  return null;
}

async function extractPhotoGeo(imgPath) {
  let parsed = null;
  try {
    parsed = await exifr.parse(imgPath, { gps: true, xmp: { parse: false } });
  } catch {
    return null;
  }
  if (!parsed || !Number.isFinite(parsed.longitude) || !Number.isFinite(parsed.latitude)) {
    return null;
  }
  const pitch = await getGimbalPitch(imgPath, typeof parsed.xmp === 'string' ? parsed.xmp : undefined);
  if (pitch === null) return null;
  return { lon: parsed.longitude, lat: parsed.latitude };
}

function listDjiJpegs(folder) {
  const files = fs.readdirSync(folder)
    .filter(f => fileExists(path.join(folder, f)) && isJpegName(f) && f.toUpperCase().includes('DJI'));
  files.sort((a, b) => {
    const ta = isInfraredName(a) ? 1 : 0;
    const tb = isInfraredName(b) ? 1 : 0;
    return ta - tb || compareNatural(a, b);
  });
  return files;
}

async function findNadirGps(folder) {
  for (const jpg of listDjiJpegs(folder)) {
    const coords = await extractPhotoGeo(path.join(folder, jpg));
    if (coords) return { ...coords, jpg };
  }
  return null;
}

function listSubdirs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'))
    .map(d => d.name)
    .sort(compareNatural);
}

function hasDirectJpgs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .some(e => e.isFile() && isJpegName(e.name));
}

function resolveBranchRoots(photoRoot) {
  const topDirs = listSubdirs(photoRoot);
  if (topDirs.length === 1) {
    const onlyPath = path.join(photoRoot, topDirs[0]);
    const subDirs = listSubdirs(onlyPath);
    if (!hasDirectJpgs(onlyPath) && subDirs.some(sub => {
      const subPath = path.join(onlyPath, sub);
      return hasDirectJpgs(subPath) || listSubdirs(subPath).some(t => hasDirectJpgs(path.join(subPath, t)));
    })) {
      return { baseDir: onlyPath, detectedLine: topDirs[0] };
    }
  }
  return { baseDir: photoRoot, detectedLine: '' };
}

async function extractCoordinatesFromDir(photoRoot, lineName, logFn = () => {}) {
  if (!dirExists(photoRoot)) {
    throw new Error(`照片目录不存在：${photoRoot}`);
  }
  const { baseDir, detectedLine } = resolveBranchRoots(photoRoot);
  const linePrefix = (lineName || detectedLine || '').trim();
  const coordRows = [];
  const summaryRows = [];
  let seq = 1;

  for (const branch of listSubdirs(baseDir)) {
    const branchPath = path.join(baseDir, branch);
    const fullBranch = (!linePrefix || linePrefix === branch || branch.startsWith(linePrefix))
      ? branch
      : `${linePrefix}${branch}`;

    if (hasDirectJpgs(branchPath)) {
      const hit = await findNadirGps(branchPath);
      if (hit) {
        coordRows.push([seq, fullBranch, hit.lon, hit.lat]);
        summaryRows.push([branch, branch, 1]);
        logFn(`${seq}\t${fullBranch}\t${formatCoordinate(hit.lon)}\t${formatCoordinate(hit.lat)}  (${hit.jpg})`);
        seq += 1;
      } else {
        logFn(`[提示] 未找到俯拍坐标照片：${branchPath}`);
      }
      continue;
    }

    const branchTowers = [];
    for (const tower of listSubdirs(branchPath)) {
      const towerPath = path.join(branchPath, tower);
      const hit = await findNadirGps(towerPath);
      if (hit) {
        const towerFullName = `${fullBranch}${tower}`;
        coordRows.push([seq, towerFullName, hit.lon, hit.lat]);
        branchTowers.push(tower);
        logFn(`${seq}\t${towerFullName}\t${formatCoordinate(hit.lon)}\t${formatCoordinate(hit.lat)}  (${hit.jpg})`);
        seq += 1;
      } else {
        logFn(`[提示] 未找到俯拍坐标照片：${towerPath}`);
      }
    }

    if (branchTowers.length) {
      summaryRows.push([branch, `${branchTowers[0]}-${branchTowers[branchTowers.length - 1]}`, branchTowers.length]);
    }
  }

  return { coordRows, summaryRows };
}

function saveCoordinatesXls(coordRows, summaryRows, outXlsPath) {
  fs.mkdirSync(path.dirname(path.resolve(outXlsPath)), { recursive: true });
  const wb = XLSX.utils.book_new();
  const sh1 = XLSX.utils.aoa_to_sheet([
    ['序号', '线路名称', '经度', '纬度'],
    ...coordRows.map(r => [Number(r[0]), String(r[1]), Number(r[2]), Number(r[3])]),
  ]);
  const sh2 = XLSX.utils.aoa_to_sheet([
    ['线路名称', '杆塔区间', '杆塔数量', '作业机型'],
    ...summaryRows.map(r => [String(r[0]), String(r[1]), Number(r[2]), '']),
  ]);
  XLSX.utils.book_append_sheet(wb, sh1, 'Sheet1');
  XLSX.utils.book_append_sheet(wb, sh2, 'Sheet2');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([]), 'Sheet3');
  XLSX.writeFile(wb, outXlsPath, { bookType: 'biff8' });
  return outXlsPath;
}

function resolveXlsOutputPath(reportDir, lineName) {
  const baseName = `${(lineName || '').trim() || '线路坐标'}.xls`;
  const defectSub = path.join(reportDir, '线路缺陷图');
  if (dirExists(defectSub)) return path.join(defectSub, baseName);
  return path.join(reportDir, baseName);
}

async function runExtractToExcel({ photoRoot, reportDir, lineName = '', logFn = () => {} }) {
  let cleanName = (lineName || '').trim();
  let sourceDesc = '';
  if (!cleanName) {
    const detected = detectLineName(reportDir, photoRoot);
    cleanName = detected.lineName;
    sourceDesc = detected.source;
  }
  if (!cleanName) {
    cleanName = path.basename(path.resolve(photoRoot));
    sourceDesc = '默认取照片目录名称';
  }

  logFn(`开始提取可见光坐标：${photoRoot}`);
  logFn(`自动识别主线：${cleanName}（${sourceDesc || '自动识别'}）`);

  const { coordRows, summaryRows } = await extractCoordinatesFromDir(photoRoot, cleanName, logFn);
  if (!coordRows.length) {
    throw new Error('未提取到任何有效俯拍坐标，请检查照片目录结构及照片 EXIF/XMP 信息');
  }

  const outXlsPath = resolveXlsOutputPath(reportDir, cleanName);
  saveCoordinatesXls(coordRows, summaryRows, outXlsPath);
  logFn(`坐标提取完成：共 ${coordRows.length} 条记录，已保存至 ${outXlsPath}`);
  return { outXlsPath, count: coordRows.length, lineName: cleanName };
}

function formatCoordinate(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number' && Number.isFinite(val)) {
    return String(Number(val.toPrecision(10)));
  }
  const text = String(val).trim();
  if (!text) return '';

  const dms = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*[°度]\s*(\d+(?:\.\d+)?)\s*[′'分]\s*(\d+(?:\.\d+)?)\s*[″"秒]?\s*$/);
  if (dms) {
    const deg = parseFloat(dms[1]);
    const minute = parseFloat(dms[2]);
    const sec = parseFloat(dms[3]);
    const sign = deg < 0 ? -1 : 1;
    const dec = sign * (Math.abs(deg) + minute / 60 + sec / 3600);
    return String(Number(dec.toPrecision(10)));
  }

  const num = Number(text);
  if (Number.isFinite(num)) {
    return String(Number(num.toPrecision(10)));
  }
  return text;
}

function formatSeq(val, fallbackIdx) {
  if (val === null || val === undefined || String(val).trim() === '') return String(fallbackIdx);
  const num = Number(val);
  return Number.isFinite(num) ? String(Math.trunc(num)) : String(val).trim();
}

function formatGeoLineName(val, linePrefix) {
  const name = val === null || val === undefined ? '' : String(val).trim();
  if (!name) return '';
  if (linePrefix && !name.startsWith(linePrefix) && !/^\d+\s*kV/i.test(name)) {
    return `${linePrefix}${name}`;
  }
  return name;
}

function extractGeoRows(sheet0Rows, linePrefix) {
  if (!sheet0Rows || !sheet0Rows.length) return [];
  const headerRow = sheet0Rows[0].map(c => (c == null ? '' : String(c).trim()));
  const colMap = {};
  headerRow.forEach((text, idx) => {
    for (const key of ['序号', '线路名称', '经度', '纬度']) {
      if (text.includes(key) && colMap[key] === undefined) colMap[key] = idx;
    }
  });

  const seqCol = colMap['序号'] ?? 0;
  const nameCol = colMap['线路名称'] ?? 1;
  const lonCol = colMap['经度'] ?? 2;
  const latCol = colMap['纬度'] ?? 3;

  const parsed = [['序号', '线路名称', '经度', '纬度']];
  let rowNum = 1;
  for (const row of sheet0Rows.slice(1)) {
    const nameVal = row[nameCol];
    const lonVal = row[lonCol];
    const latVal = row[latCol];
    if ((nameVal == null || String(nameVal).trim() === '') && (lonVal == null || String(lonVal).trim() === '')) {
      continue;
    }
    parsed.push([
      formatSeq(row[seqCol], rowNum),
      formatGeoLineName(nameVal, linePrefix),
      formatCoordinate(lonVal),
      formatCoordinate(latVal),
    ]);
    rowNum += 1;
  }
  return parsed;
}

function readExcelSheets(excelPath) {
  const wb = XLSX.readFile(excelPath);
  return wb.SheetNames.map(name => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null }));
}

function sortMainFirst(items) {
  const mainItems = [];
  const branchItems = [];
  for (const item of items) {
    const parts = item.split('-');
    if (parts.length > 1 && parts[1] === '主线') mainItems.push(item);
    else branchItems.push(item);
  }
  return mainItems.concat(branchItems);
}

function stripExtAndDup(segment) {
  return String(segment || '').replace(/\.(jpe?g)$/i, '').replace(/（\d+）$/, '');
}

function parseDefectParts(fileName) {
  const parts = fileName.split('-');
  if (parts.length !== 6) return null;
  const severity = stripExtAndDup(parts[5]);
  return { parts, severity };
}

function makeNormalRun(text) {
  return new TextRun({
    text: String(text),
    font: { eastAsia: '方正仿宋_GBK', ascii: 'Arial', hAnsi: 'Arial' },
    size: 32,
    bold: false,
    color: '000000',
  });
}

function makeHeading(text, level) {
  const fontByLevel = {
    [HeadingLevel.HEADING_1]: { eastAsia: '方正黑体_GBK', bold: false },
    [HeadingLevel.HEADING_2]: { eastAsia: '方正楷体_GBK', bold: true },
    [HeadingLevel.HEADING_3]: { eastAsia: '方正仿宋_GBK', bold: false },
  }[level];
  return new Paragraph({
    heading: level,
    children: [
      new TextRun({
        text: String(text),
        font: { eastAsia: fontByLevel.eastAsia, ascii: 'Arial', hAnsi: 'Arial' },
        size: 32,
        bold: fontByLevel.bold,
        color: '000000',
      }),
    ],
  });
}

function makeNormalParagraph(text) {
  return new Paragraph({
    indent: { firstLine: 360 },
    alignment: AlignmentType.LEFT,
    spacing: { before: 0, after: 200, line: 276 },
    children: [makeNormalRun(text)],
  });
}

function makeTableCell(text, options = {}) {
  const eastAsia = options.eastAsia || '方正仿宋_GBK';
  const paragraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0, line: 240 },
    children: [
      new TextRun({
        text: text == null ? '' : String(text),
        font: { eastAsia, ascii: eastAsia, hAnsi: eastAsia },
        size: 24,
        bold: false,
        color: '000000',
      }),
    ],
  });

  return new TableCell({
    verticalAlign: VerticalAlign.CENTER,
    columnSpan: options.columnSpan,
    rowSpan: options.rowSpan,
    width: options.widthCm ? { size: cmToTwips(options.widthCm), type: WidthType.DXA } : undefined,
    children: [paragraph],
  });
}

function makeStyledTable(rows, options = {}) {
  const widthsTwips = options.widthsCm ? options.widthsCm.map(cmToTwips) : undefined;
  return new Table({
    alignment: AlignmentType.CENTER,
    borders: TABLE_GRID_BORDERS,
    layout: TableLayoutType.FIXED,
    columnWidths: widthsTwips,
    width: widthsTwips
      ? { size: widthsTwips.reduce((a, b) => a + b, 0), type: WidthType.DXA }
      : { size: cmToTwips(16), type: WidthType.DXA },
    rows,
  });
}

function loadImageRunBuffer(imgPath) {
  const buf = fs.readFileSync(imgPath);
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) {
    return buf;
  }
  try {
    const { nativeImage } = require('electron');
    if (nativeImage) {
      const img = nativeImage.createFromBuffer(buf);
      if (!img.isEmpty()) return img.toJPEG(95);
    }
  } catch {}
  throw new Error(`无法读取缺陷图片：${imgPath}`);
}

function makePictureCell(imgPath, columnSpan = 1, widthCm = 8.4) {
  const data = loadImageRunBuffer(imgPath);
  return new TableCell({
    verticalAlign: VerticalAlign.CENTER,
    columnSpan,
    width: { size: cmToTwips(widthCm), type: WidthType.DXA },
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0, line: 240 },
        children: [
          new ImageRun({
            type: 'jpg',
            data,
            transformation: {
              width: Math.round(8 * CM_TO_PX),
              height: Math.round(6 * CM_TO_PX),
            },
          }),
        ],
      }),
    ],
  });
}

function addDefectSummarySection(children, heading, items) {
  children.push(makeHeading(heading, HeadingLevel.HEADING_2));
  const ordered = sortMainFirst(items.filter(x => !x.includes('树障')));
  const widthsCm = [1.2, 1.8, 3.8, 1.8, 2.6, 3.2, 1.6];
  const headerRow = new TableRow({
    children: ['序号', '电压等级', '线路名称', '运行杆号', '位置', '缺陷内容', '缺陷类别']
      .map((title, idx) => makeTableCell(title, { widthCm: widthsCm[idx] })),
  });
  const dataRows = ordered.map((pictureName, i) => {
    const parsed = parseDefectParts(pictureName);
    const parts = parsed.parts;
    const shortLine = parts[0].replace(/^\d+\s*kV/i, '');
    const lineLabel = parts[1] === '主线' ? shortLine : `${shortLine}${parts[1]}`;
    const vals = [i + 1, '10kV', lineLabel, parts[2], parts[3], parts[4], parsed.severity];
    return new TableRow({
      children: vals.map((val, idx) => makeTableCell(val, { widthCm: widthsCm[idx] })),
    });
  });
  children.push(makeStyledTable([headerRow, ...dataRows], { widthsCm }));
}

function makeDetailBlockTable(smallDir, bigDir, fileName, poleHeading = '塔号') {
  const parsed = parseDefectParts(fileName);
  const parts = parsed.parts;
  const lineCellText = parts[1] === '主线' ? parts[0] : `${parts[0]}${parts[1]}`;
  const bigPath = path.join(bigDir, fileName);
  const smallPath = path.join(smallDir, fileName);
  if (!fileExists(bigPath)) throw new Error(`缺少对应大图文件：${bigPath}`);
  if (!fileExists(smallPath)) throw new Error(`缺少对应小图文件：${smallPath}`);

  const widthsCm = [8.4, 4.2, 4.2];
  const rowHeight15 = { value: cmToTwips(1.5), rule: 'atLeast' };
  const rowHeight65 = { value: cmToTwips(6.5), rule: 'atLeast' };
  return makeStyledTable([
    new TableRow({
      height: rowHeight15,
      children: [
        makeTableCell('线路名称', { widthCm: widthsCm[0] }),
        makeTableCell(poleHeading, { widthCm: widthsCm[1] }),
        makeTableCell('缺陷定性', { widthCm: widthsCm[2] }),
      ],
    }),
    new TableRow({
      height: rowHeight15,
      children: [
        makeTableCell(lineCellText, { widthCm: widthsCm[0] }),
        makeTableCell(parts[2], { widthCm: widthsCm[1] }),
        makeTableCell(parsed.severity, { widthCm: widthsCm[2] }),
      ],
    }),
    new TableRow({
      height: rowHeight15,
      children: [
        makeTableCell('缺陷描述', { widthCm: widthsCm[0] }),
        makeTableCell(`${parts[3]}${parts[4]}`, { columnSpan: 2, widthCm: widthsCm[1] + widthsCm[2] }),
      ],
    }),
    new TableRow({
      height: rowHeight65,
      children: [
        makePictureCell(bigPath, 1, widthsCm[0]),
        makePictureCell(smallPath, 2, widthsCm[1] + widthsCm[2]),
      ],
    }),
  ], { widthsCm });
}

async function generateReport({ reportDir, excelPath = '', lineName = '', logFn = () => {}, onProgress = () => {} }) {
  const { defectDir, outputDir } = resolveDefectDir(reportDir);
  const smallDir = path.join(defectDir, '小图');
  const bigDir = path.join(defectDir, '大图');

  if (!dirExists(smallDir) || !dirExists(bigDir)) {
    throw new Error('缺少“小图”或“大图”目录');
  }

  const smallFiles = fs.readdirSync(smallDir)
    .filter(f => isJpegName(f) && fileExists(path.join(smallDir, f)))
    .sort(compareNatural);

  const invalidNames = [];
  for (const dir of [smallDir, bigDir]) {
    for (const f of fs.readdirSync(dir)) {
      if (isJpegName(f) && f.split('-').length !== 6) {
        invalidNames.push(path.join(dir, f));
      }
    }
  }
  if (invalidNames.length) {
    throw new Error(`存在 ${invalidNames.length} 张命名不符合 6 段规范的图片，例如：${path.basename(invalidNames[0])}`);
  }

  const generalDefects = [];
  const seriousDefects = [];
  const criticalDefects = [];
  const treeList = [];
  let treeGeneral = 0;
  let treeSerious = 0;
  let treeCritical = 0;

  for (const f of smallFiles) {
    const parsed = parseDefectParts(f);
    if (!parsed) continue;
    const sev = parsed.severity;
    if (f.includes('树障')) {
      treeList.push(f);
      if (sev === '一般') treeGeneral += 1;
      else if (sev === '严重') treeSerious += 1;
      else if (sev === '危急') treeCritical += 1;
    } else {
      if (sev === '一般') generalDefects.push(f);
      else if (sev === '严重') seriousDefects.push(f);
      else if (sev === '危急') criticalDefects.push(f);
    }
  }

  const resolvedExcel = findExcelFile(reportDir, defectDir, excelPath);
  let sheets = [];
  let reportTitle = (lineName || '').trim() || detectLineName(reportDir, '', resolvedExcel || '').lineName || path.basename(path.resolve(reportDir));
  if (resolvedExcel) {
    if (!lineName) {
      reportTitle = path.basename(resolvedExcel, path.extname(resolvedExcel));
    }
    sheets = readExcelSheets(resolvedExcel);
  }

  const sheet2Rows = [];
  let totalTowers = 0;
  let mainTowers = 0;
  if (sheets.length >= 2) {
    for (const row of sheets[1].slice(1)) {
      if (!row || !row[0]) continue;
      const countNum = Number(row[2]);
      const towerCount = Number.isFinite(countNum) ? Math.trunc(countNum) : 0;
      sheet2Rows.push([row[0], row[1] || '', towerCount]);
      totalTowers += towerCount;
      if (String(row[0]).trim() === '主线') mainTowers = towerCount;
    }
  }

  const branchCount = sheet2Rows.length - (mainTowers > 0 ? 1 : 0);
  const resolvedLineName = reportTitle;
  const companyName = '芜湖繁昌供电公司';
  const now = new Date();
  const inspectionDate = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  const aircraftModel = 'DJI Mavic 3T';
  const flightHeight = '15米';

  const children = [];

  // 一、巡视汇总报告
  children.push(makeHeading('一、巡视汇总报告', HeadingLevel.HEADING_1));
  children.push(makeHeading('（一）巡视概况', HeadingLevel.HEADING_2));
  const totalKm = Number((totalTowers / 20).toFixed(3));
  children.push(makeNormalParagraph(
    `按照芜湖市管理要求，开展配网10kV重点线路无人机精细化巡检工作，对${companyName}运维的${resolvedLineName}主、支线，共计${totalTowers}基杆塔、${totalKm}公里开展无人机精细化巡检。`
  ));

  children.push(makeHeading('（二）巡视结果', HeadingLevel.HEADING_2));
  children.push(makeHeading('1.巡视台账', HeadingLevel.HEADING_3));
  const branchTowers = totalTowers - mainTowers;
  const mainKm = Number((mainTowers / 20).toFixed(3));
  const branchKm = Number((branchTowers / 20).toFixed(3));
  children.push(makeNormalParagraph(
    `${resolvedLineName}主支线杆塔${totalTowers}基。其中主线杆塔${mainTowers}基,${mainKm}公里；支线${Math.max(0, branchCount)}条共${branchTowers}基杆塔,${branchKm}公里。`
  ));

  children.push(makeHeading('2.巡视缺陷', HeadingLevel.HEADING_3));
  const totalDefect = criticalDefects.length + seriousDefects.length + generalDefects.length;
  children.push(makeNormalParagraph(
    `无人机监察巡视共计发现缺陷${totalDefect}处，其中一般缺陷${generalDefects.length}处，严重缺陷${seriousDefects.length}处，危急缺陷${criticalDefects.length}处。`
  ));

  children.push(makeHeading('3.树障隐患', HeadingLevel.HEADING_3));
  children.push(makeNormalParagraph(
    `无人机监察巡视共计发现树障隐患${treeList.length}处，其中一般隐患${treeGeneral}处，严重隐患${treeSerious}处，危急隐患${treeCritical}处。`
  ));

  // 二、巡检信息
  children.push(makeHeading('二、巡检信息', HeadingLevel.HEADING_1));
  children.push(makeHeading('（一）综合飞行工况', HeadingLevel.HEADING_2));
  const flyWidths = [3.5, 4.5, 3.5, 4.5];
  children.push(makeStyledTable([
    new TableRow({ children: [makeTableCell('巡检名称', { widthCm: flyWidths[0] }), makeTableCell(`${resolvedLineName}督查巡视`, { columnSpan: 3, widthCm: 12.5 })] }),
    new TableRow({ children: [makeTableCell('巡检日期', { widthCm: flyWidths[0] }), makeTableCell(inspectionDate, { columnSpan: 3, widthCm: 12.5 })] }),
    new TableRow({
      children: [
        makeTableCell('巡检机型', { widthCm: flyWidths[0] }),
        makeTableCell(aircraftModel, { widthCm: flyWidths[1] }),
        makeTableCell('飞行高度', { widthCm: flyWidths[2] }),
        makeTableCell(flightHeight, { widthCm: flyWidths[3] }),
      ],
    }),
  ], { widthsCm: flyWidths }));

  children.push(makeHeading('（二）巡检线路基本信息', HeadingLevel.HEADING_2));
  if (sheet2Rows.length) {
    const infoWidths = [5.0, 4.0, 3.0, 4.0];
    const infoRows = [
      new TableRow({ children: ['线路名称', '杆塔区间', '杆塔数量', '作业机型'].map((t, idx) => makeTableCell(t, { widthCm: infoWidths[idx] })) }),
      ...sheet2Rows.map((row, idx) => new TableRow({
        children: [
          makeTableCell(row[0], { widthCm: infoWidths[0] }),
          makeTableCell(row[1], { widthCm: infoWidths[1] }),
          makeTableCell(row[2], { widthCm: infoWidths[2] }),
          ...(idx === 0
            ? [makeTableCell(aircraftModel, { widthCm: infoWidths[3], ...(sheet2Rows.length > 1 ? { rowSpan: sheet2Rows.length } : {}) })]
            : []),
        ],
      })),
    ];
    children.push(makeStyledTable(infoRows, { widthsCm: infoWidths }));
  }

  // 三、缺陷明细
  children.push(makeHeading('三、缺陷明细', HeadingLevel.HEADING_1));
  children.push(makeHeading('（一）精细化缺陷统计', HeadingLevel.HEADING_2));
  const statWidths = [3.2, 3.2, 3.2, 3.2, 3.2];
  children.push(makeStyledTable([
    new TableRow({ children: ['缺陷等级', '危急', '严重', '一般', '合计'].map((t, idx) => makeTableCell(t, { widthCm: statWidths[idx] })) }),
    new TableRow({
      children: [
        '缺陷数量',
        criticalDefects.length,
        seriousDefects.length,
        generalDefects.length,
        totalDefect,
      ].map((v, idx) => makeTableCell(v, { widthCm: statWidths[idx] })),
    }),
  ], { widthsCm: statWidths }));

  addDefectSummarySection(children, '（二）危急缺陷汇总', criticalDefects);
  addDefectSummarySection(children, '（三）严重缺陷汇总', seriousDefects);
  addDefectSummarySection(children, '（四）一般缺陷汇总', generalDefects);

  children.push(makeHeading('（五）缺陷明细', HeadingLevel.HEADING_2));
  const detailList = sortMainFirst(criticalDefects).concat(sortMainFirst(seriousDefects));
  const totalDetailCount = detailList.length + treeList.length;
  let processed = 0;

  for (const defectPicture of detailList) {
    processed += 1;
    logFn(`写入缺陷明细 (${processed}/${totalDetailCount})：${defectPicture}`);
    onProgress({ phase: 'report', completed: processed, total: totalDetailCount, file: defectPicture });
    children.push(makeDetailBlockTable(smallDir, bigDir, defectPicture, '塔号'));
  }

  // 四、经纬度信息表
  children.push(makeHeading('四、经纬度信息表', HeadingLevel.HEADING_1));
  if (resolvedExcel && sheets.length) {
    logFn(`读取经纬度表：${path.basename(resolvedExcel)}`);
    const geoRows = extractGeoRows(sheets[0], resolvedLineName);
    if (geoRows.length) {
      const geoWidths = [1.3, 8.0, 3.3, 3.3];
      const geoTableRows = geoRows.map(row => new TableRow({
        children: row.map((val, cIdx) => makeTableCell(val, {
          eastAsia: '宋体',
          compact: true,
          widthCm: geoWidths[cIdx],
        })),
      }));
      children.push(makeStyledTable(geoTableRows, { widthsCm: geoWidths }));
      logFn(`经纬度表写入完成，共 ${geoRows.length - 1} 条杆塔记录`);
    } else {
      logFn('[提示] 经纬度工作表为空');
    }
  } else {
    logFn('[提示] 未找到坐标 Excel 文件，跳过经纬度信息表');
  }

  // 五、树障隐患明细
  children.push(makeHeading('五、树障隐患明细', HeadingLevel.HEADING_1));
  children.push(makeHeading('（一）树障隐患汇总', HeadingLevel.HEADING_2));
  if (!treeList.length) {
    children.push(makeHeading('（二）树障隐患明细', HeadingLevel.HEADING_2));
  } else {
    const orderedTree = sortMainFirst(treeList);
    const treeWidths = [1.5, 5.0, 2.5, 4.0, 2.5];
    const treeTableRows = [
      new TableRow({
        children: ['序号', '线路名称', '杆塔区段', '缺陷定性', '缺陷类别'].map((title, cIdx) =>
          makeTableCell(title, { widthCm: treeWidths[cIdx] })
        ),
      }),
      ...orderedTree.map((fileName, idx) => {
        const parsed = parseDefectParts(fileName);
        const parts = parsed.parts;
        const lineText = parts[1] === '主线' ? parts[0] : `${parts[0]}${parts[1]}`;
        return new TableRow({
          children: [idx + 1, lineText, parts[2], parts[4], parsed.severity].map((val, cIdx) =>
            makeTableCell(val, { widthCm: treeWidths[cIdx] })
          ),
        });
      }),
    ];
    children.push(makeStyledTable(treeTableRows, { widthsCm: treeWidths }));
    children.push(makeHeading('（二）树障隐患明细', HeadingLevel.HEADING_2));

    for (const treePicture of orderedTree) {
      processed += 1;
      logFn(`写入树障明细 (${processed}/${totalDetailCount})：${treePicture}`);
      onProgress({ phase: 'report', completed: processed, total: totalDetailCount, file: treePicture });
      children.push(makeDetailBlockTable(smallDir, bigDir, treePicture, '区段'));
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: { eastAsia: '方正仿宋_GBK', ascii: 'Arial', hAnsi: 'Arial' },
            size: 32,
            color: '000000',
          },
          paragraph: {
            alignment: AlignmentType.LEFT,
            indent: { firstLine: 360 },
            spacing: { before: 0, after: 200, line: 276 },
          },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            font: { eastAsia: '方正黑体_GBK', ascii: 'Arial', hAnsi: 'Arial' },
            size: 32,
            bold: false,
            color: '000000',
          },
          paragraph: {
            keepNext: true,
            keepLines: true,
            spacing: { before: 480, after: 0 },
            outlineLevel: 0,
          },
        },
        {
          id: 'Heading2',
          name: 'heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            font: { eastAsia: '方正楷体_GBK', ascii: 'Arial', hAnsi: 'Arial' },
            size: 32,
            bold: true,
            color: '000000',
          },
          paragraph: {
            keepNext: true,
            keepLines: true,
            spacing: { before: 200, after: 0 },
            outlineLevel: 1,
          },
        },
        {
          id: 'Heading3',
          name: 'heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            font: { eastAsia: '方正仿宋_GBK', ascii: 'Arial', hAnsi: 'Arial' },
            size: 32,
            bold: false,
            color: '000000',
          },
          paragraph: {
            keepNext: true,
            keepLines: true,
            spacing: { before: 200, after: 0 },
            outlineLevel: 2,
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: cmToTwips(21.0),
              height: cmToTwips(29.7),
            },
            margin: {
              top: cmToTwips(2.54),
              bottom: cmToTwips(2.54),
              left: cmToTwips(2.0),
              right: cmToTwips(2.0),
            },
          },
        },
        children,
      },
    ],
  });

  const outDocxPath = path.join(outputDir, `${reportTitle}无人机技术监督巡视分析报告.docx`);
  const buffer = await Packer.toBuffer(doc);
  const tmpPath = `${outDocxPath}.${Date.now()}.tmp`;
  await fsp.writeFile(tmpPath, buffer);
  await fsp.rename(tmpPath, outDocxPath);
  logFn(`Word 报告生成完成：${outDocxPath}`);

  return {
    outDocxPath,
    excelPath: resolvedExcel || '',
    lineName: resolvedLineName,
    defectCount: totalDefect,
    treeCount: treeList.length,
    geoCount: sheets.length && sheets[0].length > 1 ? sheets[0].length - 1 : 0,
  };
}

module.exports = {
  detectLineName,
  extractCoordinatesFromDir,
  extractGeoRows,
  findExcelFile,
  formatCoordinate,
  formatGeoLineName,
  generateReport,
  getGimbalPitch,
  readExcelSheets,
  resolveDefectDir,
  runExtractToExcel,
  saveCoordinatesXls,
};
