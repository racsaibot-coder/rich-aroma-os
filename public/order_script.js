        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        gold: '#C9A66B',
                        dark: '#1E1610',
                        charcoal: '#2C241E',
                        cream: '#F5F5F0'
                    },
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                        display: ['Playfair Display', 'serif']
                    }
                }
            }
        }
        let cart = [];
        let currentCustomer = null;
        let menuItems = [];
        let modGroups = [];
        let modOptions = [];
        let itemModGroups = [];
        let currentItem = null;
        let currentMods = {};
        
        let fulfillmentType = 'pickup'; // default
        let activeOrder = null;
        let addonTimer = null;
        let isAddonMode = false;
        let currentSelectedPayment = 'cash';
        let currentSecondaryPayment = 'cash';

        async function loadMenu() {
            try {
                const res = await fetch('/api/menu');
                const data = await res.json();
                if (data && data.items) {
                    menuItems = data.items;
                    modGroups = data.modGroups || [];
                    modOptions = data.modOptions || [];
                    itemModGroups = data.itemModGroups || [];
                    renderMenu();
                }
            } catch(e) { console.error('Error loading menu', e); }
        }

        function setFulfillment(type) {
            fulfillmentType = type;
            document.querySelectorAll('.fulfillment-btn').forEach(btn => {
                btn.classList.remove('bg-gold', 'text-dark', 'border-gold');
                btn.classList.add('bg-transparent', 'text-white/70', 'border-white/20');
            });
            const activeBtn = document.getElementById('btn-' + type);
            activeBtn.classList.remove('bg-transparent', 'text-white/70', 'border-white/20');
            activeBtn.classList.add('bg-gold', 'text-dark', 'border-gold');
        }

        let activeCategory = 'Combos';

        function filterCategory(cat, btnEl) {
            activeCategory = cat;
            
            const buttons = document.querySelectorAll('.cat-btn');
            buttons.forEach(btn => {
                btn.className = "cat-btn px-6 py-2 rounded-full border border-white/10 bg-white/5 text-white/70 text-sm font-bold hover:bg-white/10 transition-colors";
            });
            if(btnEl) {
                btnEl.className = "cat-btn px-6 py-2 rounded-full border border-gold bg-gold text-dark text-sm font-bold shadow-lg";
            }
            
            renderMenu();
        }

        function renderMenu() {
            const container = document.getElementById('menu-container');
            const categories = {};
            
            let filteredItems = menuItems;
            if (activeCategory !== 'all') {
                filteredItems = menuItems.filter(item => {
                    const itemCat = (item.category || 'Otros').toLowerCase();
                    const itemName = (item.name || '').toLowerCase();
                    const searchCat = activeCategory.toLowerCase();
                    if (searchCat === 'calientes') return itemCat === 'hot_drinks' || itemCat === 'coffee' || itemCat.includes('caf') || itemCat.includes('t') || itemName.includes('té') || itemName.includes('chai') || itemName.includes('matcha') || itemName.includes('hot');
                    if (searchCat === 'heladas') return itemCat === 'cold_drinks' || itemCat === 'drinks' || itemCat.includes('bebida') || itemName.includes('iced') || itemName.includes('frappe') || itemName.includes('granita') || itemName.includes('licuado');
                    if (searchCat === 'comida') return itemCat === 'food' || itemCat.includes('comida');
                    if (searchCat === 'combos') return itemCat === 'combo' || itemCat.includes('combo') || itemCat.includes('paquete') || itemName.includes('combo') || itemName.includes('paquete');
                    return itemCat === searchCat;
                });
            }

            filteredItems.forEach(item => {
                let cat = item.category || 'Otros';
                const itemName = (item.name || '').toLowerCase();
                const catLower = cat.toLowerCase();
                
                if (catLower === 'hot_drinks' || catLower === 'coffee') cat = 'Calientes';
                else if (catLower === 'cold_drinks' || catLower === 'drinks') cat = 'Heladas';
                else if (catLower === 'food') cat = 'Comida';
                else if (catLower === 'combos' || catLower === 'combo' || catLower.includes('paquete') || itemName.includes('combo') || itemName.includes('paquete')) cat = 'Combos';
                
                if(!categories[cat]) categories[cat] = [];
                categories[cat].push(item);
            });

            const categoryOrder = ['Café', 'Bebidas', 'Combos', 'Comida', 'Postres', 'Otros'];
            const sortedCategories = Object.keys(categories).sort((a, b) => {
                let indexA = categoryOrder.indexOf(a);
                let indexB = categoryOrder.indexOf(b);
                if (indexA === -1) indexA = 99;
                if (indexB === -1) indexB = 99;
                return indexA - indexB;
            });

            let html = '';
            if (filteredItems.length === 0) {
                html = '<p class="text-center text-white/50 py-10">No se encontraron productos en esta categoría.</p>';
            } else {
                sortedCategories.forEach(category => {
                    let items = categories[category];
                    
                    // Sort items: especially useful for Combos to be Combo 1, Combo 2, etc.
                    items.sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'}));

                    html += `<div class="mb-8"><h2 class="text-gold text-sm font-bold uppercase tracking-widest mb-4 border-l-2 border-gold pl-3">${category}</h2><div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">`;
                    items.forEach(item => {
                        const imgUrl = item.image_url || 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400&q=80';
                        const isCombo = category === 'Combos';
                        const cardClass = isCombo ? "item-card rounded-2xl overflow-hidden flex flex-col group hover:border-gold transition-colors cursor-pointer border-2 border-gold/50 shadow-[0_0_15px_rgba(201,166,107,0.15)]" : "item-card rounded-2xl overflow-hidden flex flex-col group hover:border-gold/50 transition-colors cursor-pointer";
                        html += `
                            <div class="${cardClass}" onclick="openModifier('${item.id}')">
                                <div class="w-full h-36 bg-charcoal overflow-hidden relative">
                                    <img src="${imgUrl}" class="w-full h-full object-cover">
                                    <div class="absolute inset-0 bg-gradient-to-t from-dark/90 to-transparent"></div>
                                    <div class="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-gold text-dark flex items-center justify-center shadow-lg"><i class="fas fa-plus text-xs"></i></div>
                                </div>
                                <div class="p-4 flex-1 flex flex-col justify-between">
                                    <h3 class="font-bold text-base leading-tight mb-2">${item.name}</h3>
                                    <span class="text-gold font-mono font-bold">L ${parseFloat(item.price).toFixed(2)}</span>
                                </div>
                            </div>`;
                    });
                    html += `</div></div>`;
                });
            }
            container.innerHTML = html;
        }

        function openModifier(id) {
            currentItem = menuItems.find(i => i.id === id);
            const relevantGroups = itemModGroups.filter(img => img.item_id === id).sort((a,b)=>a.display_order - b.display_order).map(img => img.group_id);
            
            if(relevantGroups.length === 0) {
                // If no mods, just add directly
                openNoteOnlyModal();
                return;
            }

            currentMods = {};
            
            // 1. Initial defaults
            relevantGroups.forEach(groupId => {
                const options = modOptions.filter(o => o.group_id === groupId);
                const defaultOpt = options.find(o => o.is_default);
                currentMods[groupId] = defaultOpt ? [defaultOpt.id] : [];
            });

            // 2. Apply base recipe
            if (currentItem.base_recipe) {
                for (const groupId in currentMods) {
                    if (currentMods[groupId].length > 0) {
                        const selectedOptId = currentMods[groupId][0];
                        const selectedOpt = modOptions.find(o => o.id === selectedOptId);
                        if (selectedOpt && currentItem.base_recipe[selectedOpt.name]) {
                            const recipe = currentItem.base_recipe[selectedOpt.name];
                            for (const [targetGroupId, targetOptionId] of Object.entries(recipe)) {
                                if (currentMods[targetGroupId]) {
                                    currentMods[targetGroupId] = [targetOptionId];
                                }
                            }
                        }
                    }
                }
            }

            // 3. Build dynamic HTML
            const container = document.getElementById('mod-dynamic-container');
            let html = '';

            relevantGroups.forEach(groupId => {
                const group = modGroups.find(g => g.id === groupId);
                if (!group) return;
                const options = modOptions.filter(o => o.group_id === groupId);

                html += `<div class="mb-6"><h3 class="text-white/60 uppercase text-xs tracking-widest font-bold mb-3">${group.name}</h3><div class="grid grid-cols-2 gap-3">`;
                options.forEach(opt => {
                    const sel = currentMods[groupId].includes(opt.id) ? 'border-2 border-gold bg-gold/10 text-gold' : 'border border-white/10 bg-white/5 text-white';
                    html += `<button onclick="toggleDynamicMod('${group.id}', '${opt.id}', ${group.max_selections})" id="mod-btn-${opt.id}" class="mod-btn transition-colors duration-200 p-4 rounded-2xl font-bold text-sm text-left flex justify-between items-center ${sel}"><span>${opt.name}</span>${opt.price_adjustment > 0 ? `<span class="text-xs opacity-70">+L.${opt.price_adjustment}</span>` : ''}</button>`;
                });
                html += `</div></div>`;
            });
            
            html += `<div class="mb-6"><h3 class="text-white/60 uppercase text-xs tracking-widest font-bold mb-3">Instrucciones para este plato</h3><input type="text" id="mod-note" placeholder="Ej. Sin cebolla..." class="w-full p-4 bg-white/5 border border-white/10 text-white rounded-2xl text-base focus:outline-none focus:border-gold"></div>`;
            
            container.innerHTML = html;
            document.getElementById('mod-item-name').innerText = currentItem.name;
            updateDynamicModPrice();
            document.getElementById('mod-confirm-text').innerText = isAddonMode ? 'Agregar a Orden Activa' : 'Agregar';
            document.getElementById('modifier-modal').classList.remove('hidden');
        }

        function openNoteOnlyModal() {
            currentMods = {};
            const container = document.getElementById('mod-dynamic-container');
            container.innerHTML = `<div class="mb-6"><h3 class="text-white/60 uppercase text-xs tracking-widest font-bold mb-3">Instrucciones para este plato</h3><input type="text" id="mod-note" placeholder="Ej. Bien caliente..." class="w-full p-4 bg-white/5 border border-white/10 text-white rounded-2xl text-base focus:outline-none focus:border-gold"></div>`;
            document.getElementById('mod-item-name').innerText = currentItem.name;
            document.getElementById('mod-item-price').innerText = `L. ${currentItem.price.toFixed(2)}`;
            document.getElementById('mod-final-price').innerText = `L. ${currentItem.price.toFixed(2)}`;
            document.getElementById('mod-confirm-text').innerText = isAddonMode ? 'Agregar a Orden Activa' : 'Agregar';
            document.getElementById('modifier-modal').classList.remove('hidden');
        }

        function closeModal() { document.getElementById('modifier-modal').classList.add('hidden'); }

        function toggleDynamicMod(groupId, optionId, maxSelections) {
            let selected = currentMods[groupId] || [];
            if (selected.includes(optionId)) selected = selected.filter(id => id !== optionId);
            else {
                if (maxSelections === 1) selected = [optionId];
                else {
                    if (selected.length < maxSelections) selected.push(optionId);
                    else { selected.shift(); selected.push(optionId); }
                }
            }
            currentMods[groupId] = selected;
            
            const options = modOptions.filter(o => o.group_id === groupId);
            options.forEach(opt => {
                const btn = document.getElementById(`mod-btn-${opt.id}`);
                if (btn) {
                    btn.className = `mod-btn transition-colors duration-200 p-4 rounded-2xl font-bold text-sm text-left flex justify-between items-center ${selected.includes(opt.id) ? 'border-2 border-gold bg-gold/10 text-gold' : 'border border-white/10 bg-white/5 text-white'}`;
                }
            });
            updateDynamicModPrice();
        }

        function updateDynamicModPrice() {
            let total = currentItem.price;
            for (const groupId in currentMods) {
                currentMods[groupId].forEach(optId => {
                    const opt = modOptions.find(o => o.id === optId);
                    if (opt) total += parseFloat(opt.price_adjustment);
                });
            }
            document.getElementById('mod-item-price').innerText = `L. ${total.toFixed(2)}`;
            document.getElementById('mod-final-price').innerText = `L. ${total.toFixed(2)}`;
        }

        function confirmItem() {
            const mods = [];
            for (const groupId in currentMods) {
                currentMods[groupId].forEach(optId => {
                    const opt = modOptions.find(o => o.id === optId);
                    if (opt) mods.push({ name: opt.name });
                });
            }
            const note = document.getElementById('mod-note').value;
            if (note) mods.push({ name: `📝 ${note}` });

            const finalPrice = parseFloat(document.getElementById('mod-final-price').innerText.replace('L. ', ''));
            const cartItem = { id: currentItem.id, name: currentItem.name, price: currentItem.price, finalPrice, mods, qty: 1 };
            
            if (isAddonMode) {
                // Instantly submit add-on
                submitAddon(cartItem);
            } else {
                cart.push(cartItem);
                updateCartUI();
            }
            closeModal();
        }

        function updateCartUI() {
            const total = cart.reduce((sum, item) => sum + item.finalPrice, 0);
            document.getElementById('cart-total').innerText = `L ${total.toFixed(2)}`;
            document.getElementById('cart-count').innerText = cart.length;
            
            const cartBar = document.getElementById('cart-bar');
            if (cart.length > 0 && !isAddonMode) cartBar.classList.remove('translate-y-[150%]');
            else cartBar.classList.add('translate-y-[150%]');
        }

        function openCartModal() {
            const container = document.getElementById('cart-review-items');
            const bribeBanner = document.getElementById('guest-bribe-banner');
            if (bribeBanner) {
                if (!currentCustomer) {
                    bribeBanner.classList.remove('hidden');
                } else {
                    bribeBanner.classList.add('hidden');
                }
            }
            if (!currentCustomer) {
                document.getElementById('guest-name-section').classList.remove('hidden');
            } else {
                document.getElementById('guest-name-section').classList.add('hidden');
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
        }

        function updateCartSummary() {
            let subtotal = cart.reduce((sum, item) => sum + item.finalPrice, 0);
            let discount = 0;
            let discountText = "";
            
            if (localStorage.getItem('ra_welcome_offer_30') === 'true' && subtotal > 0) {
                discount += 30;
                discountText += `<br><span class="text-gold text-xs">- L 30.00 (Bienvenida L.30)</span>`;
            }
            
            // Check if they have enough balance to cover the ENTIRE order (before the 10% discount is applied)
            // If they don't, they don't get the 10% discount. This forces them to top up.
            const totalBeforeRicoDiscount = subtotal - discount;
            const ricoBalance = currentCustomer ? ((parseFloat(currentCustomer.cash_balance) || 0) + (parseFloat(currentCustomer.membership_credit) || 0)) : 0;
            const coversFull = ricoBalance >= totalBeforeRicoDiscount;
            
            if (currentSelectedPayment === 'rico_balance' && coversFull && subtotal > 0) {
                const ricoDiscount = subtotal * 0.10;
                discount += ricoDiscount;
                discountText += `<br><span class="text-gold text-xs">- L ${ricoDiscount.toFixed(2)} (10% Rico Cash)</span>`;
            }

            if (discount > subtotal) discount = subtotal; // don't go negative
            
            const tax = subtotal * 0.00;
            const total = subtotal - discount + tax;

            document.getElementById('review-subtotal').innerHTML = `L ${subtotal.toFixed(2)} ${discountText}`;
            document.getElementById('review-tax').innerText = `L ${tax.toFixed(2)}`;
            document.getElementById('review-total').innerText = `L ${total.toFixed(2)}`;
            
            window.currentOrderTotal = total;
            window.currentOrderDiscount = discount;
        }

        function selectPaymentMethod(method) {
            currentSelectedPayment = method;
            updateCartSummary();
            renderPaymentOptions();
        }

        function renderPaymentOptions() {
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
        }

        
        function selectSecondaryPayment(method) {
            currentSecondaryPayment = method;
            renderPaymentOptions();
        }

        function promptTopUp(suggestedAmount) {
            if (!currentCustomer) {
                alert("Por favor inicia sesión en tu perfil primero para poder recargar.");
                return;
            }
            if(confirm(`Para recargar L.${suggestedAmount} y obtener tu descuento, serás redirigido a tu perfil para subir el comprobante. ¿Deseas continuar?`)) {
                window.location.href = '/profile/index.html';
            }
        }

        function copyBankInfo(bank) {
            let account = '';
            if (bank === 'bac') account = '756132311'; // TODO: Update with real BAC account
            if (bank === 'banpais') account = '210850188679'; // TODO: Update with real Banpais account
            
            navigator.clipboard.writeText(account).then(() => {
                alert(`¡Cuenta de ${bank.toUpperCase()} (${account}) copiada! Haz la transferencia y sube la captura aquí en la app.`);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                alert(`El número de cuenta es: ${account}`);
            });
        }

        function requestTopup(totalAmount) {
            let customerName = "";
            if (currentCustomer) customerName = currentCustomer.name;
            else {
                customerName = prompt("Por favor, ingresa tu nombre para que sepamos de quién es la transferencia:");
                if (!customerName) return; // cancelled
            }
            const phone = currentCustomer ? currentCustomer.phone : '';
            const msg = `¡Hola! Aquí está mi comprobante de pago por L.${totalAmount.toFixed(2)} para mi orden a nombre de ${customerName}. ${phone ? 'Mi número es ' + phone : ''}`;
            const shopPhone = "50495200236"; // Update this with your actual shop WhatsApp number
            
            // Also submit the order to the kitchen as pending/unpaid
            submitOrder('transfer');
            
            window.open(`https://wa.me/${shopPhone}?text=${encodeURIComponent(msg)}`, '_blank');
        }

        function removeCartItem(index) {
            cart.splice(index, 1);
            updateCartUI();
            if(cart.length === 0) closeCartModal();
            else openCartModal(); // re-render
        }

        function closeCartModal() { document.getElementById('cart-modal').classList.add('hidden'); }

        async function submitOrder(paymentMethod = 'cash') {
            if (cart.length === 0) return;
            const btn = document.getElementById('final-checkout-btn');
            const ogText = btn.innerHTML;
            
            // Add a name check for guest orders
            let orderNotes = document.getElementById('order-notes').value;
            const subtotalTest = cart.reduce((sum, item) => sum + item.finalPrice, 0);
            const totalTest = subtotalTest * 1.15;
            
            if (!currentCustomer) {
                const guestName = document.getElementById('guest-name').value.trim();
                const guestPhone = document.getElementById('guest-phone').value.trim();
                
                if (totalTest > 250) {
                    if (!guestName || !guestPhone) {
                        alert("Para órdenes mayores a L. 250, requerimos tu nombre y número de teléfono.");
                        return;
                    }
                    
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando cuenta...';
                    btn.disabled = true;
                    
                    try {
                        const cres = await fetch('/api/customers', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: guestName, phone: guestPhone, email: '' })
                        });
                        if (cres.ok) {
                            currentCustomer = await cres.json();
                            // Save to local storage so they remain logged in
                            localStorage.setItem('ricocash_token', JSON.stringify({
                                customer_id: currentCustomer.id,
                                token: 'dummy_token_for_now'
                            }));
                        }
                    } catch (e) {
                        console.error('Error creating customer on the fly', e);
                    }
                } else {
                    if (!guestName) {
                        alert("Por favor, ingresa tu nombre en el campo de arriba para procesar la orden.");
                        return;
                    }
                }
                
                orderNotes = `[GUEST: ${guestName} | PHONE: ${guestPhone || 'N/A'}] ${orderNotes}`;
            }

            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
            btn.disabled = true;

            const itemsMap = {};
            cart.forEach(item => {
                // Using stringified mods as key so different mods don't stack qty
                const key = item.id + JSON.stringify(item.mods); 
                if (!itemsMap[key]) itemsMap[key] = { ...item, qty: 0 };
                itemsMap[key].qty += 1;
            });

            const items = Object.values(itemsMap);
            // Force recalculation to ensure accuracy
            let subtotal = cart.reduce((sum, item) => sum + item.finalPrice, 0);
            let discount = 0;
            if (localStorage.getItem('ra_welcome_offer_30') === 'true' && subtotal > 0) discount += 30;
            
            const totalBeforeRicoDiscount = subtotal - discount;
            const ricoBalance = currentCustomer ? ((parseFloat(currentCustomer.cash_balance) || 0) + (parseFloat(currentCustomer.membership_credit) || 0)) : 0;
            const coversFull = ricoBalance >= totalBeforeRicoDiscount;
            
            if (paymentMethod === 'rico_balance' && coversFull && subtotal > 0) {
                discount += (subtotal * 0.10);
            }
            
            if (discount > subtotal) discount = subtotal;
            
            const tax = subtotal * 0.00;
            const total = subtotal - discount + tax;

            try {
                const payload = {
                    items, subtotal, tax, discount: discount, total: total,
                    paymentMethod: paymentMethod,
                    fulfillment: fulfillmentType,
                    notes: `Mobile Order (${fulfillmentType}) ${orderNotes ? '- ' + orderNotes : ''}`
                };
                if (currentCustomer) {
                    payload.customerId = currentCustomer.id;
                    payload.pin = localStorage.getItem('ra_customer_pin');
                }

                const res = await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (!res.ok) throw new Error('Error saving');
                const savedOrder = await res.json();
                
                if (discount > 0) localStorage.removeItem('ra_welcome_offer_30');

                cart = [];
                updateCartUI();
                closeCartModal();
                
                // Switch to tracking view
                activeOrder = savedOrder;
                showTracking();

            } catch (err) {
                alert('Hubo un error, por favor intenta de nuevo.');
                console.error(err);
                btn.innerHTML = ogText;
                btn.disabled = false;
            }
        }

        
        async function uploadReceipt() {
            const input = document.getElementById('receipt-upload');
            const statusDiv = document.getElementById('receipt-upload-status');
            if (!input.files || input.files.length === 0) return;
            
            statusDiv.classList.remove('hidden');
            statusDiv.innerText = "Subiendo imagen... por favor espera.";
            
            const file = input.files[0];
            const reader = new FileReader();
            
            reader.onloadend = async () => {
                const base64String = reader.result;
                try {
                    const res = await fetch(`/api/receipt`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            orderId: activeOrder.id, 
                            imageBase64: base64String,
                            fileName: file.name
                        })
                    });
                    
                    if (res.ok) {
                        statusDiv.innerText = "¡Comprobante enviado! El cajero lo está revisando...";
                        statusDiv.className = "mt-2 text-sm text-green-400 font-bold";
                        input.classList.add('hidden'); // Hide input after success
                    } else {
                        const errData = await res.json();
                        throw new Error(errData.error || 'Upload failed');
                    }
                } catch (e) {
                    console.error(e);
                    statusDiv.innerText = "Error al subir. Intenta de nuevo.";
                    statusDiv.className = "mt-2 text-sm text-red-400 font-bold";
                }
            };
            reader.readAsDataURL(file);
        }

        // --- TRACKING & ADDON LOGIC ---
        let statusPollingTimer = null;
        let trackingTimer = null;

        function startTrackingTimer(orderTime) {
            clearInterval(trackingTimer);
            const startTime = new Date(orderTime).getTime();
            
            trackingTimer = setInterval(() => {
                const now = new Date().getTime();
                let diff = now - startTime;
                if(diff < 0) diff = 0;
                
                const minutes = Math.floor(diff / 60000);
                const seconds = Math.floor((diff % 60000) / 1000);
                
                const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                const timerEl = document.getElementById('track-time');
                if(timerEl) timerEl.innerText = timeStr;
            }, 1000);
        }

        function showTracking() {
            document.getElementById('main-view').classList.add('hidden');
            document.getElementById('fulfillment-selector').classList.add('hidden');
            document.getElementById('tracking-view').classList.remove('hidden');
            document.getElementById('tracking-icon-container').classList.remove('hidden');
            
            if (activeOrder && activeOrder.payment_method === 'transfer') {
                document.getElementById('transfer-upload-section').classList.remove('hidden');
            } else {
                document.getElementById('transfer-upload-section').classList.add('hidden');
            }
            
            document.getElementById('track-order-num').innerText = activeOrder.order_number || activeOrder.id;
            const types = { pickup: 'Para Llevar', dinein: 'Restaurante', delivery: 'A Domicilio' };
            document.getElementById('track-type').innerText = types[activeOrder.fulfillment_type || fulfillmentType];
            
            if (activeOrder.created_at) {
                startTrackingTimer(activeOrder.created_at);
            } else {
                startTrackingTimer(new Date().toISOString());
            }
            
            // Addon logic removed per request - show new order button immediately
            document.getElementById('addon-box').classList.add('hidden');
            document.getElementById('new-order-btn').classList.remove('hidden');
            
            // Start live polling for status
            clearInterval(statusPollingTimer);
            statusPollingTimer = setInterval(async () => {
                try {
                    // This assumes we add a GET /api/orders/:id endpoint later.
                    // For now we can fetch the user's past orders or the full orders list to find it
                    const res = await fetch('/api/orders'); 
                    if(res.ok) {
                        const data = await res.json();
                        const currentOrder = data.orders.find(o => o.id === activeOrder.id);
                        if(currentOrder) {
                            // Update UI if paid
                            if(currentOrder.status === 'paid') {
                                document.getElementById('transfer-upload-section').classList.add('hidden');
                                document.getElementById('track-status-desc').innerText = `Orden #${currentOrder.order_number || currentOrder.id} • Pago Confirmado ✅`;
                            }
                            
                            if(currentOrder.status === 'preparing') setStep('prep');
                            if(currentOrder.status === 'completed' || currentOrder.status === 'ready') {
                                setStep('ready');
                                clearInterval(statusPollingTimer); // Stop polling when done
                                
                                // Disable Add-ons and force new order when completed
                                clearInterval(addonTimer);
                                document.getElementById('addon-box').classList.add('hidden');
                                document.getElementById('new-order-btn').classList.remove('hidden');
                            }
                        }
                    }
                } catch(e) { console.error('Status poll error', e); }
            }, 3000);
        }

        function showTrackingIfActive() {
            if(activeOrder) {
                document.getElementById('main-view').classList.add('hidden');
                document.getElementById('fulfillment-selector').classList.add('hidden');
                document.getElementById('tracking-view').classList.remove('hidden');
            }
        }

