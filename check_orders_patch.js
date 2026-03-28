const fs = require('fs');
const code = fs.readFileSync('/Users/racs/clawd/projects/rich-aroma-os/server.js', 'utf8');
const match = code.match(/app\.patch\('\/api\/orders\/:id'.*?\}\);/s);
if (match) {
    const start = code.indexOf("app.patch('/api/orders/:id'");
    console.log(code.substring(start, start + 2000));
}
