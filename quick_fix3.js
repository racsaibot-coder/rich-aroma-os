const fs = require('fs');
const path = '/Users/racs/clawd/projects/rich-aroma-os/public/pos-v2.html';
let content = fs.readFileSync(path, 'utf8');

const oldTenderModal = `<div class="grid grid-cols-2 gap-4 mb-6">
                <button onclick="setTender('cash')" id="btn-tender-cash" class="py-6 rounded-xl border-2 border-green-500 bg-green-50 text-green-700 font-bold text-xl flex flex-col items-center gap-2 hover:bg-green-100 transition"><i class="fas fa-money-bill-wave text-3xl"></i> Cash</button>
                <button onclick="setTender('card')" id="btn-tender-card" class="py-6 rounded-xl border-2 border-gray-200 text-gray-500 font-bold text-xl flex flex-col items-center gap-2 hover:bg-gray-50 transition"><i class="fas fa-credit-card text-3xl"></i> Card</button>
            </div>`;

const newTenderModal = `<div class="grid grid-cols-3 gap-4 mb-6">
                <button onclick="setTender('cash')" id="btn-tender-cash" class="py-6 rounded-xl border-2 border-green-500 bg-green-50 text-green-700 font-bold text-xl flex flex-col items-center gap-2 hover:bg-green-100 transition"><i class="fas fa-money-bill-wave text-3xl"></i> Cash</button>
                <button onclick="setTender('card')" id="btn-tender-card" class="py-6 rounded-xl border-2 border-gray-200 text-gray-500 font-bold text-xl flex flex-col items-center gap-2 hover:bg-gray-50 transition"><i class="fas fa-credit-card text-3xl"></i> Card</button>
                <button onclick="setTender('transfer')" id="btn-tender-transfer" class="py-6 rounded-xl border-2 border-gray-200 text-gray-500 font-bold text-xl flex flex-col items-center gap-2 hover:bg-gray-50 transition"><i class="fas fa-exchange-alt text-3xl"></i> Transf</button>
            </div>
            
            <div id="transfer-instructions" class="hidden mb-6 p-4 bg-purple-50 text-purple-800 rounded-xl border border-purple-200 text-center">
                <i class="fas fa-info-circle mb-2 text-2xl"></i>
                <p class="font-bold">Transferencia Bancaria</p>
                <p class="text-sm mt-1">Verify screenshot on WhatsApp before completing sale.</p>
            </div>`;

content = content.replace(oldTenderModal, newTenderModal);

const oldSetTender = `    function setTender(method) {
        currentTenderMethod = method;
        const btnCash = document.getElementById('btn-tender-cash');
        const btnCard = document.getElementById('btn-tender-card');
        const calc = document.getElementById('cash-calculator');
        
        btnCash.className = "py-6 rounded-xl border-2 font-bold text-xl flex flex-col items-center gap-2 transition " + (method === 'cash' ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-500 bg-white hover:bg-gray-50");
        btnCard.className = "py-6 rounded-xl border-2 font-bold text-xl flex flex-col items-center gap-2 transition " + (method === 'card' ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 bg-white hover:bg-gray-50");
        
        if(method === 'cash') calc.classList.remove('hidden');
        else calc.classList.add('hidden');
    }`;

const newSetTender = `    function setTender(method) {
        currentTenderMethod = method;
        const btnCash = document.getElementById('btn-tender-cash');
        const btnCard = document.getElementById('btn-tender-card');
        const btnTransfer = document.getElementById('btn-tender-transfer');
        const calc = document.getElementById('cash-calculator');
        const transfInstr = document.getElementById('transfer-instructions');
        
        btnCash.className = "py-6 rounded-xl border-2 font-bold text-xl flex flex-col items-center gap-2 transition " + (method === 'cash' ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-500 bg-white hover:bg-gray-50");
        btnCard.className = "py-6 rounded-xl border-2 font-bold text-xl flex flex-col items-center gap-2 transition " + (method === 'card' ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 bg-white hover:bg-gray-50");
        btnTransfer.className = "py-6 rounded-xl border-2 font-bold text-xl flex flex-col items-center gap-2 transition " + (method === 'transfer' ? "border-purple-500 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-500 bg-white hover:bg-gray-50");
        
        if(method === 'cash') calc.classList.remove('hidden');
        else calc.classList.add('hidden');

        if(method === 'transfer') transfInstr.classList.remove('hidden');
        else transfInstr.classList.add('hidden');
    }`;

content = content.replace(oldSetTender, newSetTender);

fs.writeFileSync(path, content);
console.log("Done checkout modal fix");
