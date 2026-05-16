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
        const supabaseUrl = 'https://zcqubacfcettwawcimsy.supabase.co';
        const supabaseKey = 'sb_publishable_hRVyru_6sektmVGQyJFfwQ_4b2-7MKq';
        const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

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
                    initStickyCats();
                    renderMenu();
                }
            } catch(e) { console.error('Error loading menu', e); }
        }

        function initStickyCats() {
            const cats = [
                {id:'Combos', n:'Combos', i:'🔥'},
                {id:'Comida', n:'Comida', i:'🥐'},
                {id:'Café', n:'Café', i:'☕'},
                {id:'Heladas', n:'Heladas', i:'🥤'},
                {id:'Postres', n:'Postres', i:'🍰'},
                {id:'Menú Secreto', n:'Secreto', i:'🤫'}
            ];
            const nav = document.getElementById('sticky-cats');
            if (nav) {
                nav.innerHTML = cats.map(c => `
                    <button id="cat-btn-${c.id.replace(/\s+/g, '')}" onclick="filterCategory('${c.id}', this)" class="cat-btn flex-shrink-0 px-6 py-2.5 rounded-full border border-white/10 bg-white/5 text-white/40 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
                        <span>${c.i}</span> <span>${c.n}</span>
                    </button>`).join('');
            }
        }

        function setFulfillment(type) {
            fulfillmentType = type;
            document.querySelectorAll('.fulfillment-btn').forEach(btn => {
                btn.classList.remove('bg-gold', 'text-dark', 'border-gold');
                btn.classList.add('bg-transparent', 'text-white/70', 'border-white/20');
            });
            const activeBtn = document.getElementById('btn-' + type);
            if (activeBtn) {
                activeBtn.classList.remove('bg-transparent', 'text-white/70', 'border-white/20');
                activeBtn.classList.add('bg-gold', 'text-dark', 'border-gold');
            }
        }

        function filterCategory(id, btn) {
            const el = document.getElementById('section-' + id.replace(/\s+/g, ''));
            if (el) {
                const navHeight = 130; 
                const elementPosition = el.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - navHeight;
                window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            }
        }

        function optimizeImg(url) {
            if (!url) return "";
            if (url.startsWith('data:')) return url;
            if (url.includes('supabase.co')) {
                if (url.includes('?')) return url + '&width=400';
                return url + '?width=400';
            }
            return url;
        }

        function renderMenu() {
            const container = document.getElementById('menu-container');
            const categories = {};
            
            menuItems.forEach(item => {
                let cat = item.category || 'Otros';
                const itemName = (item.name || '').toLowerCase();
                const catLower = cat.toLowerCase();
                
                if (catLower === 'hot_drinks' || catLower === 'coffee' || catLower.includes('caliente')) cat = 'Café';
                else if (catLower === 'cold_drinks' || catLower === 'drinks' || catLower.includes('helada')) cat = 'Heladas';
                else if (catLower === 'food' || catLower === 'comida') cat = 'Comida';
                else if (catLower === 'pastry' || catLower.includes('postre') || catLower.includes('reposteria')) cat = 'Postres';
                else if (catLower === 'secret' || catLower === 'secreto') cat = 'Menú Secreto';
                else if (catLower === 'combos' || catLower === 'combo' || catLower.includes('paquete') || itemName.includes('combo') || itemName.includes('paquete')) cat = 'Combos';
                
                if(!categories[cat]) categories[cat] = [];
                categories[cat].push(item);
            });

            const categoryOrder = ['Combos', 'Comida', 'Café', 'Heladas', 'Postres', 'Menú Secreto', 'Otros'];
            const sortedCategories = Object.keys(categories).sort((a, b) => {
                let indexA = categoryOrder.indexOf(a);
                let indexB = categoryOrder.indexOf(b);
                if (indexA === -1) indexA = 99;
                if (indexB === -1) indexB = 99;
                return indexA - indexB;
            });

            let html = '';
            sortedCategories.forEach(category => {
                let items = categories[category];
                items.sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'}));

                const sectionId = 'section-' + category.replace(/\s+/g, '');
                html += `<div id="${sectionId}" class="menu-section mb-12 scroll-mt-32">
                    <h2 class="text-gold text-sm font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                        <span class="h-px w-8 bg-gold/20"></span>
                        ${category}
                        <span class="flex-1 h-px bg-gold/20"></span>
                    </h2>
                    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">`;
                
                items.forEach(item => {
                    const isCombo = category === 'Combos';
                    const cardClass = isCombo ? "item-card rounded-[2rem] bg-white/5 border border-gold/30 overflow-hidden flex flex-col group active:scale-95 transition-all shadow-xl" : "item-card rounded-[2rem] bg-white/5 border border-white/5 overflow-hidden flex flex-col group active:scale-95 transition-all";
                    const imgUrl = optimizeImg(item.image_url);
                    const imgHtml = imgUrl ? `
                            <div class="w-full h-40 bg-charcoal overflow-hidden relative">
                                <img src="${imgUrl}" class="w-full h-full object-cover" loading="lazy">
                                <div class="absolute inset-0 bg-gradient-to-t from-dark/80 to-transparent"></div>
                                <div class="absolute bottom-3 right-3 w-10 h-10 rounded-2xl bg-gold text-dark flex items-center justify-center shadow-lg transform rotate-3 group-hover:rotate-0 transition-transform"><i class="fas fa-plus text-sm"></i></div>
                            </div>` : `
                            <div class="w-full h-16 bg-charcoal relative flex items-center justify-end px-4">
                                <div class="w-10 h-10 rounded-2xl bg-gold text-dark flex items-center justify-center shadow-lg"><i class="fas fa-plus text-sm"></i></div>
                            </div>`;
                    
                    html += `
                        <div class="${cardClass}" onclick="openModifier('${item.id}')">
                            ${imgHtml}
                            <div class="p-5 flex-1 flex flex-col justify-between">
                                <h3 class="font-black text-sm leading-tight mb-2 text-white/90">${item.name}</h3>
                                <span class="text-gold font-mono font-black text-base">L ${(Number(item.price) || 0).toFixed(2)}</span>
                            </div>
                        </div>`;
                });
                html += `</div></div>`;
            });

            container.innerHTML = html;
            const loadingMsg = document.getElementById('loading-msg');
            if (loadingMsg) loadingMsg.style.display = 'none';

            setupScrollSpy();
        }

        function setupScrollSpy() {
            const sections = document.querySelectorAll('.menu-section');
            const navButtons = document.querySelectorAll('.cat-btn');
            
            const options = {
                root: null,
                rootMargin: '-130px 0px -40% 0px',
                threshold: 0
            };

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const id = entry.target.id.replace('section-', '');
                        navButtons.forEach(btn => {
                            if (btn.id === 'cat-btn-' + id) {
                                btn.classList.remove('bg-white/5', 'text-white/40', 'border-white/10');
                                btn.classList.add('bg-gold', 'text-dark', 'border-gold', 'shadow-lg');
                                btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                            } else {
                                btn.classList.add('bg-white/5', 'text-white/40', 'border-white/10');
                                btn.classList.remove('bg-gold', 'text-dark', 'border-gold', 'shadow-lg');
                            }
                        });
                    }
                });
            }, options);

            sections.forEach(section => observer.observe(section));
        }

        function openModifier(id) {
            currentItem = menuItems.find(i => i.id === id);
            const relevantGroups = itemModGroups.filter(img => img.item_id === id).sort((a,b)=>a.display_order - b.display_order).map(img => img.group_id);
            
            if(relevantGroups.length === 0) {
                openNoteOnlyModal();
                return;
            }

            currentMods = {};
            relevantGroups.forEach(groupId => {
                const options = modOptions.filter(o => o.group_id === groupId);
                const defaultOpt = options.find(o => o.is_default);
                currentMods[groupId] = defaultOpt ? [defaultOpt.id] : [];
            });

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

            const container = document.getElementById('mod-dynamic-container');
            let html = '';

            relevantGroups.forEach(groupId => {
                const group = modGroups.find(g => g.id === groupId);
                if (!group) return;
                const options = modOptions.filter(o => o.group_id === groupId);

                html += `<div class="mb-6"><h3 class="text-white/60 uppercase text-xs tracking-widest font-bold mb-3">${group.name}</h3><div class="grid grid-cols-2 gap-3">`;
                options.forEach(opt => {
                    const sel = currentMods[groupId].includes(opt.id) ? 'border-2 border-gold bg-gold/10 text-gold' : 'border border-white/10 bg-white/5 text-white';
                    html += `<button onclick="toggleDynamicMod('${group.id}', '${opt.id}', 1)" id="mod-btn-${opt.id}" class="mod-btn transition-colors duration-200 p-4 rounded-2xl font-bold text-sm text-left flex justify-between items-center ${sel}"><span>${opt.name}</span>${opt.price_adjustment > 0 ? `<span class="text-xs opacity-70">+L.${opt.price_adjustment}</span>` : ''}</button>`;
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
            const price = Number(currentItem.price) || 0;
            document.getElementById('mod-item-price').innerText = `L. ${price.toFixed(2)}`;
            document.getElementById('mod-final-price').innerText = `L. ${price.toFixed(2)}`;
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
            let total = Number(currentItem.price) || 0;
            for (const groupId in currentMods) {
                currentMods[groupId].forEach(optId => {
                    const opt = modOptions.find(o => o.id === optId);
                    if (opt) total += (parseFloat(opt.price_adjustment) || 0);
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

            const finalPriceText = document.getElementById('mod-final-price').innerText.replace('L. ', '');
            const finalPrice = parseFloat(finalPriceText) || 0;
            const cartItem = { 
                id: currentItem.id, 
                name: currentItem.name, 
                price: Number(currentItem.price) || 0, 
                finalPrice, 
                mods, 
                qty: 1 
            };
            
            if (isAddonMode) {
                submitAddon(cartItem);
            } else {
                cart.push(cartItem);
                updateCartUI();
            }
            closeModal();
        }

        function updateCartUI() {
            const total = cart.reduce((sum, item) => sum + (parseFloat(item.finalPrice) || 0), 0);
            const counter = document.getElementById('cart-count-text');
            const totalEl = document.getElementById('cart-total-text');
            if (counter) counter.innerText = `${cart.length} Artículos`;
            if (totalEl) totalEl.innerText = `L ${total.toFixed(2)}`;
            
            const cartBar = document.getElementById('cart-bar');
            if (cartBar) {
                if (cart.length > 0 && !isAddonMode) {
                    cartBar.classList.remove('translate-y-[200%]', 'opacity-0');
                    cartBar.classList.add('translate-y-0', 'opacity-100');
                } else {
                    cartBar.classList.add('translate-y-[200%]', 'opacity-0');
                    cartBar.classList.remove('translate-y-0', 'opacity-100');
                }
            }
        }

        function openCartModal() {
            const container = document.getElementById('cart-review-items');
            if (!container) return;
            
            if(cart.length === 0) {
                container.innerHTML = `<div class="text-white/50 text-center py-10 italic">Tu bolsa está vacía</div>`;
            } else {
                container.innerHTML = cart.map((item, index) => `
                    <div class="flex justify-between items-start bg-white/5 border border-white/5 p-5 rounded-[1.5rem]">
                        <div>
                            <div class="font-black text-white text-sm">${item.name}</div>
                            ${item.mods && item.mods.length > 0 ? `<div class="text-[10px] font-bold text-white/40 mt-1 uppercase tracking-wider">${item.mods.map(m=>m.name).join(', ')}</div>` : ''}
                        </div>
                        <div class="flex items-center gap-4">
                            <span class="font-mono text-gold font-black">L ${(parseFloat(item.finalPrice) || 0).toFixed(2)}</span>
                            <button onclick="removeCartItem(${index})" class="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center text-xs"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `).join('');
            }
            updateCartSummary();
            renderPaymentOptions();
            document.getElementById('cart-modal').classList.remove('hidden');
        }

        function updateCartSummary() {
            let subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.finalPrice) || 0), 0);
            let discount = 0;
            let discountText = "";
            
            const totalBeforeRicoDiscount = subtotal - discount;
            const ricoBalance = currentCustomer ? ((parseFloat(currentCustomer.cash_balance) || 0) + (parseFloat(currentCustomer.membership_credit) || 0)) : 0;
            const coversFull = ricoBalance >= totalBeforeRicoDiscount;
            
            if (currentSelectedPayment === 'rico_balance' && coversFull && subtotal > 0) {
                const ricoDiscount = subtotal * 0.10;
                discount += ricoDiscount;
                discountText += `<br><span class="text-gold text-[10px] font-black uppercase tracking-widest">- L ${ricoDiscount.toFixed(2)} (RICO CASH 10%)</span>`;
            }
            if (discount > subtotal) discount = subtotal;
            const total = subtotal - discount;

            const subEl = document.getElementById('review-subtotal');
            const totEl = document.getElementById('review-total');
            if (subEl) subEl.innerHTML = `L ${subtotal.toFixed(2)} ${discountText}`;
            if (totEl) totEl.innerText = `L ${total.toFixed(2)}`;
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
            if (!container || !buttonContainer) return;

            const total = Number(window.currentOrderTotal) || 0;
            const ricoBalance = currentCustomer ? ((parseFloat(currentCustomer.cash_balance) || 0) + (parseFloat(currentCustomer.membership_credit) || 0)) : 0;
            const hasAnyRicoCash = ricoBalance > 0;
            const coversFull = ricoBalance >= total;
            
            if (currentSelectedPayment === 'rico_balance' && !hasAnyRicoCash) currentSelectedPayment = 'cash';

            let html = '<div class="space-y-4">';
            html += '<label class="text-white/40 uppercase text-[10px] tracking-[0.2em] font-black block mb-2">Método de Pago</label>';
            html += '<div class="grid grid-cols-3 gap-2">';
            const btnClass = "py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all flex justify-center items-center cursor-pointer text-center";
            const unselClass = "bg-white/5 border-white/5 text-white/40 hover:bg-white/10";
            const selClass = "bg-gold text-dark border-gold shadow-xl scale-[1.02]";
            html += `<div onclick="selectPaymentMethod('cash')" class="${btnClass} ${currentSelectedPayment === 'cash' ? selClass : unselClass}">Efectivo</div>`;
            html += `<div onclick="selectPaymentMethod('transfer')" class="${btnClass} ${currentSelectedPayment === 'transfer' ? selClass : unselClass}">Transf.</div>`;
            if (hasAnyRicoCash) {
                html += `<div onclick="selectPaymentMethod('rico_balance')" class="${btnClass} ${currentSelectedPayment === 'rico_balance' ? selClass : unselClass}">Rico Cash</div>`;
            } else {
                html += `<div onclick="alert('Tu balance es 0. Recarga en tu perfil para usar Rico Cash.')" class="${btnClass} opacity-30 bg-white/5 border-white/5 text-white/20 cursor-not-allowed">Rico Cash</div>`;
            }
            html += '</div>';

            if (currentSelectedPayment === 'rico_balance' && hasAnyRicoCash) {
                html += `<div class="mt-2 text-center text-[10px] text-gold font-black uppercase tracking-widest">Balance: L. ${ricoBalance.toFixed(2)}${coversFull ? ' <span class="text-success ml-2">• 10% OFF APLICADO</span>' : ''}</div>`;
            }

            let buttonHtml = '';
            if (currentSelectedPayment === 'transfer') {
                buttonHtml = `<button id="final-checkout-btn" onclick="submitOrder('transfer')" class="w-full bg-success text-dark py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all">Confirmar Transferencia <i class="fas fa-check ml-1"></i></button>`;
            } else {
                buttonHtml = `<button id="final-checkout-btn" onclick="submitOrder('${currentSelectedPayment}')" class="w-full bg-gold text-dark py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all">Confirmar Orden <i class="fas fa-arrow-right ml-1"></i></button>`;
            }
            container.innerHTML = html;
            buttonContainer.innerHTML = buttonHtml;
        }

        function removeCartItem(index) { cart.splice(index, 1); updateCartUI(); if(cart.length === 0) closeCartModal(); else openCartModal(); }
        function closeCartModal() { document.getElementById('cart-modal').classList.add('hidden'); }

        async function submitOrder(paymentMethod = 'cash') {
            if (cart.length === 0) return;
            const btn = document.getElementById('final-checkout-btn');
            const ogText = btn.innerHTML;
            let orderNotes = document.getElementById('order-notes').value;
            
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Procesando...';
            btn.disabled = true;

            const itemsMap = {};
            cart.forEach(item => {
                const key = item.id + JSON.stringify(item.mods); 
                if (!itemsMap[key]) itemsMap[key] = { ...item, qty: 0 };
                itemsMap[key].qty += 1;
            });
            const items = Object.values(itemsMap);
            let subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.finalPrice) || 0), 0);
            let discount = 0;
            const ricoBalance = currentCustomer ? ((parseFloat(currentCustomer.cash_balance) || 0) + (parseFloat(currentCustomer.membership_credit) || 0)) : 0;
            const coversFull = ricoBalance >= subtotal;
            if (paymentMethod === 'rico_balance' && coversFull) discount = (subtotal * 0.10);
            const total = subtotal - discount;

            try {
                const tableInfo = document.getElementById('check-table')?.value.trim();
                const payload = {
                    items, subtotal, tax: 0, discount, total, paymentMethod,
                    fulfillment: fulfillmentType,
                    notes: `Mobile Order (${fulfillmentType})${tableInfo ? ' [MESA: ' + tableInfo + ']' : ''} ${orderNotes ? '- ' + orderNotes : ''}`
                };
                if (currentCustomer) payload.customerId = currentCustomer.id;
                const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!res.ok) throw new Error('Error saving');
                const savedOrder = await res.json();
                cart = []; updateCartUI(); closeCartModal();
                activeOrder = savedOrder;
                localStorage.setItem('ra_active_order', JSON.stringify(savedOrder));
                showTracking();
            } catch (err) { alert('Error, intenta de nuevo.'); btn.innerHTML = ogText; btn.disabled = false; }
        }

        let statusSubscription = null;
        async function showTracking() {
            if (!activeOrder) return;
            const modal = document.getElementById('track-modal');
            if (modal) { modal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
            document.getElementById('receipt-num').innerText = `#${activeOrder.order_number || activeOrder.id.slice(-4)}`;
            updateTrackingUI(activeOrder);

            if (statusSubscription) statusSubscription.unsubscribe();
            statusSubscription = supabaseClient.channel(`track_${activeOrder.id}`)
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${activeOrder.id}` }, 
                payload => { activeOrder = payload.new; updateTrackingUI(payload.new); }).subscribe();
        }

        function updateTrackingUI(order) {
            const status = (order.status || 'pending').toLowerCase();
            const badge = document.getElementById('status-badge');
            if (badge) badge.innerText = status.toUpperCase();
            
            const progress = document.getElementById('track-progress-line');
            if (progress) {
                if (['pending', 'paid'].includes(status)) progress.style.width = '10%';
                if (status.includes('preparing')) progress.style.width = '50%';
                if (['ready', 'drinks_ready', 'food_ready'].includes(status)) progress.style.width = '80%';
                if (status === 'completed') progress.style.width = '100%';
            }
        }

        window.openCheckout = () => openCartModal();
        window.closeCartModal = () => closeCartModal();
        window.closeModifier = () => closeModal();
        window.confirmItem = () => confirmItem();
        window.newOrder = () => {
            activeOrder = null; localStorage.removeItem('ra_active_order');
            document.getElementById('track-modal').classList.add('hidden');
            document.body.style.overflow = 'auto';
        };

        window.addEventListener('DOMContentLoaded', async () => {
            try {
                const res = await fetch('/api/store/status');
                const data = await res.json();
                if (!data.isOpen) {
                    document.getElementById('closed-banner')?.classList.remove('hidden');
                    return;
                }
            } catch (e) { console.error(e); }
            loadMenu();
            setFulfillment('pickup');
            
            const savedActive = localStorage.getItem('ra_active_order');
            if (savedActive) {
                try {
                    const localOrder = JSON.parse(savedActive);
                    // Verify with server if order is still active
                    const vres = await fetch(`/api/orders/${localOrder.id}`);
                    if (vres.ok) {
                        const latestOrder = await vres.json();
                        const status = (latestOrder.status || '').toLowerCase();
                        const activeStatuses = ['pending', 'paid', 'preparing', 'ready', 'drinks_ready', 'food_ready'];
                        
                        if (activeStatuses.includes(status)) {
                            activeOrder = latestOrder;
                            showTracking();
                        } else {
                            // Order is finished, clear it
                            localStorage.removeItem('ra_active_order');
                        }
                    } else {
                        // Order not found on server anymore
                        localStorage.removeItem('ra_active_order');
                    }
                } catch(e) {
                    console.error("Error verifying active order:", e);
                    localStorage.removeItem('ra_active_order');
                }
            }

            const phone = localStorage.getItem('ra_customer_phone') || localStorage.getItem('ra_phone');
            if (phone) {
                fetch(`/api/customer/profile?phone=${encodeURIComponent(phone)}`)
                .then(r => r.json()).then(u => { if (u && !u.error) currentCustomer = u; });
            }
        });
