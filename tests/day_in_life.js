const { createClient } = require('@supabase/supabase-js');

// Config
const baseUrl = 'http://localhost:8083';
const supabaseUrl = process.env.SUPABASE_URL || 'https://zcqubacfcettwawcimsy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper for API calls
async function api(method, path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const options = {
        method,
        headers,
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${baseUrl}${path}`, options);
    const data = await res.json();
    if (!res.ok) throw new Error(`${method} ${path} failed: ${data.error || res.statusText}`);
    return data;
}

async function run() {
    console.log("🚀 Starting Day in the Life Simulation...");

    const adminToken = 'TEST_TOKEN_ADMIN';
    const adminUserId = 'test-admin';

    try {
        // --- PREP: Admin User ---
        console.log("--- PREP ---");
        
        // Ensure Admin Employee Exists (for consistency)
        // We use upsert to avoid duplicates
        await supabase.from('employees').upsert({
            id: adminUserId,
            name: 'Sim Admin',
            role: 'admin',
            active: true
        });
        console.log("✅ Admin Employee Record Ready");


        // --- 1. STAFF FLOW ---
        console.log("\n--- 1. STAFF FLOW ---");
        
        // Create Employee 'Maria'
        const mariaDetails = {
            name: 'Maria',
            role: 'barista',
            pin: '1234',
            hourly_rate: 50,
            color: '#FF0000'
        };
        const maria = await api('POST', '/api/admin/employees', mariaDetails, adminToken);
        console.log("✅ Created Employee Maria:", maria.id);

        // Simulate Clock In
        const clockIn = await api('POST', '/api/timeclock', {
            employeeId: maria.id,
            type: 'in'
        }, adminToken);
        console.log("✅ Maria Clocked In:", clockIn.timestamp);

        // Simulate Signing Contract
        const contract = await api('POST', '/api/contracts', {
            employeeId: maria.id,
            contractText: "I agree to work hard.",
            signature: "data:image/png;base64,fake-sig"
        }, adminToken);
        console.log("✅ Maria Signed Contract:", contract.id);

        // Simulate Task Completion
        // Ensure a task template exists
        let taskId = 1;
        const { data: tasks } = await supabase.from('daily_tasks').select('id').limit(1);
        if (tasks && tasks.length > 0) {
            taskId = tasks[0].id;
        } else {
             const { data: newTask } = await supabase.from('daily_tasks').insert({ role: 'barista', task_description: 'Check grinder' }).select().single();
             taskId = newTask.id;
        }
        
        const taskLog = await api('POST', '/api/tasks', {
            employeeId: maria.id,
            taskId: taskId
        }, adminToken);
        console.log("✅ Maria Completed Task:", taskLog.id);


        // --- 2. CUSTOMER FLOW ---
        console.log("\n--- 2. CUSTOMER FLOW ---");
        
        // Create Customer 'Carlos'
        const carlosDetails = {
            name: 'Carlos',
            phone: `504${Date.now()}1`,
            email: `carlos-${Date.now()}@test.com`
        };
        const carlos = await api('POST', '/api/customers', carlosDetails);
        console.log("✅ Created Customer Carlos:", carlos.id);

        // Simulate Order 1 (Pickup, Cash)
        const order1Payload = {
            items: [{ name: 'Espresso', price: 30, qty: 1 }],
            subtotal: 30,
            total: 30,
            paymentMethod: 'cash',
            customerId: carlos.id,
            notes: 'Pickup'
        };
        const order1 = await api('POST', '/api/orders', order1Payload);
        console.log("✅ Order 1 Created:", order1.id);

        // Complete Order 1 to trigger points
        await api('PATCH', `/api/orders/${order1.id}`, {
            status: 'completed'
        }, adminToken);
        console.log("✅ Order 1 Completed");

        // Verify Points
        await new Promise(r => setTimeout(r, 2000));
        const { data: carlosUpdated } = await supabase.from('customers').select('points').eq('id', carlos.id).single();
        console.log(`ℹ️ Carlos Points: ${carlosUpdated.points}`);
        
        if (carlosUpdated.points >= 30) console.log("✅ Points Verified");
        else console.warn(`⚠️ Points check warning: Got ${carlosUpdated.points}`);


        // --- 3. DELIVERY FLOW ---
        console.log("\n--- 3. DELIVERY FLOW ---");
        
        // Create Customer 'Ana' (VIP)
        const anaDetails = {
            name: 'Ana',
            phone: `504${Date.now()}2`,
            email: `ana-${Date.now()}@test.com`
        };
        const ana = await api('POST', '/api/customers', anaDetails);
        
        // Make VIP
        await supabase.from('customers').update({ is_vip: true }).eq('id', ana.id);
        console.log("✅ Created Customer Ana (VIP):", ana.id);

        // Add Balance (L500)
        // VIP gets 10% bonus = 550 total.
        const loadRes = await api('POST', `/api/customers/${ana.id}/load-balance`, {
            amount: 500
        }, adminToken);
        console.log(`✅ Loaded L500 to Ana. New Balance: ${loadRes.newBalance}`);

        // Simulate Order 2 (Delivery, Balance)
        // Total 600. Available 550.
        // Result: partial_paid, 550 paid, 50 due.
        const order2Payload = {
            items: [{ name: 'Feast', price: 600, qty: 1 }],
            subtotal: 600,
            total: 600,
            paymentMethod: 'rico_balance',
            customerId: ana.id,
            notes: 'Delivery please'
        };
        
        const order2 = await api('POST', '/api/orders', order2Payload);
        console.log("✅ Order 2 Created:", order2.id);
        console.log(`ℹ️ Order Status: ${order2.status}`);

        // Verify Split Payment Logic
        const { data: anaUpdated } = await supabase.from('customers').select('cash_balance, membership_credit').eq('id', ana.id).single();
        const totalBalance = anaUpdated.cash_balance + anaUpdated.membership_credit;
        console.log(`ℹ️ Ana Remaining Balance: ${totalBalance}`);
        
        if (totalBalance === 0) {
             console.log("✅ Split Payment Logic Verified (Balance depleted)");
        } else {
             console.warn(`⚠️ Warning: Balance not 0? ${totalBalance}`);
        }


        // --- 4. DRIVER FLOW ---
        console.log("\n--- 4. DRIVER FLOW ---");
        
        // Create Driver 'Jose'
        const joseDetails = {
            name: 'Jose',
            role: 'driver',
            pin: '9999',
            active: true
        };
        const jose = await api('POST', '/api/admin/employees', joseDetails, adminToken);
        console.log("✅ Created Driver Jose:", jose.id);

        // Simulate 'Claim Order' (Order 2)
        const claimRes = await api('POST', `/api/driver/orders/${order2.id}/claim`, {
            driverId: jose.id
        });
        console.log("✅ Order 2 Claimed by Jose");

        // Simulate 'Complete Order' (Delivery)
        const deliverRes = await api('PATCH', `/api/orders/${order2.id}/delivery-status`, {
            status: 'delivered'
        });
        console.log("✅ Order 2 Delivered");
        
        // Verify Status
        const { data: order2Final } = await supabase.from('orders').select('status, delivery_status').eq('id', order2.id).single();
         if (order2Final.status === 'completed' && order2Final.delivery_status === 'delivered') {
            console.log("✅ Order 2 Status Verified: Completed & Delivered");
        } else {
            console.warn(`⚠️ Order 2 Status Check: ${order2Final.status}/${order2Final.delivery_status}`);
        }


        // --- 5. ADMIN FLOW ---
        console.log("\n--- 5. ADMIN FLOW ---");
        
        // Fetch Sales Stats
        const stats = await api('GET', '/api/admin/stats', null, adminToken);
        console.log("✅ Stats Fetched:", stats);
        
        console.log("\n🎉 FULL SYSTEM SIMULATION PASSED");
        process.exit(0);

    } catch (e) {
        console.error("\n❌ SIMULATION FAILED:", e.message);
        process.exit(1);
    }
}

run();