// Audio Chimes for customer
        const prepChime = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // soft ding
        const readyChime = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3'); // happy chime
        let currentStepState = 'pending';

        function setStep(step) {
            if(step === 'prep') {
                if (currentStepState !== 'prep') {
                    prepChime.play().catch(e=>console.log(e));
                    currentStepState = 'prep';
                }
                document.getElementById('step-prep-icon').classList.replace('bg-white/10', 'bg-gold');
                document.getElementById('step-prep-icon').classList.replace('text-white/50', 'text-dark');
                document.getElementById('step-prep-text').classList.replace('text-white/50', 'text-white');
            }
            if(step === 'ready') {
                if (currentStepState !== 'ready') {
                    readyChime.play().catch(e=>console.log(e));
                    currentStepState = 'ready';
                }
                document.getElementById('step-ready-icon').classList.replace('bg-white/10', 'bg-gold');
                document.getElementById('step-ready-icon').classList.replace('text-white/50', 'text-dark');
                document.getElementById('step-ready-text').classList.replace('text-white/50', 'text-white');
                document.getElementById('track-status-title').innerText = "¡Orden Lista!";
                const pulseEl = document.querySelector('.animate-pulse');
                if(pulseEl) pulseEl.classList.remove('animate-pulse');
            }
        }

        function showMenuForAddon() {
            isAddonMode = true;
            document.getElementById('tracking-view').classList.add('hidden');
            document.getElementById('main-view').classList.remove('hidden');
        }

        async function submitAddon(cartItem) {
            try {
                if (!activeOrder || !activeOrder.id) {
                    alert("No hay orden activa a la que agregar.");
                    return;
                }
                const payload = {
                    items: [cartItem], 
                    addedSubtotal: cartItem.finalPrice, 
                    addedTax: cartItem.finalPrice * 0.15, 
                    addedTotal: cartItem.finalPrice * 1.15
                };

                const res = await fetch(`/api/orders/${activeOrder.id}/append`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (res.ok) {
                    const data = await res.json();
                    activeOrder = data.order; // update local active order
                    isAddonMode = false;
                    showTracking(); // go back
                } else {
                    alert("Error al agregar el artículo.");
                }
            } catch(e) { console.error(e); }
        }

        function newOrder() {
            activeOrder = null;
            clearInterval(addonTimer);
            isAddonMode = false;
            document.getElementById('tracking-view').classList.add('hidden');
            document.getElementById('main-view').classList.remove('hidden');
            document.getElementById('fulfillment-selector').classList.remove('hidden');
            document.getElementById('track-status-title').innerText = "Preparando tu Orden";
            
            // Reset steps
            ['prep', 'ready'].forEach(s => {
                document.getElementById(`step-${s}-icon`).classList.replace('bg-gold', 'bg-white/10');
                document.getElementById(`step-${s}-icon`).classList.replace('text-dark', 'text-white/50');
                document.getElementById(`step-${s}-text`).classList.replace('text-white', 'text-white/50');
            });
        }

        // Init
        window.addEventListener('DOMContentLoaded', async () => {
            try {
                const res = await fetch('/api/store/status');
                const data = await res.json();
                if (!data.isOpen) {
                    document.getElementById('closed-overlay').classList.remove('hidden');
                    document.getElementById('cart-bar').style.display = 'none';
                    return; // Stop initialization if closed
                }
            } catch (e) {
                console.error("Store status check failed", e);
            }

            loadMenu();
            setFulfillment('pickup');
            
            // Auto login logic for testing
            const phone = localStorage.getItem('ra_customer_phone') || localStorage.getItem('ra_phone');
            if (phone) {
                fetch(`/api/customer/profile?phone=${phone}`)
                .then(r => r.json())
                .then(u => {
                    if (u && !u.error) {
                        currentCustomer = u;
                    } else {
                        currentCustomer = null;
                        localStorage.removeItem('ra_customer_phone');
                    }
                })
                .catch(e => console.error(e));
            }
        });

