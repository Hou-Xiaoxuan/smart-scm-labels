'use strict';
const vscode = require('vscode');
const patch = require('./lib/patch');
function activate(context) {
  const output = vscode.window.createOutputChannel('Smart SCM Labels');
  context.subscriptions.push(output);
  const root = vscode.env.appRoot;
  const run = task => async () => {
    try { await task(); } catch (e) { output.appendLine(e.stack || String(e)); output.show(true); vscode.window.showErrorMessage(`Smart SCM: ${e.message}`); }
  };
  const register = (name, task) => context.subscriptions.push(vscode.commands.registerCommand('smartScm.' + name, run(task)));
  async function reload(message) {
    const choice = await vscode.window.showInformationMessage(message, 'Reload Window');
    if (choice) await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
  register('status', async () => { const commands = await vscode.commands.getCommands(true); output.appendLine(JSON.stringify({ ...patch.inspect(root), runtimeCommandRegistered: commands.includes('smartScm.internal.toggle') }, null, 2)); output.show(true); });
  register('checkCompatibility', async () => { output.appendLine(JSON.stringify(patch.check(root), null, 2)); output.show(true); });
  register('installPatch', async () => {
    if (vscode.env.uiKind === vscode.UIKind.Web) throw new Error('Desktop VS Code is required.');
    const report = patch.check(root);
    output.appendLine(JSON.stringify(report, null, 2));
    patch.install(root, require('node:path').join(context.globalStorageUri.fsPath, 'recovery'));
    await reload(report.compatibility === 'verified-build' ? 'Smart SCM patch installed. Reload the window once to load it.' : 'Smart SCM 实验兼容补丁已安装：结构与语法检查通过，此构建尚未经过窗口验收。重载后检查菜单、滚动和暂存操作；异常时执行 Remove Patch。');
  });
  register('removePatch', async () => {
    patch.remove(root);
    await vscode.workspace.getConfiguration('smartScm').update('enabled', false, vscode.ConfigurationTarget.Global);
    await reload('Original Workbench restored. Reload, then uninstall the extension if desired. Recovery files retained.');
  });
  register('toggle', async () => {
    if (!patch.inspect(root).patched) throw new Error('Install the patch and reload the window first.');
    const config = vscode.workspace.getConfiguration('smartScm');
    await config.update('enabled', !config.get('enabled'), vscode.ConfigurationTarget.Global);
  });
  // No automatic patch writes, elevation, checksum rewriting, or auto-reapply after upgrades.
}
exports.activate = activate;
