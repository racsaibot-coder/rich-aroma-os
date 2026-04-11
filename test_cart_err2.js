const fs = require('fs');
const code = fs.readFileSync('/Users/racs/clawd/projects/rich-aroma-os/public/order.html', 'utf8');

const match = code.match(/function renderPaymentOptions\(\) \{.*?(?=function selectSecondaryPayment)/s);
if (match) console.log(match[0]);
