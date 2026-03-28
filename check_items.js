const fs = require('fs');
const code = fs.readFileSync('/Users/racs/clawd/projects/rich-aroma-os/server.js', 'utf8');
const match = code.match(/app\.patch\('\/api\/orders\/:id'.*?\/\/\ 1\.5/s);
console.log(match ? match[0] : 'not found');
