'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createPlanner}=require('../lib/layout');
const p=createPlanner(),root={scheme:'file',path:'/repo'},measure=s=>s.length*7;
const r=path=>({sourceUri:{scheme:'file',path:'/repo/'+path}});
const result=(rs,rules,width=2000,limit=2)=>p.plan(rs,width,measure,4,root,limit,[],rules);
const text=e=>e?.lines.map(l=>l.text).join('');
test('all four modes apply to a singleton even when the full path fits',()=>{
 const file=r('module/src/main/java/pkg/File.java'),before=JSON.stringify(file);
 for(const [mode,expected] of [['hide','pkg/File.java'],['abbreviate','m/s/m/j/pkg/File.java'],['ellipsis','…/pkg/File.java'],['replace','业务/pkg/File.java']]) {
  assert.equal(text(result([file],[{pattern:'module/src/main/java',mode,replacement:'业务'}]).get(file)),expected);
 }
 assert.equal(JSON.stringify(file),before);
});
test('anchored, directory-boundary, case-sensitive matching; wildcards never consume filename',()=>{
 const file=r('module/src/main/java/pkg/File.java');
 for(const pattern of ['src/main/java','mod','Module','module/src/main/java/pkg/File.java','module/s*','/module','../module']) {
  assert.equal(result([file],[{pattern,mode:'hide'}]).size,0,pattern);
 }
 for(const pattern of ['module/*/main/java','module/**/java','**/java']) {
  assert.equal(text(result([file],[{pattern,mode:'ellipsis'}]).get(file)),'…/pkg/File.java');
 }
 assert.equal(text(result([file],[{pattern:'module/**/src',mode:'replace',replacement:'X'}]).get(file)),'X/main/java/pkg/File.java');
 assert.equal(text(result([file],[{pattern:'**',mode:'ellipsis'}]).get(file)),'…/File.java');
});
test('first valid matching rule wins without cascading; greedy ** is deterministic',()=>{
 const file=r('a/repeated/b/repeated/c/F.java');
 const rules=[{pattern:'missing',mode:'hide'},{pattern:'a/**/repeated',mode:'replace',replacement:'X'},{pattern:'**',mode:'hide'}];
 assert.equal(text(result([file],rules).get(file)),'X/c/F.java');
 assert.equal(text(result([file],[{pattern:'a',mode:'replace'},...rules]).get(file)),'X/c/F.java');
});
test('replacement text and forced abbreviation are atomic during narrow layout',()=>{
 const file=r('module/src/main/java/pkg/LongFilename.java');
 for(const width of [48,70,100,180]) for(const [mode,value] of [['replace','Custom <label>/literal'],['ellipsis','…'],['abbreviate','m/s/m/j']]) {
  const e=result([file],[{pattern:'module/src/main/java',mode,replacement:value}],width,1).get(file);
  assert.ok(e.lines[0].text.startsWith(value+'/'),e.lines[0].text);
  assert.ok(e.lines[0].text.endsWith('LongFilename.java'));
 }
});
test('group heading and own path stay separate; rules crossing shared boundary stay explicit',()=>{
 const rs=[r('module/src/main/java/pkg/risk/Risk.java'),r('module/src/main/java/pkg/show/Show.java')];
 let plan=result(rs,[{pattern:'module/src/main/java',mode:'replace',replacement:'Java'}],100,2);
 assert.equal(plan.get(rs[0]).commonLines.map(l=>l.text).join(''),'Java/pkg/');
 assert.equal(plan.get(rs[0]).ownLines.map(l=>l.text).join(''),'risk/Risk.java');
 assert.equal(plan.get(rs[1]).lines.length,1);
 plan=result(rs,[{pattern:'module/src/main/java/pkg/*',mode:'replace',replacement:'Item'}],100,2);
 for(const file of rs) {assert.equal(plan.get(file).commonPath,undefined);assert.equal(text(plan.get(file)),'Item/'+p.name(file));}
});
test('per-resource rules, repository boundaries, empty list legacy fallback and precedence',()=>{
 const a=r('module/src/one/A.java'),b=r('module/src/two/B.java');
 const plan=result([a,b],x=>[{pattern:'module/src',mode:'replace',replacement:x===a?'One':'Two'}]);
 assert.equal(text(plan.get(a)),'One/one/A.java');assert.equal(text(plan.get(b)),'Two/two/B.java');
 const remote={sourceUri:{...a.sourceUri,authority:'remote'}};
 assert.equal(result([remote],[{pattern:'**',mode:'hide'}]).size,0);
 const rs=[r('module/src/longcommon/A.java'),r('module/src/longcommon/B.java')];
 const plan2=p.plan(rs,100,measure,4,root,2,['src'],[{pattern:'absent',mode:'hide'}]);
 assert.equal(plan2.get(rs[0]).commonLines.map(l=>l.text).join(''),'module/src/longcommon/');
});
