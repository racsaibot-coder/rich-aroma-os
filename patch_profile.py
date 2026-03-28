import re

file_path = '/Users/racs/clawd/projects/rich-aroma-os/public/profile/index.html'

with open(file_path, 'r') as f:
    content = f.read()

# 1. Add "Ordenar" button
dashboard_html = """
    <div id="dashboard-view" class="w-full max-w-md hidden space-y-6">
        <div class="flex justify-between items-center bg-[#1a1714] p-4 rounded-2xl">
            <div>
                <h2 class="text-xl font-bold" id="user-name">Cargando...</h2>
                <p class="text-sm text-gray-400" id="user-phone"></p>
            </div>
            <div class="flex gap-2">
                <a href="/order.html" class="text-xs bg-[#D4A574] text-black px-4 py-2 rounded-full font-bold shadow hover:brightness-110 transition"><i class="fas fa-coffee mr-1"></i> Ordenar</a>
                <button onclick="logout()" class="text-xs border border-gray-600 px-3 py-2 rounded-full hover:bg-gray-800 text-white"><i class="fas fa-sign-out-alt"></i></button>
            </div>
        </div>
"""
content = re.sub(r'<div id="dashboard-view".*?<button onclick="logout\(\)".*?</button>\s*</div>', dashboard_html.strip(), content, flags=re.DOTALL)

# 2. Update handleLogin() to use the API
new_login_js = r"""
        async function handleLogin() {
            const country = document.getElementById('login-country').value;
            const rawPhone = document.getElementById('login-phone').value.replace(/\D/g, '');
            const phone = country + rawPhone;
            const pin = document.getElementById('login-pin').value;
            
            if(!rawPhone || pin.length < 4) {
                alert("Por favor ingresa un número válido y un PIN de 4 dígitos.");
                return;
            }
            
            try {
                const btn = event.target;
                const ogText = btn.innerText;
                btn.innerText = "Verificando...";
                btn.disabled = true;

                const res = await fetch('/api/customer/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone, pin })
                });

                const data = await res.json();
                btn.innerText = ogText;
                btn.disabled = false;

                if (!res.ok) {
                    alert(data.error || "Error al iniciar sesión");
                    return;
                }

                // Save auth locally
                localStorage.setItem('ra_customer_phone', phone);
                localStorage.setItem('ra_customer_pin', pin); // Store PIN securely for fast checkout later
                localStorage.setItem('ra_customer_data', JSON.stringify(data.customer));

                showDashboard(data.customer);

            } catch (e) {
                alert("Error de conexión");
                console.error(e);
            }
        }

        function showDashboard(customer) {
            document.getElementById('login-view').classList.add('hidden');
            document.getElementById('dashboard-view').classList.remove('hidden');
            
            document.getElementById('user-name').innerText = customer.name || "Usuario";
            document.getElementById('user-phone').innerText = customer.phone;
            
            const points = customer.points || 0;
            const cash = (parseFloat(customer.cash_balance) || 0) + (parseFloat(customer.membership_credit) || 0);
            
            document.getElementById('points-balance').innerText = points;
            document.getElementById('cash-balance').innerText = cash.toFixed(2);
            
            if (customer.is_vip) {
                document.getElementById('vip-banner').classList.remove('hidden');
            }
        }

        window.onload = () => {
            const savedPhone = localStorage.getItem('ra_customer_phone');
            const savedData = localStorage.getItem('ra_customer_data');
            if (savedPhone && savedData) {
                showDashboard(JSON.parse(savedData));
                
                // Refresh data silently
                fetch(`/api/customer/profile?phone=${encodeURIComponent(savedPhone)}`)
                    .then(r => r.json())
                    .then(data => {
                        if (data && !data.error) {
                            localStorage.setItem('ra_customer_data', JSON.stringify(data));
                            showDashboard(data);
                        }
                    }).catch(e => console.log("Silent refresh failed", e));
            }
        }
        
        function logout() {
            localStorage.removeItem('ra_customer_phone');
            localStorage.removeItem('ra_customer_pin');
            localStorage.removeItem('ra_customer_data');
            document.getElementById('dashboard-view').classList.add('hidden');
            document.getElementById('login-view').classList.remove('hidden');
            document.getElementById('login-phone').value = '';
            document.getElementById('login-pin').value = '';
        }
"""
# Since re.sub with regex handles replacements with backslashes weirdly, let's use string.replace for the JS block
pattern_start = "function handleLogin() {"
pattern_end = "</script>"
start_idx = content.find(pattern_start)
end_idx = content.find(pattern_end, start_idx)

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + new_login_js.strip() + "\n    " + content[end_idx:]

with open(file_path, 'w') as f:
    f.write(content)

print("profile/index.html updated.")
