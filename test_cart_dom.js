const fs = require('fs');
const code = fs.readFileSync('/Users/racs/clawd/projects/rich-aroma-os/public/order.html', 'utf8');

// Check if guest-name-section exists in HTML
const idx = code.indexOf('id="guest-name-section"');
console.log("guest-name-section HTML found:", idx !== -1);
