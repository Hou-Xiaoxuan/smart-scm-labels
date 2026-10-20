'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const patch=require('../lib/patch');
test('missing structure and unsupported version format are rejected',()=>{
 assert.throws(()=>patch.transform('anything','2.0.0'),/Unsupported/);
 assert.throws(()=>patch.transform('anything',patch.VERSION),/Incompatible SCM structure/);
});
const installed=process.env.SMART_SCM_TEST_APP;
test('real-bundle install, idempotence, tamper refusal, restore and interrupted recovery', {skip:!installed},()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'smart-scm-test-'));
 try {
  const loc=patch.locations(root); fs.mkdirSync(path.dirname(loc.target),{recursive:true});
  const original=fs.readFileSync(patch.locations(installed).target);
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({version:patch.VERSION})); fs.writeFileSync(loc.target,original);
  const recovery=path.join(root,'external');
  assert.equal(patch.install(root,recovery).patched,true); assert.equal(patch.install(root).patched,true);
  const externalDir=path.join(recovery,patch.VERSION,patch.inspect(root).hash.slice(0,12));
  assert.deepEqual(fs.readFileSync(path.join(externalDir,'original.js')),original);
  const patched=fs.readFileSync(loc.target);
  fs.appendFileSync(loc.target,'\n//another tool'); assert.throws(()=>patch.remove(root),/updated or bundle modified/);
  fs.writeFileSync(loc.target,patched); assert.equal(patch.remove(root).patched,false);
  assert.deepEqual(fs.readFileSync(loc.target),original);
  // Target restored but process stopped before user reloaded: restore again is safe.
  assert.equal(patch.remove(root).patched,false);
  // External backup remains usable after application-local recovery files are lost.
  fs.unlinkSync(loc.backup); fs.unlinkSync(loc.receipt); fs.writeFileSync(loc.target,patched);
  assert.equal(patch.remove(root,externalDir).patched,false);
  assert.deepEqual(fs.readFileSync(loc.target),original);
  // Never restore over an application update.
  fs.writeFileSync(loc.target,'updated editor'); assert.throws(()=>patch.remove(root,externalDir),/updated or bundle modified/);
 } finally {fs.rmSync(root,{recursive:true});}
});

test('different hashes and versions use structural preflight and their own recovery receipts', {skip:!installed},()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'smart-scm-compatible-'));
 try {
  const loc=patch.locations(root); fs.mkdirSync(path.dirname(loc.target),{recursive:true});
  // A simulated build variation, NOT evidence of real 1.143 compatibility.
  const original=fs.readFileSync(patch.locations(installed).target,'utf8')+'\n// unrelated build variation\n';
  const version='1.143.0';
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({version})); fs.writeFileSync(loc.target,original);
  assert.equal(patch.check(root).compatibility,'experimental-structure-match');
  assert.equal(fs.existsSync(loc.backup),false);
  const external=path.join(root,'recovery'); patch.install(root,external);
  const receipt=JSON.parse(fs.readFileSync(loc.receipt));
  assert.equal(receipt.version,version); assert.equal(receipt.original,patch.hash(original));
  const recovery=path.join(external,version,receipt.patched.slice(0,12));
  assert.equal(patch.check(root).compatibility,'experimental-structure-match');
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({version:'1.144.0'}));
  assert.throws(()=>patch.remove(root,recovery),/version changed/);
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({version}));
  fs.appendFileSync(loc.backup,'tampered'); assert.throws(()=>patch.remove(root),/Backup hash mismatch/);
  patch.remove(root,recovery); assert.equal(fs.readFileSync(loc.target,'utf8'),original);
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test('structural conflicts and invalid generated syntax leave the app untouched', {skip:!installed},()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'smart-scm-conflict-'));
 try {
  const loc=patch.locations(root); fs.mkdirSync(path.dirname(loc.target),{recursive:true});
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({version:'1.143.0'}));
  const original=fs.readFileSync(patch.locations(installed).target,'utf8');
  const variations=[
   [original.replace('V(yMi);V(IMi);V(aAo);V(cAo);','V(yMi);V(IMi);V(aAo);'), /SCM menu dependencies/],
   [original+'\n/* if(this.viewMode()==="list"){if(this.viewSortKey()==="name") */', /resource sorting/],
   [original+'\nconst broken = ;', /syntax validation/],
   [original+'\n// __smartScm', /Existing Smart SCM/]
  ];
  for(const [source,error] of variations){
   fs.writeFileSync(loc.target,source);
   assert.throws(()=>patch.install(root,path.join(root,'recovery')),error);
   assert.equal(fs.readFileSync(loc.target,'utf8'),source);
   assert.equal(fs.existsSync(loc.backup),false); assert.equal(fs.existsSync(loc.receipt),false);
   assert.equal(fs.existsSync(path.join(root,'recovery')),false);
  }
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
