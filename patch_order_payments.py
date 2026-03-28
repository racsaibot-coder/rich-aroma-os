import re

file_path = '/Users/racs/clawd/projects/rich-aroma-os/public/order.html'

with open(file_path, 'r') as f:
    content = f.read()

# We need to add state for secondary payment
content = content.replace("let currentSelectedPayment = 'cash';", "let currentSelectedPayment = 'cash';\n        let currentSecondaryPayment = 'cash';")

# Replace renderPaymentOptions
new_render = """function renderPaymentOptions() {
            const container = document.getElementById('payment-selection-container');
            const buttonContainer = document.getElementById('checkout-options');
            const total = window.currentOrderTotal || 0;
            
            const ricoBalance = currentCustomer ? ((parseFloat(currentCustomer.cash_balance) || 0) + (parseFloat(currentCustomer.membership_credit) || 0)) : 0;
            const hasAnyRicoCash = ricoBalance > 0;
            const coversFull = ricoBalance >= total;
            
            // Do not hide Rico Cash completely if 0, keep it visible but disabled/promotional
            if (currentSelectedPayment === 'rico_balance' && !hasAnyRicoCash) {
                currentSelectedPayment = 'cash';
            }

            let html = '<div class="space-y-4">';
            html += '<label class="text-white/60 uppercase text-xs tracking-widest font-bold block mb-2">Método de Pago</label>';
            html += '<div class="grid grid-cols-3 gap-2">';
            
            const btnClass = "py-3 rounded-xl text-sm font-bold border transition-colors flex justify-center items-center cursor-pointer text-center";
            const unselClass = "bg-white/5 border-white/10 text-white/70 hover:bg-white/10";
            const selClass = "bg-gold/10 border-gold text-gold shadow-sm";

            html += `<div onclick="selectPaymentMethod('cash')" class="${btnClass} ${currentSelectedPayment === 'cash' ? selClass : unselClass}">Efectivo</div>`;
            html += `<div onclick="selectPaymentMethod('transfer')" class="${btnClass} ${currentSelectedPayment === 'transfer' ? selClass : unselClass}">Transfer.</div>`;
            
            if (hasAnyRicoCash) {
                html += `<div onclick="selectPaymentMethod('rico_balance')" class="${btnClass} ${currentSelectedPayment === 'rico_balance' ? selClass : unselClass}">
                    💰 Rico Cash
                </div>`;
            } else {
                html += `<div onclick="alert('Tu balance es 0. Agrega fondos abajo para usar Rico Cash.')" class="${btnClass} opacity-50 bg-white/5 border-white/10 text-white/50 cursor-not-allowed text-xs">💰 Rico Cash</div>`;
            }
            
            html += '</div>';

            if (currentSelectedPayment === 'rico_balance' && hasAnyRicoCash) {
                html += `
                    <div class="mt-2 text-center text-sm text-gold font-bold">
                        Balance Actual: L. ${ricoBalance.toFixed(2)}
                        ${coversFull ? '<br><span class="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full mt-1 inline-block">-10% Aplicado al Total</span>' : ''}
                    </div>
                `;
            }

            let isSplitPayment = false;
            let remainingBalanceToPay = 0;
            
            if (currentSelectedPayment === 'rico_balance' && !coversFull) {
                isSplitPayment = true;
                remainingBalanceToPay = total - ricoBalance;
                html += `
                    <div class="mt-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl">
                        <p class="text-orange-400 text-sm font-bold mb-2 text-center">Saldo Insuficiente (Faltan L. ${remainingBalanceToPay.toFixed(2)})</p>
                        <p class="text-white/60 text-[10px] text-center mb-3">El descuento del 10% solo aplica si cubres el total con Rico Cash.</p>
                        
                        <label class="text-white/60 uppercase text-[10px] tracking-widest font-bold block mb-2 text-center">¿Cómo deseas pagar el resto?</label>
                        <div class="grid grid-cols-2 gap-2">
                            <div onclick="selectSecondaryPayment('cash')" class="${btnClass} ${currentSecondaryPayment === 'cash' ? selClass : unselClass}">Efectivo</div>
                            <div onclick="selectSecondaryPayment('transfer')" class="${btnClass} ${currentSecondaryPayment === 'transfer' ? selClass : unselClass}">Transferencia</div>
                        </div>
                    </div>
                `;
            }

            // Top-up Prompt if they don't cover full
            if (!coversFull && currentCustomer) {
                const suggestedTopup = Math.ceil(remainingBalanceToPay > 0 ? remainingBalanceToPay : total);
                html += `
                    <div class="mt-4 p-4 bg-gradient-to-r from-gold/10 to-gold/5 border border-gold/30 rounded-2xl flex items-center justify-between">
                        <div>
                            <p class="text-gold text-xs font-bold mb-1"><i class="fas fa-bolt mr-1"></i>Ahorra 10% Recargando</p>
                            <p class="text-white/60 text-[10px]">Agrega L. ${suggestedTopup} ahora por transferencia para cubrir esta orden y obtener el descuento.</p>
                        </div>
                        <button onclick="promptTopUp(${suggestedTopup})" class="bg-gold text-dark text-[10px] font-bold px-3 py-2 rounded-xl whitespace-nowrap ml-2 shadow hover:scale-105 transition-transform">Recargar</button>
                    </div>
                `;
            }

            let buttonHtml = '';

            const showTransferInfo = currentSelectedPayment === 'transfer' || (isSplitPayment && currentSecondaryPayment === 'transfer');

            if (showTransferInfo) {
                const amountToTransfer = isSplitPayment ? remainingBalanceToPay : total;
                html += `
                    <div class="mt-4 p-4 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                        <p class="text-xs text-white/60 text-center">Transfiere <strong class="text-white">L. ${amountToTransfer.toFixed(2)}</strong> a una de nuestras cuentas y confirma la orden.</p>
                        <div class="flex gap-3">
                            <button onclick="copyBankInfo('bac')" class="flex-1 bg-red-600/10 border border-red-600/30 text-red-500 py-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1 hover:bg-red-600/20 transition-colors">
                                <span class="text-xs">BAC</span>
                                <i class="fas fa-copy"></i>
                            </button>
                            <button onclick="copyBankInfo('banpais')" class="flex-1 bg-blue-600/10 border border-blue-600/30 text-blue-500 py-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1 hover:bg-blue-600/20 transition-colors">
                                <span class="text-xs">Banpaís</span>
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    </div>
                `;
            }

            if (isSplitPayment && currentSecondaryPayment === 'transfer') {
                buttonHtml = `
                    <button id="final-checkout-btn" onclick="submitOrder('split_transfer')" class="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-orange-500/20 flex justify-center items-center gap-2 active:scale-95 transition-transform mt-2">
                        <span>Confirmar División + Transf.</span> <i class="fas fa-check"></i>
                    </button>
                `;
            } else if (isSplitPayment && currentSecondaryPayment === 'cash') {
                buttonHtml = `
                    <button id="final-checkout-btn" onclick="submitOrder('split_cash')" class="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-orange-500/20 flex justify-center items-center gap-2 active:scale-95 transition-transform mt-2">
                        <span>Confirmar División (Efectivo)</span> <i class="fas fa-cash-register"></i>
                    </button>
                `;
            } else if (currentSelectedPayment === 'transfer') {
                buttonHtml = `
                    <button id="final-checkout-btn" onclick="submitOrder('transfer')" class="w-full bg-green-500 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-green-500/20 flex justify-center items-center gap-2 active:scale-95 transition-transform mt-2">
                        <span>Confirmar Transferencia</span> <i class="fas fa-check"></i>
                    </button>
                `;
            } else {
                buttonHtml = `
                    <button id="final-checkout-btn" onclick="submitOrder('${currentSelectedPayment}')" class="w-full mt-2 gold-btn py-4 rounded-2xl font-bold text-lg shadow-xl shadow-gold/20 flex justify-center items-center gap-2 active:scale-95 transition-transform">
                        <span>Confirmar Orden</span> <i class="fas fa-arrow-right"></i>
                    </button>
                `;
            }

            html += '</div>';
            container.innerHTML = html;
            buttonContainer.innerHTML = buttonHtml;
        }"""

pattern = re.compile(r'function renderPaymentOptions\(\) \{.*?(?=function copyBankInfo)', re.DOTALL | re.DOTALL)
content = pattern.sub(new_render + '\n\n        ', content)

with open(file_path, 'w') as f:
    f.write(content)

print("order.html updated.")
