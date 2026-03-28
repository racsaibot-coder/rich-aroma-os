const fs = require('fs');
const code = fs.readFileSync('/Users/racs/clawd/projects/rich-aroma-os/public/pos-v2.html', 'utf8');
const match = code.match(/function renderVerifyModal\(\) \{.*?\}/s);
if (match) {
    // Extract a bit more
    const start = code.indexOf('function renderVerifyModal() {');
    console.log(code.substring(start, start + 1000));
}
