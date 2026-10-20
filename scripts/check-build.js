'use strict';
// Read-only structural + syntax verification; supports intact installed patches too.
const patch = require('../lib/patch');
const root = process.argv[2];
if (!root) throw new Error('Usage: node scripts/check-build.js <VS Code appRoot>');
console.log(JSON.stringify({...patch.check(root), mutationsToInstalledApp:0}, null, 2));
