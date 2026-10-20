'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createPlanner} = require('../lib/layout');
const p = createPlanner(), measure = s => s.length * 7;
const resource = (name, dir = '/src/service') => ({sourceUri:{path:dir+'/'+name,scheme:'file',authority:''}});
const files = () => ['CpActivityRecommendationService.java','CpActivityRecommendationServiceImpl.java','CpActivityRecommendationServiceFactory.java'].map(n => resource(n));
test('directory order and CamelCase prefix with true first-row height', () => {
  const rs = files(), plan = p.plan(rs, 140, measure);
  assert.equal(plan.size, 3);
  assert.equal(plan.get(rs[0]).prefix, 'CpActivityRecommendation');
  assert.equal(plan.get(rs[0]).height, 44);
  assert.equal(plan.get(rs[1]).suffix, 'ServiceImpl.java');
  assert.equal(plan.get(rs[1]).height, 22);
  assert.deepEqual(p.plan([...rs].reverse(), 140, measure), plan);
});
test('wide panel, tiny panel, single resource and unrelated names stay native', () => {
  assert.equal(p.plan(files(), 1000, measure).size, 0);
  assert.equal(p.plan(files(), 30, measure).size, 0);
  assert.equal(p.plan(files().slice(0,1), 140, measure).size, 0);
  assert.equal(p.plan([resource('Apple.java'),resource('Banana.java')],100,measure).size,0);
});
test('directories, authorities and SCM groups never share prefixes', () => {
  const rs = [resource('CpActivityRecommendationRequest.java','/a'),resource('CpActivityRecommendationResponse.java','/b')];
  assert.equal(p.plan(rs,100,measure).size,0);
  rs[1].sourceUri.path = rs[0].sourceUri.path; rs[1].sourceUri.authority='remote';
  assert.equal(p.plan(rs,100,measure).size,0);
  assert.equal(p.plan(files().slice(0,1),100,measure).size,0);
});
test('scroll subsets do not affect full-model plan; deletion changes the first resource', () => {
  const rs=files(), before=p.plan(rs,140,measure);
  assert.equal(before.get(rs[1]).first,false);
  const after=p.plan(rs.slice(1),140,measure);
  assert.equal(after.get(rs[2]).first,true); // Factory sorts before Impl.
});
test('acronym boundary and suffix reconstruction; never mutate resource model', () => {
  const rs=['LongCommonHTTPClient.java','LongCommonHTTPServer.java'].map(n=>resource(n));
  const snapshot=JSON.stringify(rs), plan=p.plan(rs,80,measure,4);
  for(const [r,e] of plan) assert.equal(e.prefix+e.suffix,p.name(r));
  assert.equal(JSON.stringify(rs),snapshot);
  assert.ok(plan.size);
  assert.ok(p.compare(resource('Z.java','/a'),resource('A.java','/b'))<0);
});
test('repository-relative common path wraps at directory boundaries for unrelated names',()=>{
 const root={scheme:'file',path:'/work/repo',authority:''};
 const rs=[resource('Risk.java','/work/repo/module/src/main/java/example/feature/risk'),resource('Showcase.java','/work/repo/module/src/main/java/example/feature/showcase'),resource('History.java','/work/repo/module/src/main/java/example/query')];
 const plan=p.plan(rs,140,measure,12,root,10);
 assert.equal(plan.size,3);
 const sorted=[...rs].sort(p.compare);
 for (const r of sorted) {
  const e=plan.get(r);assert.equal(e.commonPath,'module/src/main/java/example/');
  const suffix=e.lines.filter(l=>!l.prefix).map(l=>l.text).join('');
  assert.equal(e.commonPath+suffix,r.sourceUri.path.slice(root.path.length+1));
  assert.equal(e.height,e.lines.length*22);
  assert.ok(!e.lines.some(l=>l.text.includes('/work/')));
 }
 assert.ok(plan.get(sorted[0]).lines.filter(l=>l.prefix).length>1);
 assert.ok(plan.get(sorted[1]).lines.every(l=>!l.prefix));
 assert.equal(p.plan(rs,2000,measure,12,root).size,0);
 assert.deepEqual(p.plan([...rs].reverse(),140,measure,12,root,10),plan);
 assert.equal(p.plan([rs[0]],140,measure,12,root).get(rs[0]).commonPath,undefined);
});
test('path and filename folding compose without losing directory or basename text',()=>{
 const root={scheme:'file',path:'/work/repo'};
 const rs=files().map(r=>resource(p.name(r),'/work/repo/longModule/src/main/java/service'));
 const plan=p.plan(rs,140,measure,12,root,10);
 for(const r of rs){const e=plan.get(r);assert.equal(e.prefix+e.suffix,p.name(r));assert.ok(e.commonPath);assert.equal(e.height,e.lines.length*22);}
 const remote=rs.map(r=>({...r,sourceUri:{...r.sourceUri,authority:'other'}}));
 assert.ok([...p.plan(remote,140,measure,12,root).values()].every(e=>!e.commonPath));
});
test('test outlier preserves deep main group; partitions do not depend on viewport width',()=>{
 const root={scheme:'file',path:'/repo'};
 const base='/repo/module/src/main/java/com/example/business/gravityplan';
 const rs=[resource('Risk.java',base+'/module/risk'),resource('Showcase.java',base+'/module/showcase'),resource('History.java',base+'/query')];
 const outlier=resource('FlowTest.java','/repo/module/src/test/java/com/example/business/gravityplan');
 const before=p.plan(rs,180,measure,12,root), after=p.plan([...rs,outlier],180,measure,12,root);
 for(const r of rs) assert.equal(after.get(r).commonPath,before.get(r).commonPath);
 assert.equal(after.get(outlier).commonPath,undefined);
 for(const width of [100,200,400]) for(const r of rs) assert.equal(p.plan([...rs,outlier],width,measure,12,root).get(r).commonPath,before.get(r).commonPath);
 const group=p.plan([...rs,outlier],180,measure,12,root);
 assert.deepEqual(group,p.plan([outlier,...rs.reverse()],180,measure,12,root));
});
test('shared line budget caps path plus basename folding and retains basename',()=>{
 const root={scheme:'file',path:'/repo'};
 const rs=files().map(r=>resource(p.name(r),'/repo/module/src/main/java/com/example/business/service'));
 for(const limit of [1,2,3]) {
  const plan=p.plan(rs,100,measure,12,root,limit);
  for(const [r,e] of plan) {
   assert.ok(e.lines.length<=limit);assert.equal(e.height,22*e.lines.length);
   assert.ok(e.lines.at(-1).text.endsWith(e.suffix));
   assert.equal(e.prefix+e.suffix,p.name(r));
  }
 }
 assert.ok([...p.plan(rs,100,measure,12,root).values()].every(e=>e.height<=44));
});
test('inherited directory uses one level; followers never wrap at budget two',()=>{
 const root={scheme:'file',path:'/repo'};
 const base='/repo/longModule/src/main/java/business';
 const rs=[resource('Alpha.java',base+'/longOuterDirectory/longInnerDirectory'),resource('Beta.java',base+'/otherOuterDirectory/otherInnerDirectory')];
 for(const width of [90,140,200]) {
  const plan=p.plan(rs,width,measure,12,root,2);
  assert.equal(plan.get(rs[0]).pathFirst,true);
  assert.equal(plan.get(rs[0]).lines.length,2);
  assert.equal(plan.get(rs[1]).lines.length,1);
  assert.equal(plan.get(rs[1]).height,22);
  assert.ok(plan.get(rs[1]).lines[0].text.endsWith('Beta.java'));
 }
});
test('shrink outer directories first, then remove directories, finally ellipsize filename',()=>{
 const root={scheme:'file',path:'/repo'},r=resource('Report.java','/repo/outerDirectory/innerDirectory');
 const text=width=>p.plan([r],width,measure,12,root,1).get(r).lines[0].text;
 assert.equal(text(220),'o/innerDirectory/Report.java');
 assert.equal(text(105),'o/i/Report.java');
 assert.equal(text(91),'o/i/Report.java');
 assert.equal(text(77),'o/i/Report.java');
 assert.equal(text(60),'o/i/Report.java'); // CSS clips only the right side.
});

