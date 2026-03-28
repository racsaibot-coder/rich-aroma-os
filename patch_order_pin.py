import re

file_path = '/Users/racs/clawd/projects/rich-aroma-os/public/order.html'

with open(file_path, 'r') as f:
    content = f.read()

# Update submitOrder payload to include PIN
if "payload.pin = localStorage.getItem('ra_customer_pin');" not in content:
    content = content.replace("if (currentCustomer) payload.customerId = currentCustomer.id;", 
                              "if (currentCustomer) {\n                    payload.customerId = currentCustomer.id;\n                    payload.pin = localStorage.getItem('ra_customer_pin');\n                }")

# Check if the "Bribe Banner" is shown, update it to point to profile login
bribe_banner = """
                <div id="guest-bribe-banner" class="hidden bg-gold/10 border border-gold/30 rounded-2xl p-4 mb-6 text-center">
                    <p class="text-gold font-bold text-sm mb-2">🎁 Crea una cuenta o inicia sesión para ganar puntos y descuentos.</p>
                    <a href="/profile/index.html" class="inline-block bg-gold text-dark font-bold py-2 px-6 rounded-xl text-sm shadow hover:brightness-110 transition">Acceder / Crear PIN</a>
                </div>
"""
content = re.sub(r'<div id="guest-bribe-banner".*?</div>\s*</div>', bribe_banner.strip(), content, flags=re.DOTALL)

with open(file_path, 'w') as f:
    f.write(content)

print("order.html pin updated.")
