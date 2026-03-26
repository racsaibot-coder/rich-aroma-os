const fs = require('fs');
const file = '/Users/racs/clawd/projects/rich-aroma-os/public/order.html';
let code = fs.readFileSync(file, 'utf8');

const uploadFn = `
        async function uploadReceipt() {
            const input = document.getElementById('receipt-upload');
            const statusDiv = document.getElementById('receipt-upload-status');
            if (!input.files || input.files.length === 0) return;
            
            statusDiv.classList.remove('hidden');
            statusDiv.innerText = "Subiendo imagen... por favor espera.";
            
            const formData = new FormData();
            formData.append('receipt', input.files[0]);
            
            try {
                const res = await fetch(\`/api/upload-receipt/\${activeOrder.id}\`, {
                    method: 'POST',
                    body: formData
                });
                
                if (res.ok) {
                    statusDiv.innerText = "¡Comprobante enviado! El cajero lo está revisando...";
                    statusDiv.className = "mt-2 text-sm text-green-400 font-bold";
                    input.classList.add('hidden'); // Hide input after success
                } else {
                    throw new Error('Upload failed');
                }
            } catch (e) {
                console.error(e);
                statusDiv.innerText = "Error al subir. Intenta de nuevo.";
                statusDiv.className = "mt-2 text-sm text-red-400 font-bold";
            }
        }
`;

if (!code.includes('function uploadReceipt')) {
    code = code.replace('// --- TRACKING & ADDON LOGIC ---', uploadFn + '\n        // --- TRACKING & ADDON LOGIC ---');
    fs.writeFileSync(file, code);
    console.log('Patched uploadReceipt');
} else {
    console.log('Already patched');
}
