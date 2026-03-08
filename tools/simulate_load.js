const http = require('http');

const API_URL = 'http://localhost:8083/api/orders';
const NUM_ORDERS = 500;
const CONCURRENCY_LIMIT = 50;

const menuItems = [
    { id: 'item-1', name: 'Rich Aroma Signature Burger', price: 12.99 },
    { id: 'item-2', name: 'Truffle Fries', price: 6.99 },
    { id: 'item-3', name: 'Vanilla Shake', price: 5.49 },
    { id: 'item-4', name: 'Spicy Chicken Sandwich', price: 11.99 },
    { id: 'item-5', name: 'Caesar Salad', price: 8.99 }
];

function generateRandomOrder() {
    const isDelivery = Math.random() > 0.5;
    const itemsCount = Math.floor(Math.random() * 4) + 1;
    const items = [];
    let total = 0;

    for (let i = 0; i < itemsCount; i++) {
        const item = menuItems[Math.floor(Math.random() * menuItems.length)];
        items.push({
            id: item.id,
            name: item.name,
            quantity: Math.floor(Math.random() * 3) + 1,
            price: item.price
        });
        total += item.price * items[items.length - 1].quantity;
    }

    const order = {
        customerName: `Customer ${Math.floor(Math.random() * 10000)}`,
        type: isDelivery ? 'delivery' : 'pickup',
        status: 'pending',
        items: items,
        total: parseFloat(total.toFixed(2)),
        createdAt: new Date().toISOString()
    };

    if (isDelivery) {
        order.address = `${Math.floor(Math.random() * 9999) + 1} Main St, City, ST 12345`;
    }

    return order;
}

async function sendOrder(order, index) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(order);
        const options = {
            hostname: 'localhost',
            port: 8083,
            path: '/api/orders',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = http.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => responseBody += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(true);
                } else {
                    console.error(`[Order ${index}] Failed: ${res.statusCode} - ${responseBody}`);
                    resolve(false);
                }
            });
        });

        req.on('error', (e) => {
            console.error(`[Order ${index}] Error: ${e.message}`);
            resolve(false);
        });

        req.write(data);
        req.end();
    });
}

async function runLoadTest() {
    console.log(`Starting load test: ${NUM_ORDERS} orders with concurrency ${CONCURRENCY_LIMIT}...`);
    const startTime = Date.now();
    let completed = 0;
    let successful = 0;

    const processQueue = async (tasks) => {
        const results = await Promise.all(tasks.map(task => task()));
        successful += results.filter(r => r).length;
        completed += results.length;
    };

    let currentTasks = [];
    for (let i = 0; i < NUM_ORDERS; i++) {
        const order = generateRandomOrder();
        currentTasks.push(() => sendOrder(order, i + 1));

        if (currentTasks.length >= CONCURRENCY_LIMIT || i === NUM_ORDERS - 1) {
            await processQueue(currentTasks);
            currentTasks = [];
            console.log(`Progress: ${completed}/${NUM_ORDERS} completed...`);
        }
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(`\nLoad test complete in ${duration.toFixed(2)}s`);
    console.log(`Total Orders: ${NUM_ORDERS}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${NUM_ORDERS - successful}`);
    console.log(`Throughput: ${(NUM_ORDERS / duration).toFixed(2)} req/s`);
}

runLoadTest().catch(console.error);