test('common directory line compresses middle while keeping first and last initials',()=>{
 const root={scheme:'file',path:'/repo'};
 const rs=['Alpha.java','Beta.java'].map(n=>resource(n,'/repo/outerModule/src/main/java/lastPackage'));
 const e=p.plan(rs,120,measure,4,root,2).get(rs[0]);
 assert.ok(e.lines[0].text.startsWith('o/'));
 assert.ok(e.lines[0].text.endsWith('lastPackage/'));
 const narrow=p.plan(rs,60,measure,4,root,2).get(rs[0]);
 assert.equal(narrow.lines[0].text,'o/…/l/');
 assert.ok(e.lines[0].text.includes('…/'));
 assert.equal(e.lines.length,2);
});
test('hide exact directory sequences only inside common prefix, retain real paths',()=>{
 const root={scheme:'file',path:'/repo'};
 const rs=['Alpha.java','Beta.java'].map(n=>resource(n,'/repo/module/src/main/java/company/common'));
 const plan=p.plan(rs,170,measure,4,root,10,['src/main/java','com']);
 const e=plan.get(rs[0]);
 assert.equal(e.commonPath,'module/src/main/java/company/common/');
 assert.equal(e.lines.filter(l=>l.prefix).map(l=>l.text).join(''),'module/company/common/');
 assert.ok(e.relative.includes('src/main/java'));
 const hidden=p.plan(rs,170,measure,4,root,2,['module/src/main/java/company/common']);
 assert.equal(hidden.get(rs[0]).lines[0].text,'Alpha.java');
});
test('folder-specific hiding is resolved per resource and never hides differing directories',()=>{
 const root={scheme:'file',path:'/repo'};
 const a=resource('A.java','/repo/module/src/main/java/alpha'),b=resource('B.java','/repo/module/src/main/java/beta');
 const calls=[];
 const e=p.plan([a,b],100,measure,4,root,2,r=>{calls.push(r);return ['src/main/java','alpha'];}).get(a);
 assert.equal(e.lines[0].text,'module/');
 assert.ok(e.lines.at(-1).text.endsWith('A.java'));
 assert.ok(e.lines.at(-1).text.startsWith('a'));
 assert.ok(calls.includes(a));
});
test('screenshot regression: shared heading never absorbs the first resource directory',()=>{
 const root={scheme:'file',path:'/repo'};
 const base='/repo/beethoven-gameplay-entrance/src/main/java/com/xiaohongshu/growth/beethoven/gameplay/entrance/gravityplan';
 const rs=[resource('GravityPlanRiskModule.java',base+'/module/risk'),resource('ShowcaseModule.java',base+'/module/showcase'),resource('NoteHistoryAssembler.java',base+'/query')];
 const testFile=resource('GravityPlanFlowTest.java',base.replace('/main/','/test/'));
 const snapshot=JSON.stringify(rs);
 for(const width of [60,100,180,280,400,600]) for(const limit of [1,2,3,10]) for(const hidden of [[],['src/main/java','com/xiaohongshu/growth/beethoven']]) {
  const plan=p.plan([...rs,testFile],width,measure,12,root,limit,hidden),first=plan.get(rs[0]);
  assert.equal(first.commonPath,base.slice(root.path.length+1)+'/');
  assert.equal(first.commonLines.map(l=>l.text).join(''),hidden.length?'beethoven-gameplay-entrance/gameplay/entrance/gravityplan/':first.commonPath);
  assert.equal(first.ownLines.map(l=>l.text).join(''),'module/risk/GravityPlanRiskModule.java');
  assert.ok(first.lines.filter(l=>l.section==='commonPath').every(l=>!l.text.includes('risk')&&!l.text.includes('Risk')));
  assert.ok(first.lines.at(-1).text.endsWith('GravityPlanRiskModule.java'));
  if(limit===2) {
   assert.equal(first.lines.length,2);
   assert.equal(first.lines[0].section,'commonPath');
   assert.equal(first.lines[1].section,'resource');
   assert.match(first.lines[1].text,/^(module\/risk\/|m\/risk\/|m\/r\/|…\/r\/|r\/)/);
   assert.equal(plan.get(rs[1]).lines.length,1);
  }
  if(limit===1) assert.ok(first.lines.every(l=>l.section==='resource'));
  assert.ok(first.height<=limit*22);
 }
 assert.equal(JSON.stringify(rs),snapshot);
});
test('first-resource promotion does not change its own single-line representation',()=>{
 const root={scheme:'file',path:'/repo'};
 const base='/repo/veryLongModule/src/main/java/shared';
 const rs=[resource('Alpha.java',base+'/aaa'),resource('Beta.java',base+'/bbb'),resource('Gamma.java',base+'/ccc')];
 for(const width of [60,100,200]) {
  const before=p.plan(rs,width,measure,4,root,2),after=p.plan(rs.slice(1),width,measure,4,root,2);
  assert.equal(after.get(rs[1]).lines.at(-1).text,before.get(rs[1]).lines.at(-1).text);
  assert.equal(after.get(rs[1]).commonLines.map(l=>l.text).join(''),after.get(rs[1]).commonPath);
 }
});
test('filename prefix and differing directories cannot leak into common directory heading',()=>{
 const root={scheme:'file',path:'/repo'},base='/repo/module/src/main/java/shared';
 const rs=[...files().map(r=>resource(p.name(r),base+'/service')),resource('Other.java',base+'/zz')];
 const plan=p.plan(rs,100,measure,4,root,2),first=plan.get(rs[0]);
 assert.equal(first.commonLines.map(l=>l.text).join(''),'module/src/main/java/shared/');
 assert.equal(first.ownLines.map(l=>l.text).join(''),'service/'+p.name(rs[0]));
 assert.ok(!first.lines[0].text.includes('CpActivity'));
 assert.match(first.lines[1].text,/^s\//);
 assert.ok(first.lines[1].text.endsWith(p.name(rs[0])));
});

test('short directory initials survive narrow widths; omissions always carry a marker',()=>{
 const root={scheme:'file',path:'/repo'};
 const short=resource('GravityPlanRiskModule.java','/repo/module/risk');
 const deep=resource('GravityPlanRiskModule.java','/repo/alpha/bravo/charlie/delta/echo');
 for(const width of [48,60,90,120]) {
  const shortText=p.plan([short],width,measure,4,root,1).get(short).lines[0].text;
  assert.equal(shortText,'m/r/GravityPlanRiskModule.java');
  const deepText=p.plan([deep],width,measure,4,root,1).get(deep).lines[0].text;
  assert.equal(deepText,'…/e/GravityPlanRiskModule.java');
 }
 // An unusually wide ellipsis must not make the representation wider.
 const wideEllipsis=s=>s.length*7+(s.includes('…')?100:0);
 assert.equal(p.plan([deep],90,wideEllipsis,4,root,1).get(deep).lines[0].text,'a/b/c/d/e/GravityPlanRiskModule.java');
});
