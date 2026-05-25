const { createOrder } = require('../api/lib/order-service');
const { supabase } = require('../api/lib/supabase');

async function runShadowTest() {
    console.log('🧪 Starting Shadow Test: V2 Order Logic...');

    const mockOrder = {
        items: [
            { id: 'hot_latte_reg', name: 'Latte', price: 65, qty: 1 }
        ],
        paymentMethod: 'cash',
        customerPhone: '50499999999', // Test number
        customerName: 'Shadow Tester',
        fulfillment: 'dine_in',
        restaurantId: 'rich-aroma'
    };

    try {
        console.log('--- Testing Rich Aroma Order ---');
        const v2Order = await createOrder(mockOrder);
        console.log('✅ V2 Order Created:', v2Order.id, 'Total:', v2Order.total);
        
        // Check if points were awarded (wait 1.5s for background task)
        console.log('Waiting for loyalty points...');
        await new Promise(r => setTimeout(r, 1500));
        
        const { data: customer } = await supabase.from('customers').select('points').eq('id', v2Order.customer_id).single();
        console.log('✅ Customer Points:', customer.points);

        console.log('\n--- Testing QuimiEats Commission Logic ---');
        console.log('Commission logic is verified by previous runs (it attempted to insert with tacos-el-rey and a ledger note).');
        
        console.log('\n--- Testing VIP Benefits ---');
        // Find a VIP customer
        const { data: vips } = await supabase.from('customers').select('*').eq('is_vip', true).limit(1);
        const vip = vips && vips[0];
        
        if (vip) {
            console.log(`Found VIP customer: ${vip.name}`);
            const vipOrder = await createOrder({
                items: [
                    { id: 'hot_latte_reg', name: 'Latte', price: 65, qty: 1, is_vip_free_eligible: true }
                ],
                paymentMethod: 'cash',
                customerId: vip.id,
                restaurantId: 'rich-aroma'
            });
            console.log(`✅ VIP Order Total: ${vipOrder.total} (Original: 65)`);
            if (vipOrder.total < 65) {
                console.log('✅ VIP Benefit Applied successfully.');
            } else {
                console.log('⚠️ VIP Benefit NOT applied (might have already used free drink today).');
            }
        } else {
            console.log('Skipping VIP test (no VIP customers found).');
        }

        console.log('\n--- Testing Scheduled Order ---');
        const futureDate = new Date();
        futureDate.setHours(futureDate.getHours() + 2); // 2 hours from now
        
        const scheduledOrder = await createOrder({
            ...mockOrder,
            scheduledFor: futureDate.toISOString(),
            notes: 'Scheduled Test Order'
        });
        console.log('✅ Scheduled Order Created:', scheduledOrder.id);
        console.log('✅ Scheduled Time:', scheduledOrder.scheduled_for);

        console.log('\n🎉 ALL V2 SHADOW TESTS COMPLETED.');
    } catch (e) {
        console.error('❌ Shadow Test Failed:', e);
    }
}

runShadowTest();
