const fs = require('fs');
const path = '/Users/racs/clawd/projects/rich-aroma-os/api/store.js';
let content = fs.readFileSync(path, 'utf8');

const oldCode = `        const newCustomer = {
            id: \`C\${String(nextNum).padStart(3, '0')}\`,
            name: req.body.name,
            phone: req.body.phone.replace(/\\D/g, ''),
            email: req.body.email,
            points: 0
        };`;

const newCode = `        const newCustomer = {
            id: \`C\${String(nextNum).padStart(3, '0')}\`,
            name: req.body.name,
            phone: (req.body.phone || '').replace(/\\D/g, ''),
            email: req.body.email || null,
            points: 0
        };`;

content = content.replace(oldCode, newCode);
fs.writeFileSync(path, content);
console.log("Done");
