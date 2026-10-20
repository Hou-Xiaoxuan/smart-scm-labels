'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const cp = require('node:child_process');
const { createPlanner } = require('./layout');
const { installRuntime } = require('./runtime');
const VERSION = '1.142.0';
const ORIGINAL_HASH = '74de4ceb93610658c5eb15b64b228d085f25c9c95d6ec8b002f791df7be4614c';
const MARK = '/* SMART_SCM_LABELS_0_1_0 */';
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
function once(source, before, after, label) {
  if (source.split(before).length !== 2) throw new Error(`Incompatible SCM structure (${label}): expected exactly one anchor; found ${source.split(before).length - 1}. No files changed.`);
  return source.replace(before, after);
}
function transform(source, version) {
  if (!/^1\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) throw new Error('Unsupported desktop version format.');
  if (source.includes(MARK) || source.includes('__smartScm') || source.includes('smartScm.internal.toggle')) throw new Error('Existing Smart SCM injection detected; restore before replacing it.');
  // Verify menu dependencies in their original SCM context, not merely somewhere in the bundle.
  once(source, 'IMi=class extends Jr{constructor(o="workbench.scm.action.setTreeViewMode",e={}){super({id:o,title:', '', 'tree action base');
  once(source, 'viewId:YS,f1:!1,icon:A.listFlat,toggled:Iu.SCMViewMode.isEqualTo("tree")', '', 'tree action context');
  once(source, 'cAo=class extends IMi{constructor(){super("workbench.scm.action.setTreeViewModeNavigation",{id:O.SCMTitle,when:T.and(T.equals("view",YS),Iu.RepositoryCount.notEqualsTo(0),Iu.SCMViewMode.isEqualTo("list")),group:"navigation",isHiddenByDefault:!0,order:-1e3})}};V(yMi);V(IMi);V(aAo);V(cAo);', '', 'SCM menu dependencies');
  let out = source;
  out = once(out, 'renderBody(e){super.renderBody(e),this.treeContainer=E(e,_(".scm-view.show-file-icons"))',
    'renderBody(e){queueMicrotask(()=>globalThis.__smartScm.attach(this));super.renderBody(e),this.treeContainer=E(e,_(".scm-view.show-file-icons"))', 'view attachment');
  out = once(out, 'getHeight(o){return HB(o)?this.inputRenderer.getHeight(o):WB(o)?pre.DEFAULT_HEIGHT+8:22}',
    'getHeight(o){return HB(o)?this.inputRenderer.getHeight(o):WB(o)?pre.DEFAULT_HEIGHT+8:globalThis.__smartScm.height(o)}', 'row height');
  out = once(out, 'if(this.viewMode()==="list"){if(this.viewSortKey()==="name")',
    'if(this.viewMode()==="list"){if(globalThis.__smartScm.active())return globalThis.__smartScm.compare(o,e);if(this.viewSortKey()==="name")', 'resource sorting');
  out = once(out, 'o.decorationIcon.title="")}dispose(){this.disposables.dispose()}};eSe=',
    'o.decorationIcon.title="");globalThis.__smartScm.render(o,e)}dispose(){this.disposables.dispose()}};eSe=', 'resource renderer');
  out = once(out, 'await this.tree.updateChildren(void 0),t&&this.inputRenderer.getRenderedInputWidget(t)?.focus()',
    'await this.tree.updateChildren(void 0),globalThis.__smartScm.changed(),t&&this.inputRenderer.getRenderedInputWidget(t)?.focus()', 'resource refresh');
  const registration = 'V(class extends Jr{constructor(){super({id:"smartScm.internal.toggle",title:"Smart SCM: 智能文件名折叠",viewId:YS,f1:!1,toggled:T.equals("config.smartScm.enabled",!0),precondition:Iu.SCMViewMode.isEqualTo("list"),menu:{id:O.SCMTitle,when:T.and(T.equals("view",YS),Iu.RepositoryCount.notEqualsTo(0),Iu.SCMViewMode.isEqualTo("list")),group:"navigation",isHiddenByDefault:!0,order:-999}})}async runInView(o,e){await e.configurationService.updateValue("smartScm.enabled",!e.configurationService.getValue("smartScm.enabled"))}});';
  out = once(out, 'V(yMi);V(IMi);V(aAo);V(cAo);', 'V(yMi);V(IMi);V(aAo);V(cAo);' + registration, 'menu registration');
  const result = `${MARK}\n;(${installRuntime.toString()})(${createPlanner.toString()});\n${out}`;
  validateSyntax(result);
  return result;
}
function validateSyntax(source) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-scm-syntax-'));
  try {
    const file = path.join(dir, 'workbench.mjs'); fs.writeFileSync(file, source);
    const result = cp.spawnSync(process.execPath, ['--check', file], {
      env: {...process.env, ELECTRON_RUN_AS_NODE:'1'}, encoding:'utf8', timeout:30000, maxBuffer:1024 * 1024
    });
    if (result.error || result.status !== 0) throw new Error('Generated Workbench failed syntax validation. No files changed. ' + (result.error?.message || result.stderr?.slice(-800) || 'Check process failed.'));
  } finally { fs.rmSync(dir, {recursive:true, force:true}); }
}
function compatibility(version, source) {
  return version === VERSION && hash(source) === ORIGINAL_HASH ? 'verified-build' : 'experimental-structure-match';
}
function check(appRoot) {
  const info = inspect(appRoot);
  const source = fs.readFileSync(info.patched ? info.backup : info.target, 'utf8');
  if (info.patched) {
    const receipt = JSON.parse(fs.readFileSync(info.receipt));
    if (receipt.patched !== info.hash || receipt.original !== hash(source) || receipt.version !== info.version) throw new Error('Installed patch or backup changed; compatibility check refused.');
  }
  transform(source, info.version);
  return {version:info.version, originalHash:hash(source), compatibility:compatibility(info.version, source), syntax:'PASS', installed:info.patched};
}
function locations(appRoot) {
  const target = path.join(appRoot, 'out/vs/workbench/workbench.desktop.main.js');
  return { target, backup: target + '.smart-scm-original', receipt: target + '.smart-scm.json' };
}
function atomic(file, data, mode) {
  const tmp = file + '.smart-scm-tmp';
  const fd = fs.openSync(tmp, 'wx', mode);
  try { fs.writeFileSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  try { fs.renameSync(tmp, file); } catch (e) { fs.unlinkSync(tmp); throw e; }
}
function inspect(appRoot) {
  const p = locations(appRoot), source = fs.readFileSync(p.target, 'utf8');
  return { ...p, version: JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'))).version,
    hash: hash(source), patched: source.startsWith(MARK), backupExists: fs.existsSync(p.backup), receiptExists: fs.existsSync(p.receipt) };
}
function install(appRoot, recoveryRoot) {
  const info = inspect(appRoot);
  if (info.patched) {
    const receipt = JSON.parse(fs.readFileSync(info.receipt));
    if (receipt.patched !== info.hash || receipt.version !== info.version) throw new Error('Patched bundle changed; refusing overwrite.');
    return info;
  }
  if (info.backupExists || info.receiptExists) throw new Error('Existing recovery files found. Inspect/recover before installing again.');
  const source = fs.readFileSync(info.target, 'utf8'), patched = transform(source, info.version), mode = fs.statSync(info.target).mode;
  const receiptData = JSON.stringify({ version: info.version, original: hash(source), patched: hash(patched), compatibility:compatibility(info.version, source) }, null, 2);
  if (recoveryRoot) {
    const recoveryDir = path.join(recoveryRoot, info.version, hash(patched).slice(0, 12));
    fs.mkdirSync(recoveryDir, { recursive: true });
    const external = path.join(recoveryDir, 'original.js');
    if (fs.existsSync(external) && hash(fs.readFileSync(external)) !== hash(source)) throw new Error('External recovery backup changed.');
    if (!fs.existsSync(external)) fs.writeFileSync(external, source, { flag: 'wx' });
    fs.writeFileSync(path.join(recoveryDir, 'receipt.json'), receiptData);
  }
  // Complete backup + receipt before replacing the original. A failed install remains recoverable.
  fs.writeFileSync(info.backup, source, { flag: 'wx', mode });
  fs.writeFileSync(info.receipt, receiptData, { flag: 'wx', mode });
  atomic(info.target, patched, mode);
  return inspect(appRoot);
}
function remove(appRoot, recoveryDir) {
  const info = inspect(appRoot);
  const receipt = JSON.parse(fs.readFileSync(recoveryDir ? path.join(recoveryDir, 'receipt.json') : info.receipt)), original = fs.readFileSync(recoveryDir ? path.join(recoveryDir, 'original.js') : info.backup);
  if (!/^[a-f0-9]{64}$/.test(receipt.original) || hash(original) !== receipt.original) throw new Error('Backup hash mismatch; refusing restore.');
  if (info.version !== receipt.version) throw new Error('VS Code version changed; refusing restore from another version.');
  if (info.hash !== receipt.patched && info.hash !== receipt.original) throw new Error('VS Code updated or bundle modified. Refusing to overwrite it with an old backup.');
  if (info.hash !== receipt.original) atomic(info.target, original, fs.statSync(info.target).mode);
  // Backup deliberately retained for emergency recovery; explicit cleanup after successful reload.
  return inspect(appRoot);
}
module.exports = { VERSION, ORIGINAL_HASH, MARK, hash, transform, locations, install, remove, inspect, check };
