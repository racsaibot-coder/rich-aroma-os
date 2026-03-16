const fs = require('fs');
const path = '/Users/racs/clawd/projects/rich-aroma-os/public/pos-v2.html';
let content = fs.readFileSync(path, 'utf8');

// Fix 1: Quick Create
const oldQuickCreate = `                if(confirm("Customer not found. Create new profile?")) {
                    // Simple quick create logic could go here
                    alert("Quick create not implemented in V2 prototype yet.");
                }`;

const newQuickCreate = `                if(confirm("Customer not found. Create new profile?")) {
                    const name = prompt("Enter customer name:");
                    if (name) {
                        try {
                            const createRes = await fetch('/api/customers', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({ phone: query, name: name })
                            });
                            const newCust = await createRes.json();
                            if (createRes.ok) {
                                currentCustomerId = newCust.id;
                                document.getElementById('cust-profile').classList.remove('hidden');
                                document.getElementById('cust-name').innerText = newCust.name;
                                document.getElementById('cust-balance').innerText = 'L.0.00';
                                document.getElementById('customer-display').innerHTML = \`
                                    <div class="w-10 h-10 rounded-full bg-gold text-dark flex items-center justify-center font-bold text-lg">
                                        \${newCust.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div class="text-sm font-bold text-white">\${newCust.name}</div>
                                        <div class="text-xs text-gold">L.0.00 Rico Cash</div>
                                    </div>
                                \`;
                            } else {
                                alert("Failed to create customer.");
                            }
                        } catch(e) {
                            alert("Error creating customer.");
                        }
                    }
                }`;
content = content.replace(oldQuickCreate, newQuickCreate);

// Fix 2: Add Transferencia to reload options
const oldReloadHTML = `<div class="grid grid-cols-2 gap-4 mt-6">
                <button onclick="processReload('cash')" class="py-4 bg-green-500 hover:bg-green-400 text-white rounded-xl font-bold text-lg flex flex-col items-center justify-center gap-2">
                    <i class="fas fa-money-bill-wave text-2xl"></i>
                    EFECTIVO
                </button>
                <button onclick="processReload('card')" class="py-4 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-bold text-lg flex flex-col items-center justify-center gap-2">
                    <i class="fas fa-credit-card text-2xl"></i>
                    TARJETA
                </button>
            </div>`;

const newReloadHTML = `<div class="grid grid-cols-3 gap-4 mt-6">
                <button onclick="processReload('cash')" class="py-4 bg-green-500 hover:bg-green-400 text-white rounded-xl font-bold text-sm flex flex-col items-center justify-center gap-2">
                    <i class="fas fa-money-bill-wave text-xl"></i>
                    EFECTIVO
                </button>
                <button onclick="processReload('card')" class="py-4 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-bold text-sm flex flex-col items-center justify-center gap-2">
                    <i class="fas fa-credit-card text-xl"></i>
                    TARJETA
                </button>
                <button onclick="processReload('transfer')" class="py-4 bg-purple-500 hover:bg-purple-400 text-white rounded-xl font-bold text-sm flex flex-col items-center justify-center gap-2">
                    <i class="fas fa-exchange-alt text-xl"></i>
                    TRANSF.
                </button>
            </div>`;
content = content.replace(oldReloadHTML, newReloadHTML);

fs.writeFileSync(path, content);
console.log("Done");
