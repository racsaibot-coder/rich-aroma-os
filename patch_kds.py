import re

file_path = '/Users/racs/clawd/projects/rich-aroma-os/public/kds.html'

with open(file_path, 'r') as f:
    content = f.read()

# Generate Payment Badge
badge_logic = """
                                    <span class="text-[10px] bg-white/10 px-2 py-0.5 rounded text-white/70 font-bold uppercase tracking-wider">${order.fulfillment_type === 'delivery' ? '🚗 Delivery' : order.fulfillment_type === 'pickup' ? '🛍️ Pickup' : '🍽️ Dine-in'}</span>
                                    ${order.payment_method === 'split_cash' ? '<span class="text-[10px] bg-red-500/20 px-2 py-0.5 rounded text-red-400 font-bold uppercase tracking-wider border border-red-500/50">COBRAR EFECTIVO</span>' : ''}
                                    ${order.payment_method === 'split_transfer' ? '<span class="text-[10px] bg-orange-500/20 px-2 py-0.5 rounded text-orange-400 font-bold uppercase tracking-wider border border-orange-500/50">SPLIT: TRANSFER</span>' : ''}
                                    ${order.payment_method === 'rico_balance' ? '<span class="text-[10px] bg-gold/20 px-2 py-0.5 rounded text-gold font-bold uppercase tracking-wider border border-gold/50">100% RICO CASH</span>' : ''}
                                    ${order.status === 'preparing' ? '<span class="text-[10px] bg-blue-500/20 px-2 py-0.5 rounded text-blue-300 font-bold uppercase tracking-wider blink">En Proceso</span>' : ''}
"""

content = re.sub(
    r"<span class=\"text-\[10px\] bg-white/10 px-2 py-0.5 rounded text-white/70 font-bold uppercase tracking-wider\">\$\{order\.fulfillment_type === 'delivery' \? '🚗 Delivery' : order\.fulfillment_type === 'pickup' \? '🛍️ Pickup' : '🍽️ Dine-in'\}</span>\s*\$\{order\.status === 'preparing' \? '<span class=\"text-\[10px\] bg-blue-500/20 px-2 py-0.5 rounded text-blue-300 font-bold uppercase tracking-wider blink\">En Proceso</span>' : ''\}",
    badge_logic.strip(),
    content,
    flags=re.MULTILINE
)

with open(file_path, 'w') as f:
    f.write(content)

print("kds.html updated.")
