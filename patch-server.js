const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'server.js');
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('const multer = require("multer");')) {
    code = code.replace(
        "const cors = require('cors');",
        "const cors = require('cors');\nconst multer = require('multer');\nconst upload = multer({ dest: 'public/uploads/' });"
    );
}

if (!code.includes('/api/upload-receipt')) {
    const uploadCode = `
app.post('/api/upload-receipt/:id', upload.single('receipt'), (req, res) => {
    const orderId = req.params.id;
    const orderIndex = MOCK_DB.orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return res.status(404).json({ error: 'Order not found' });
    
    MOCK_DB.orders[orderIndex].status = 'pending_verification';
    MOCK_DB.orders[orderIndex].receiptUrl = '/uploads/' + req.file.filename;
    
    io.emit('orders_updated');
    res.json(MOCK_DB.orders[orderIndex]);
});
`;
    code = code.replace("app.post('/api/orders'", uploadCode + "\napp.post('/api/orders'");
}

fs.writeFileSync(file, code);
console.log('Patched server.js');
