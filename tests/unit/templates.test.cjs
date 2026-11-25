const {test}=require('node:test'),assert=require('node:assert/strict');
const core=require('../../app/wuhu-core.js'),template=require('../fixtures/imported-template-147.json');
test('all 26 imported categories and 147 rules supply their own rendering and filename fields',()=>{
 const dict=core.templateDictionary(template.defectDict),rules=core.templateRules(dict,new Set(template.criticalDefects),require('../../app/wuhu-rules.json'));
 assert.equal(Object.keys(dict).length,26);assert.equal(rules.size,147);
 for(const [category,tags]of Object.entries(dict))for(const tag of tags){const r=rules.get(tag);assert.ok(r,tag);assert.equal(core.tag(r),tag);assert.ok(core.filename({line:'10kV测试线',branch:'主线',pole:'#001'},r).endsWith(tag.slice(1)+'.jpg'));}
 assert.equal(rules.get(template.defectDict['线夹'][0]).component,'线夹');
});
test('arbitrary categories, hyphens, legacy free labels and explicit grades work without built-in membership',()=>{
 const dict=core.templateDictionary({'全新-设备':['_全新-设备-复杂-新缺陷-严重','_全新-设备-自定义'],任意分类:['_未知元件-新描述-危急','纯文字标签']});
 const rules=core.templateRules(dict,new Set(['_全新-设备-自定义']));
 assert.equal(rules.size,4);assert.deepEqual([rules.get('_全新-设备-复杂-新缺陷-严重').component,rules.get('_全新-设备-复杂-新缺陷-严重').description],['全新-设备','复杂-新缺陷']);
 assert.equal(rules.get('_全新-设备-自定义').severity,'危急');assert.equal(rules.get('纯文字标签').component,'任意分类');assert.equal(rules.get('纯文字标签').severity,'一般');
 assert.throws(()=>core.templateDictionary({bad:'not an array'}));assert.throws(()=>core.templateDictionary({bad:[null]}));
});
