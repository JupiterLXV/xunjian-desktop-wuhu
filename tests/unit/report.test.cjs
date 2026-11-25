const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { PNG } = require('pngjs');
const jpeg = require('jpeg-js');
const XLSX = require('xlsx');
const report = require('../../app/report-service.cjs');

function makeDjiJpeg(lonDeg, latDeg, pitchDeg) {
  const png = new PNG({ width: 120, height: 90 });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 40; png.data[i + 1] = 110; png.data[i + 2] = 180; png.data[i + 3] = 255;
  }
  const base = jpeg.encode(png, 85).data;

  // Build minimal TIFF EXIF with GPSInfo IFD (little-endian)
  const toDms = deg => {
    const abs = Math.abs(deg);
    const d = Math.floor(abs);
    const mFloat = (abs - d) * 60;
    const m = Math.floor(mFloat);
    const s = Math.round((mFloat - m) * 60 * 10000);
    return [[d, 1], [m, 1], [s, 10000]];
  };
  const latDms = toDms(latDeg);
  const lonDms = toDms(lonDeg);

  // TIFF layout: 0..7 header, 8..25 IFD0 (1 entry: 0x8825 -> offset 26), 26..81 GPS IFD (4 entries), 82..129 rational arrays
  const tiff = Buffer.alloc(130);
  tiff.write('II', 0, 'ascii');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  // IFD0: 1 entry
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x8825, 10);
  tiff.writeUInt16LE(4, 12); // LONG
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt32LE(26, 18); // GPS IFD offset
  tiff.writeUInt32LE(0, 22);
  // GPS IFD at 26: 4 entries (2 + 4*12 + 4 = 54 -> ends at 80)
  tiff.writeUInt16LE(4, 26);
  // 1: GPSLatitudeRef (tag 1, ASCII, count 2)
  tiff.writeUInt16LE(1, 28); tiff.writeUInt16LE(2, 30); tiff.writeUInt32LE(2, 32);
  tiff.write(latDeg >= 0 ? 'N\0\0\0' : 'S\0\0\0', 36, 'ascii');
  // 2: GPSLatitude (tag 2, RATIONAL, count 3 -> offset 82)
  tiff.writeUInt16LE(2, 40); tiff.writeUInt16LE(5, 42); tiff.writeUInt32LE(3, 44); tiff.writeUInt32LE(82, 48);
  // 3: GPSLongitudeRef (tag 3, ASCII, count 2)
  tiff.writeUInt16LE(3, 52); tiff.writeUInt16LE(2, 54); tiff.writeUInt32LE(2, 56);
  tiff.write(lonDeg >= 0 ? 'E\0\0\0' : 'W\0\0\0', 60, 'ascii');
  // 4: GPSLongitude (tag 4, RATIONAL, count 3 -> offset 106)
  tiff.writeUInt16LE(4, 64); tiff.writeUInt16LE(5, 66); tiff.writeUInt32LE(3, 68); tiff.writeUInt32LE(106, 72);
  tiff.writeUInt32LE(0, 76);

  let off = 82;
  for (const [n, d] of latDms) { tiff.writeUInt32LE(n, off); tiff.writeUInt32LE(d, off + 4); off += 8; }
  for (const [n, d] of lonDms) { tiff.writeUInt32LE(n, off); tiff.writeUInt32LE(d, off + 4); off += 8; }

  const exifBody = Buffer.concat([Buffer.from('Exif\0\0', 'ascii'), tiff]);
  const exifSeg = Buffer.alloc(4 + exifBody.length);
  exifSeg[0] = 0xff; exifSeg[1] = 0xe1;
  exifSeg.writeUInt16BE(exifBody.length + 2, 2);
  exifBody.copy(exifSeg, 4);

  const xmpXml = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:drone-dji="http://www.dji.com/drone-dji/1.0/" drone-dji:GimbalPitchDegree="${pitchDeg.toFixed(2)}"/></rdf:RDF></x:xmpmeta>`;
  const xmpBody = Buffer.concat([Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'ascii'), Buffer.from(xmpXml, 'utf8')]);
  const xmpSeg = Buffer.alloc(4 + xmpBody.length);
  xmpSeg[0] = 0xff; xmpSeg[1] = 0xe1;
  xmpSeg.writeUInt16BE(xmpBody.length + 2, 2);
  xmpBody.copy(xmpSeg, 4);

  return Buffer.concat([base.subarray(0, 2), exifSeg, xmpSeg, base.subarray(2)]);
}

test('report-service formats coordinates, line names, extracts nadir GPS to XLS, and generates valid DOCX', async () => {
  assert.equal(report.formatCoordinate(118.254988888888), '118.2549889');
  assert.equal(report.formatCoordinate(31.0789890555555), '31.07898906');
  assert.equal(report.formatCoordinate(`118°15'17.96"`), '118.2549889');
  assert.equal(report.formatGeoLineName('主线#001', '10kV柏树122线'), '10kV柏树122线主线#001');
  assert.equal(report.formatGeoLineName('10kV柏树122线主线#001', '10kV柏树122线'), '10kV柏树122线主线#001');

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'xj-report-'));
  try {
    const photoDir = path.join(dir, '原始照片', '10kV测试101线', '主线', '#001');
    const photoDir2 = path.join(dir, '原始照片', '10kV测试101线', '东支线', '#002');
    const outDir = path.join(dir, '成果');
    const bigDir = path.join(outDir, '大图');
    const smallDir = path.join(outDir, '小图');
    await fs.mkdir(photoDir, { recursive: true });
    await fs.mkdir(photoDir2, { recursive: true });
    await fs.mkdir(bigDir, { recursive: true });
    await fs.mkdir(smallDir, { recursive: true });

    // Oblique _T should be ignored/deprioritized in favor of nadir _V
    await fs.writeFile(path.join(photoDir, 'DJI_202611250001_T.JPG'), makeDjiJpeg(118.1, 31.1, -30));
    await fs.writeFile(path.join(photoDir, 'DJI_202611250002_V.JPG'), makeDjiJpeg(118.2549889, 31.07898906, -89.9));
    await fs.writeFile(path.join(photoDir2, 'DJI_202611250003_V.JPG'), makeDjiJpeg(118.26, 31.08, -88.5));

    const defect1 = '10kV测试101线-主线-#001-绝缘子-脱落-危急.jpg';
    const defect2 = '10kV测试101线-东支线-#002-通道-树障隐患-严重.jpg';
    const sampleImg = makeDjiJpeg(118.25, 31.07, -89);
    await fs.writeFile(path.join(bigDir, defect1), sampleImg);
    await fs.writeFile(path.join(smallDir, defect1), sampleImg);
    await fs.writeFile(path.join(bigDir, defect2), sampleImg);
    await fs.writeFile(path.join(smallDir, defect2), sampleImg);

    const detected = report.detectLineName(outDir, path.join(dir, '原始照片'));
    assert.equal(detected.lineName, '10kV测试101线');

    const extracted = await report.runExtractToExcel({
      photoRoot: path.join(dir, '原始照片'),
      reportDir: outDir,
    });
    assert.equal(extracted.count, 2);
    assert.ok(extracted.outXlsPath.endsWith('10kV测试101线.xls'));

    const wb = XLSX.readFile(extracted.outXlsPath);
    const sh1 = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    assert.equal(sh1[0][1], '线路名称');
    assert.equal(sh1[1][1], '10kV测试101线东支线#002');
    assert.equal(sh1[2][1], '10kV测试101线主线#001');

    const res = await report.generateReport({
      reportDir: outDir,
      excelPath: extracted.outXlsPath,
    });
    assert.equal(res.defectCount, 1);
    assert.equal(res.treeCount, 1);
    assert.equal(res.geoCount, 2);
    const docxBuf = await fs.readFile(res.outDocxPath);
    assert.equal(docxBuf.subarray(0, 2).toString('ascii'), 'PK');
    assert.ok(docxBuf.length > 5000);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
