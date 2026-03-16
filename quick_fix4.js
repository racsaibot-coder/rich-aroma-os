const fs = require('fs');
const path = '/Users/racs/clawd/projects/rich-aroma-os/public/pos-v2.html';
let content = fs.readFileSync(path, 'utf8');

const oldChargeButton = `            <button onclick="processCheckout()" class="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-xl shadow hover:bg-green-700">
                CHARGE (Enter)
            </button>`;

const newChargeButton = `            <button onclick="openTenderModal()" class="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-xl shadow hover:bg-green-700">
                CHARGE (Enter)
            </button>`;

content = content.replace(oldChargeButton, newChargeButton);

const oldProfileHTML = `                profile.innerHTML = \`
                    <h3 class="font-bold text-lg text-blue-600">\${data.name} \${data.is_vip ? '⭐️ VIP' : ''}</h3>
                    <p class="text-sm text-gray-500">Balance: L. \${data.cash_balance || 0} • Pts: \${data.points || 0}</p>
                \`;`;

const newProfileHTML = `                profile.innerHTML = \`
                    <div class="flex justify-between items-center">
                        <div>
                            <h3 class="font-bold text-lg text-blue-600">\${data.name} \${data.is_vip ? '⭐️ VIP' : ''}</h3>
                            <p class="text-sm text-gray-500">Balance: L. \${data.cash_balance || 0} • Pts: \${data.points || 0}</p>
                        </div>
                        <button onclick="openRecargaModal()" class="bg-gold text-dark font-bold text-xs px-3 py-2 rounded-lg shadow-sm hover:bg-yellow-500">
                            + RECARGA
                        </button>
                    </div>
                \`;`;

content = content.replace(oldProfileHTML, newProfileHTML);

// Add the recarga modal to the DOM
const modalInsertPoint = `    <!-- TENDER MODAL -->`;
const recargaModalHTML = `    <!-- RECARGA MODAL -->
    <div id="recarga-modal" class="hidden fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[80] backdrop-blur-sm">
        <div class="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-8">
            <h2 class="text-2xl font-bold text-gray-800 mb-2 text-center">Recargar Rico Cash</h2>
            <p class="text-center text-gray-500 mb-6 text-sm">Add funds to customer wallet</p>
            
            <input type="number" id="recarga-amount" placeholder="Monto (Lps)" class="w-full border-2 border-gray-300 rounded-xl p-4 mb-4 text-center text-2xl font-bold focus:border-gold outline-none">
            
            <div class="grid grid-cols-2 gap-2 mb-6">
                <button onclick="submitRecarga('cash')" class="py-3 bg-green-100 text-green-700 font-bold rounded-lg hover:bg-green-200">Efectivo</button>
                <button onclick="submitRecarga('transfer')" class="py-3 bg-purple-100 text-purple-700 font-bold rounded-lg hover:bg-purple-200">Transferencia</button>
            </div>
            
            <button onclick="document.getElementById('recarga-modal').classList.add('hidden')" class="w-full bg-gray-200 text-gray-800 py-3 rounded-xl font-bold hover:bg-gray-300">Cancelar</button>
        </div>
    </div>

    <!-- TENDER MODAL -->`;

content = content.replace(modalInsertPoint, recargaModalHTML);

// Add JS logic for recarga
const jsInsertPoint = `    // --- CHECKOUT LOGIC ---`;
const recargaLogic = `    // --- RECARGA LOGIC ---
    function openRecargaModal() {
        document.getElementById('recarga-amount').value = '';
        document.getElementById('recarga-modal').classList.remove('hidden');
    }

    async function submitRecarga(method) {
        const amount = parseFloat(document.getElementById('recarga-amount').value);
        if (!amount || amount <= 0) return;
        
        try {
            const res = await fetch(\`/api/customers/\${currentCustomerId}/load-balance\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer EMP-test' },
                body: JSON.stringify({ amount: amount, method: method })
            });
            const data = await res.json();
            if (data.success) {
                alert(\`Recarga Exitosa! L. \${amount} added.\`);
                document.getElementById('recarga-modal').classList.add('hidden');
                lookupCustomer(); // Refresh profile UI
            } else {
                alert("Error loading balance");
            }
        } catch(e) {
            console.error(e);
            alert("Network error");
        }
    }

    // --- CHECKOUT LOGIC ---`;

content = content.replace(jsInsertPoint, recargaLogic);

fs.writeFileSync(path, content);
console.log("Done tender fix");
