const fs = require('fs');
const code = fs.readFileSync('/Users/racs/clawd/projects/rich-aroma-os/server.js', 'utf8');
const start = code.indexOf("app.post('/api/topup'");
if (start === -1) {
    console.log("Not found");
    process.exit(0);
}
let openBraces = 0;
let i = start;
while (i < code.length) {
    if (code[i] === '{') openBraces++;
    if (code[i] === '}') {
        openBraces--;
        if (openBraces === 0) {
            break;
        }
    }
    i++;
}
console.log(code.substring(start, i + 2)); // includes the '});'
