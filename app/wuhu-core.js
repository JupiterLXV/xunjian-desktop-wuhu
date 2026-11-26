/* Shared by the existing renderer and Node tests. Coordinates are original image pixels. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WuhuCore = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const OUTPUT_DIRS = ['大图', '小图', '原图'];
  const LEGACY_DIRS = ['缺陷圈示图', '缺陷原图', '危急缺陷'];
  function tag(rule) { return '_' + [rule.component, rule.description, rule.severity].join('-'); }
  function findRule(rules, text) { return rules.find(r => tag(r) === text) || null; }
  function dictionary(rules) {
    const result = {};
    for (const r of rules) (result[r.component] ||= []).push(tag(r));
    return result;
  }
  function templateDictionary(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('缺陷分类必须是分类到标签数组的对象');
    const result = Object.create(null);
    for (const [category, items] of Object.entries(value)) {
      if (!category.trim() || !Array.isArray(items) || items.some(t => typeof t !== 'string' || !t.trim()))
        throw new Error('分类【' + category + '】必须包含非空文字标签数组');
      result[category] = [...new Set(items)];
    }
    return result;
  }
  // The active dictionary supplies membership and fields; built-in rules supply optional notes only.
  function templateRules(dict, critical = new Set(), notes = []) {
    const annotations = new Map(notes.map(r => [tag(r), r.note]));
    const rules = new Map();
    for (const [category, items] of Object.entries(dict)) for (const text of items) {
      const body = text.replace(/^_/, ''), split = body.indexOf('-');
      const prefix = body.startsWith(category + '-') ? category : split > 0 ? body.slice(0, split) : category;
      const rest = body.startsWith(prefix + '-') ? body.slice(prefix.length + 1) : body;
      const parts = /^(.*)-(一般|严重|危急)$/.exec(rest);
      rules.set(text, {text, component:prefix, description:parts ? parts[1] : rest,
        severity:parts ? parts[2] : critical.has(text) ? '危急' : '一般', explicitSeverity:!!parts,
        note:annotations.get(text) || ''});
    }
    return rules;
  }
  function parseLocation(filePath, rootPath) {
    // When a picker is opened at a line/branch/pole, its full granted path supplies ancestors.
    const split = p => String(p || '').replace(/\\/g, '/').split('/').filter(Boolean);
    const parts = /^(?:[A-Za-z]:[\\/]|[\\/])/.test(String(filePath||'')) ? split(filePath) : split(rootPath).concat(split(filePath));
    parts.pop(); // Camera filenames never supply a field.
    const pole = parts.at(-1) || '', branch = parts.at(-2) || '', line = parts.at(-3) || '';
    // Inserted poles are identifiers, not arithmetic: retain the folder's exact + suffix and zero padding.
    const valid = /^(?:#\d+(?:[-_~+]\d+|[A-Za-z])?|\d+\+\d+)(?:号?[杆塔基])?$/.test(pole) &&
      !!branch && !/^[A-Za-z]:$/.test(branch) && /(?:线|线路)(?:[（(].*[）)])?$/.test(line) &&
      !/^[A-Za-z]:$/.test(line);
    return { line: valid ? line : '', branch: valid ? branch : '', pole: valid ? pole : '', valid };
  }
  function filename(location, rule) {
    const fields = [location.line, location.branch, location.pole, rule?.component, rule?.description, rule?.severity];
    if (fields.some(v => typeof v !== 'string' || !v || /[\\/:*?"<>|\x00-\x1f]/.test(v) || /[. ]$/.test(v)))
      throw new Error('请检查线路、主支线、杆号和缺陷规则，字段不能为空或含文件名非法字符');
    const name = fields.join('-') + '.jpg';
    if (name.length > 240) throw new Error('成果文件名过长，请检查目录字段');
    return name;
  }
  function validBoxes(boxes, width, height) {
    return (boxes || []).map((b, index) => {
      if (!b || ![b.x,b.y,b.w,b.h].every(Number.isFinite)) return null;
      const x = Math.max(0, Math.min(b.x, b.x + b.w)), y = Math.max(0, Math.min(b.y, b.y + b.h));
      const right = Math.min(width, Math.max(b.x, b.x + b.w)), bottom = Math.min(height, Math.max(b.y, b.y + b.h));
      return right-x >= 3 && bottom-y >= 3 ? {x,y,w:right-x,h:bottom-y,index} : null;
    }).filter(Boolean);
  }
  function fitRect(rect, width, height) {
    const w = Math.min(width, rect.w), h = Math.min(height, rect.h);
    const x = Math.max(0, Math.min(rect.x, width-w)), y = Math.max(0, Math.min(rect.y, height-h));
    const left = Math.floor(x), top = Math.floor(y);
    return {x:left,y:top,w:Math.min(width,Math.ceil(x+w))-left,h:Math.min(height,Math.ceil(y+h))-top};
  }
  function crop(boxes, width, height, options = {}, stroke = 10) {
    if (!(width > 0 && height > 0)) return null;
    const valid = validBoxes(boxes,width,height);
    if (!valid.length) return null;
    let target = valid.find(b => b.index === options.target);
    if (!target) target = valid.reduce((a,b) => b.w*b.h > a.w*a.h ? b : a);
    const margin = Number.isFinite(options.margin) ? Math.max(.1, Math.min(1.5, options.margin)) : .35;
    const padded = b => {
      const mx = Math.max(b.w*margin,stroke), my = Math.max(b.h*margin,stroke);
      return fitRect({x:b.x-mx,y:b.y-my,w:b.w+2*mx,h:b.h+2*my},width,height);
    };
    let rect = padded(target);
    const baseArea = rect.w*rect.h;
    for (const b of valid) {
      if (b === target || b.x > rect.x+rect.w || b.x+b.w < rect.x || b.y > rect.y+rect.h || b.y+b.h < rect.y) continue;
      const next = padded(b), x = Math.min(rect.x,next.x), y = Math.min(rect.y,next.y);
      const union = fitRect({x,y,w:Math.max(rect.x+rect.w,next.x+next.w)-x,h:Math.max(rect.y+rect.h,next.y+next.h)-y},width,height);
      if (union.w*union.h <= baseArea*2) rect = union;
    }
    return Object.assign(rect,{target:target.index});
  }
  return {OUTPUT_DIRS,LEGACY_DIRS,tag,findRule,dictionary,templateDictionary,templateRules,parseLocation,filename,validBoxes,crop};
});
