import re

file_path = '/Users/racs/clawd/projects/rich-aroma-os/server.js'

with open(file_path, 'r') as f:
    content = f.read()

# We need to add logic into the PATCH /api/orders/:id route.
# Look for: if (req.body.status === 'paid' && currentOrder.status !== 'paid')
# And if it's a topup order, credit the customer.

logic_to_insert = """
    // 1.5 Handle Top-Up Approval (Rico Cash Reload)
    if (req.body.status === 'paid' && currentOrder.status !== 'paid' && currentOrder.items) {
        // Check if any item is a reload
        const reloadItem = currentOrder.items.find(i => i.id === 'rico_cash_reload');
        if (reloadItem && currentOrder.customer_id) {
            const amountToCredit = parseFloat(reloadItem.finalPrice) || 0;
            // Get customer
            const { data: customer } = await client
                .from('customers')
                .select('*')
                .eq('id', currentOrder.customer_id)
                .single();
            if (customer) {
                const currentCash = parseFloat(customer.cash_balance) || 0;
                await client.from('customers').update({ cash_balance: currentCash + amountToCredit }).eq('id', customer.id);
                // Also log it
                await client.from('balance_history').insert({
                    customer_id: customer.id,
                    amount: amountToCredit,
                    type: 'credit',
                    description: 'Recarga Rico Cash (Transferencia Aprobada)',
                    balance_after: currentCash + amountToCredit
                });
            }
        }
    }
"""

# Let's insert it before "// 2. Loyalty Logic: Award points"
if "1.5 Handle Top-Up Approval" not in content:
    content = content.replace("// 2. Loyalty Logic", logic_to_insert.strip() + "\\n\\n    // 2. Loyalty Logic")

with open(file_path, 'w') as f:
    f.write(content)

print("server.js updated with topup approval logic.")
