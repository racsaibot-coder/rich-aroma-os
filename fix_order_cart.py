import re

file_path = '/Users/racs/clawd/projects/rich-aroma-os/public/order.html'

with open(file_path, 'r') as f:
    content = f.read()

# Remove the reference to guest-name-section since we removed it from HTML
# in a previous patch when we forced them to use profile for login/creation
new_func = """function openCartModal() {
            const container = document.getElementById('cart-review-items');
            const bribeBanner = document.getElementById('guest-bribe-banner');
            if (bribeBanner) {
                if (!currentCustomer) {
                    bribeBanner.classList.remove('hidden');
                } else {
                    bribeBanner.classList.add('hidden');
                }
            }
            
            if(cart.length === 0) {
                container.innerHTML = `<div class="text-white/50 text-center py-6">Tu carrito está vacío</div>`;
            } else {
                container.innerHTML = cart.map((item, index) => `
                    <div class="flex justify-between items-start bg-white/5 border border-white/10 p-4 rounded-xl">
                        <div>
                            <div class="font-bold text-white">${item.name}</div>
                            ${item.mods && item.mods.length > 0 ? `<div class="text-xs text-white/50 mt-1">${item.mods.map(m=>m.name).join(', ')}</div>` : ''}
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="font-mono text-gold font-bold">L ${item.finalPrice.toFixed(2)}</span>
                            <button onclick="removeCartItem(${index})" class="text-white/30 hover:text-red-400"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `).join('');
            }

            updateCartSummary();
            renderPaymentOptions();
            
            document.getElementById('cart-modal').classList.remove('hidden');
        }"""

content = re.sub(r'function openCartModal\(\) \{.*?(?=function updateCartSummary\(\))', new_func + '\n\n        ', content, flags=re.DOTALL)

with open(file_path, 'w') as f:
    f.write(content)

