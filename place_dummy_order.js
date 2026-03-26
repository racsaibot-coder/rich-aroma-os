const fetch = require('node-fetch');

async function run() {
    // 1. Create Order
    const orderRes = await fetch('https://www.richaromacoffee.com/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            items: [
                { id: "test-1", name: "Latte de Prueba", price: 50, finalPrice: 50, qty: 1, mods: [] }
            ],
            subtotal: 50,
            tax: 7.5,
            total: 57.5,
            paymentMethod: "transfer",
            fulfillment: "pickup",
            notes: "ESTA ES UNA PRUEBA AUTOMATIZADA"
        })
    });
    
    const orderData = await orderRes.json();
    console.log("Order Created:", orderData.id);

    // 2. Upload fake receipt
    const dummyBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    
    const uploadRes = await fetch('https://www.richaromacoffee.com/api/receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            orderId: orderData.id,
            imageBase64: dummyBase64,
            fileName: "test_receipt.png"
        })
    });
    
    const uploadData = await uploadRes.json();
    console.log("Receipt Uploaded:", uploadData);
}

run();
