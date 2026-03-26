const fs = require('fs');
const file = '/Users/racs/clawd/projects/rich-aroma-os/vercel.json';
let data = JSON.parse(fs.readFileSync(file, 'utf8'));

// Check if route exists
const routeExists = data.routes.find(r => r.src === "/cali");
if (!routeExists) {
    // Add it near the end, before the catch-all
    const catchAllIndex = data.routes.findIndex(r => r.src === "/(.*)");
    
    data.routes.splice(catchAllIndex, 0, {
        "src": "/cali",
        "dest": "/public/cali/index.html"
    });
    
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log("Patched vercel.json with /cali route");
} else {
    console.log("Route already exists");
}
