'use strict';
// Works even when the editor cannot start. Does not require the vscode module.
const patch = require('../lib/patch');
const [action, root, recoveryDir] = process.argv.slice(2);
if (!root || !['status','remove'].includes(action)) {
  console.error('Usage: node scripts/recover.js status|remove <VS Code appRoot>'); process.exitCode=1;
} else {
  try { console.log(JSON.stringify(action==='remove'?patch.remove(root, recoveryDir):patch.inspect(root),null,2)); }
  catch(e) {console.error(e.message);process.exitCode=1;}
}
