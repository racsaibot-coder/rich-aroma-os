        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        gold: '#C9A66B',
                        dark: '#120C09',
                        charcoal: '#1E1610',
                        success: '#10B981',
                        error: '#EF4444'
                    },
                    fontFamily: {
                        sans: ['Inter', 'system-ui', 'sans-serif'],
                        display: ['Georgia', 'serif']
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
        let statusSubscription = null;
        let pollingInterval = null;
        let isAddonMode = false;
        let currentSelectedPayment = 'cash';

        async function loadMenu() {
            try {
                console.log("Loading menu...");
                const res = await fetch('/api/menu', { cache: 'no-cache' });
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
            if (!url || typeof url !== 'string') return "";
            if (url.startsWith('data:')) return url;
            if (url.includes('supabase.co')) {
                if (url.includes('?')) return url + '&width=400';
                return url + '?width=400';
            }
            return url;
        }

        function renderMenu() {
            try {
                const container = document.getElementById('menu-container');
                if (!container) return;
                const categories = {};
                
                menuItems.forEach(item => {
                    let cat = item.category || 'Otros';
                    const itemName = (item.name || '').toLowerCase();
                    const catLower = cat.toLowerCase();
                    
                    if (catLower === 'hot_drinks' || catLower === 'coffee' || catLower.includes('caliente')) cat = 'Café';
                    else if (catLower === 'cold_drinks' || catLower === 'drinks' || catLower.includes('helada')) cat = 'Heladas';
                    else if (catLower === 'food' || catLower === 'comida') cat = 'Comida';
                    else if (catLower === 'pastry' || catLower === 'postres' || catLower.includes('reposteria')) cat = 'Postres';
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
                console.log("MENU RENDERED");
            } catch(err) {
                console.error("Render Error:", err);
            }
        }

        function setupScrollSpy() {
            const sections = document.querySelectorAll('.menu-section');
            const navButtons = document.querySelectorAll('.cat-btn');
            const options = { root: null, rootMargin: '-130px 0px -40% 0px', threshold: 0 };
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

            const container = document.getElementById('mod-options');
            let html = '';
            relevantGroups.forEach(groupId => {
                const group = modGroups.find(g => g.id === groupId);
                if (!group) return;
                const options = modOptions.filter(o => o.group_id === groupId);
                html += `<div class="space-y-4">
                    <p class="text-[10px] font-black text-gold uppercase tracking-[0.3em]">${group.name}</p>
                    <div class="grid grid-cols-2 gap-3">`;
                options.forEach(opt => {
                    const sel = currentMods[groupId].includes(opt.id) ? 'border-gold bg-gold/10 text-gold' : 'border-white/10 bg-white/5 text-white/60';
                    html += `<button onclick="toggleMod('${group.id}', '${opt.id}')" id="mbtn-${opt.id}" class="mod-btn p-5 rounded-[1.5rem] border font-bold text-xs text-center transition-all ${sel}">${opt.name}</button>`;
                });
                html += `</div></div>`;
            });
            
            container.innerHTML = html;
            document.getElementById('mod-name').innerText = currentItem.name;
            document.getElementById('mod-price').innerText = `L ${(Number(currentItem.price) || 0).toFixed(2)}`;
            document.getElementById('mod-qty').innerText = "1";
            document.getElementById('mod-note').value = "";
            document.getElementById('mod-drawer').classList.add('active');
            document.getElementById('mod-overlay').classList.remove('hidden');
            setTimeout(() => document.getElementById('mod-overlay').style.opacity = "1", 10);
            updateModPrice();
        }

        function openNoteOnlyModal() {
            currentMods = {};
            document.getElementById('mod-options').innerHTML = "";
            document.getElementById('mod-name').innerText = currentItem.name;
            document.getElementById('mod-price').innerText = `L ${(Number(currentItem.price) || 0).toFixed(2)}`;
            document.getElementById('mod-qty').innerText = "1";
            document.getElementById('mod-note').value = "";
            document.getElementById('mod-drawer').classList.add('active');
            document.getElementById('mod-overlay').classList.remove('hidden');
            setTimeout(() => document.getElementById('mod-overlay').style.opacity = "1", 10);
            updateModPrice();
        }

        window.closeModifier = () => {
            document.getElementById('mod-drawer').classList.remove('active');
            document.getElementById('mod-overlay').style.opacity = "0";
            setTimeout(() => document.getElementById('mod-overlay').classList.add('hidden'), 400);
        };

        window.changeQty = (n) => {
            let q = parseInt(document.getElementById('mod-qty').innerText) + n;
            if(q < 1) q = 1;
            document.getElementById('mod-qty').innerText = q;
            updateModPrice();
        };

        function toggleMod(gid, oid) {
            currentMods[gid] = [oid];
            const options = modOptions.filter(o => o.group_id === gid);
            options.forEach(opt => {
                const btn = document.getElementById(`mbtn-${opt.id}`);
                if(opt.id === oid) { btn.classList.remove('border-white/10', 'bg-white/5', 'text-white/60'); btn.classList.add('border-gold', 'bg-gold/10', 'text-gold'); }
                else { btn.classList.add('border-white/10', 'bg-white/5', 'text-white/60'); btn.classList.remove('border-gold', 'bg-gold/10', 'text-gold'); }
            });
            updateModPrice();
        }

        function updateModPrice() {
            let total = Number(currentItem.price) || 0;
            for (const gid in currentMods) {
                currentMods[gid].forEach(oid => {
                    const o = modOptions.find(x => x.id === oid);
                    if(o) total += (parseFloat(o.price_adjustment) || 0);
                });
            }
            const qty = parseInt(document.getElementById('mod-qty').innerText);
            document.getElementById('mod-price').innerText = `L ${(total * qty).toFixed(2)}`;
        }

        window.add = () => {
            const mods = [];
            let itemPrice = Number(currentItem.price) || 0;
            for (const gid in currentMods) {
                currentMods[gid].forEach(oid => {
                    const o = modOptions.find(x => x.id === oid);
                    if(o) { mods.push({name: o.name}); itemPrice += (parseFloat(o.price_adjustment) || 0); }
                });
            }
            const note = document.getElementById('mod-note').value;
            if(note) mods.push({name: `📝 ${note}`});
            const qty = parseInt(document.getElementById('mod-qty').innerText);
            cart.push({ id: currentItem.id, name: currentItem.name, price: itemPrice, finalPrice: itemPrice * qty, mods, qty });
            updateCartUI();
            window.closeModifier();
        };

        function updateCartUI() {
            const total = cart.reduce((sum, item) => sum + item.finalPrice, 0);
            const counter = document.getElementById('cart-count-text');
            const totalEl = document.getElementById('cart-total-text');
            if (counter) counter.innerText = `${cart.length} Artículos`;
            if (totalEl) totalEl.innerText = `L ${total.toFixed(2)}`;
            const cartBar = document.getElementById('cart-bar');
            if (cart.length > 0) { cartBar.classList.remove('translate-y-[200%]', 'opacity-0'); cartBar.classList.add('translate-y-0', 'opacity-100'); }
            else { cartBar.classList.add('translate-y-[200%]', 'opacity-0'); cartBar.classList.remove('translate-y-0', 'opacity-100'); }
        }

        window.openCheckout = () => {
            const container = document.getElementById('check-items');
            if(cart.length === 0) { container.innerHTML = `<div class="text-white/20 text-center py-12 italic">Tu bolsa está vacía</div>`; }
            else {
                container.innerHTML = cart.map((item, index) => `
                    <div class="flex justify-between items-start bg-white/5 border border-white/5 p-6 rounded-[2rem]">
                        <div>
                            <div class="font-black text-white text-sm">${item.qty}x ${item.name}</div>
                            ${item.mods.length ? `<div class="text-[9px] font-bold text-white/30 mt-1 uppercase tracking-wider">${item.mods.map(m=>m.name).join(', ')}</div>` : ''}
                        </div>
                        <div class="flex items-center gap-4">
                            <span class="font-mono text-gold font-black">L ${item.finalPrice.toFixed(2)}</span>
                            <button onclick="removeCartItem(${index})" class="w-9 h-9 rounded-xl bg-error/10 text-error flex items-center justify-center text-xs"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>`).join('');
            }
            updateCheckSummary();
            document.getElementById('check-drawer').classList.add('active');
            document.getElementById('check-overlay').classList.remove('hidden');
            setTimeout(() => document.getElementById('check-overlay').style.opacity = "1", 10);
        };

        window.closeCheckout = () => {
            document.getElementById('check-drawer').classList.remove('active');
            document.getElementById('check-overlay').style.opacity = "0";
            setTimeout(() => document.getElementById('check-overlay').classList.add('hidden'), 400);
        };

        window.removeCartItem = (i) => { cart.splice(i, 1); updateCartUI(); window.openCheckout(); };

        function updateCheckSummary() {
            const subtotal = cart.reduce((sum, item) => sum + item.finalPrice, 0);
            document.getElementById('check-total').innerText = `L ${subtotal.toFixed(2)}`;
            if(currentCustomer) {
                const bal = (parseFloat(currentCustomer.cash_balance) || 0) + (parseFloat(currentCustomer.membership_credit) || 0);
                document.getElementById('check-rico-val').innerText = `L ${bal.toFixed(2)}`;
                if(bal >= subtotal) { document.getElementById('pbtn-rico').classList.remove('opacity-40', 'grayscale', 'pointer-events-none'); }
                else { document.getElementById('pbtn-rico').classList.add('opacity-40', 'grayscale', 'pointer-events-none'); if(currentSelectedPayment === 'rico_balance') setPayment('cash'); }
            }
        }

        window.setFulfill = (type) => {
            fulfillmentType = type;
            ['pickup', 'dinein', 'delivery'].forEach(f => {
                const b = document.getElementById('fbtn-' + f);
                if(f === type) { b.classList.remove('border-white/5', 'bg-white/5', 'text-white/40'); b.classList.add('border-gold', 'bg-gold/10', 'text-gold'); }
                else { b.classList.add('border-white/5', 'bg-white/5', 'text-white/40'); b.classList.remove('border-gold', 'bg-gold/10', 'text-gold'); }
            });
            if(type === 'dinein') document.getElementById('check-table-ui').classList.remove('hidden');
            else document.getElementById('check-table-ui').classList.add('hidden');
            if(type === 'delivery') document.getElementById('check-address-ui').classList.remove('hidden');
            else document.getElementById('check-address-ui').classList.add('hidden');
        };

        window.setPayment = (method) => {
            currentSelectedPayment = method;
            ['cash', 'transfer', 'rico_balance'].forEach(p => {
                const b = document.getElementById('pbtn-' + p);
                if(p === method) { b.classList.remove('border-white/5', 'bg-white/5', 'text-white/40'); b.classList.add('border-gold', 'bg-gold/10', 'text-gold'); }
                else { b.classList.add('border-white/5', 'bg-white/5', 'text-white/40'); b.classList.remove('border-gold', 'bg-gold/10', 'text-gold'); }
            });
            if(method === 'transfer') document.getElementById('check-bank-ui').classList.remove('hidden');
            else document.getElementById('check-bank-ui').classList.add('hidden');
        };

        window.submitFinalOrder = async () => {
            if(cart.length === 0) return;
            const btn = document.getElementById('final-btn');
            const name = document.getElementById('check-name').value.trim();
            if(!name) return alert("Por favor ingresa tu nombre");
            
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Procesando...';
            btn.disabled = true;

            const itemsMap = {};
            cart.forEach(item => {
                const key = item.id + JSON.stringify(item.mods); 
                if (!itemsMap[key]) itemsMap[key] = { ...item, qty: 0 };
                itemsMap[key].qty += 1;
            });
            const subtotal = cart.reduce((sum, item) => sum + item.finalPrice, 0);
            const payload = {
                items: Object.values(itemsMap), subtotal, tax: 0, discount: 0, total: subtotal, paymentMethod: currentSelectedPayment,
                fulfillment: fulfillmentType,
                notes: `Mobile: ${name} (${fulfillmentType})` + (document.getElementById('check-table').value ? ` MESA: ${document.getElementById('check-table').value}` : "")
            };
            if(currentCustomer) payload.customerId = currentCustomer.id;

            try {
                const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if(!res.ok) throw new Error('Fail');
                const saved = await res.json();
                cart = []; updateCartUI(); window.closeCheckout();
                activeOrder = saved;
                localStorage.setItem('ra_active_order', JSON.stringify(saved));
                showTracking();
            } catch(e) { alert("Error al enviar. Intenta de nuevo."); btn.innerHTML = "Enviar Pedido Ahora 🚀"; btn.disabled = false; }
        };

        async function showTracking() {
            if(!activeOrder) return;
            document.getElementById('track-modal').classList.remove('hidden');
            document.getElementById('receipt-num').innerText = `#${activeOrder.order_number || activeOrder.id.slice(-4)}`;
            
            // Render Items in tracking view
            const list = document.getElementById('track-items-list');
            if (list && activeOrder.items) {
                list.innerHTML = activeOrder.items.map(item => `
                    <div class="flex justify-between items-center py-2 border-b border-white/5">
                        <span class="text-white text-xs font-bold">${item.qty}x ${item.name}</span>
                        <span class="text-gold font-mono text-[10px]">L ${(parseFloat(item.finalPrice || item.price) * item.qty).toFixed(2)}</span>
                    </div>
                `).join('');
            }

            updateTrackingUI(activeOrder);

            // 1. Realtime Subscription
            if(statusSubscription) statusSubscription.unsubscribe();
            statusSubscription = supabaseClient.channel(`track_${activeOrder.id}`).on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'orders', 
                filter: `id=eq.${activeOrder.id}` 
            }, p => { 
                console.log("Realtime status update:", p.new.status);
                activeOrder = p.new; 
                updateTrackingUI(p.new); 
            }).subscribe();

            // 2. Polling Fallback (every 10s)
            if(pollingInterval) clearInterval(pollingInterval);
            pollingInterval = setInterval(async () => {
                try {
                    const res = await fetch(`/api/orders/${activeOrder.id}`);
                    if(res.ok) {
                        const latest = await res.json();
                        if (latest.status !== activeOrder.status) {
                            console.log("Polling status update:", latest.status);
                            activeOrder = latest;
                            updateTrackingUI(latest);
                        }
                        const s = (latest.status || '').toLowerCase();
                        if(['completed', 'cancelled', 'delivered'].includes(s)) {
                            clearInterval(pollingInterval);
                        }
                    }
                } catch(e) {}
            }, 10000);
        }

        function updateTrackingUI(order) {
            const status = (order.status || 'pending').toLowerCase();
            const fulfill = (order.fulfillment || 'pickup').toLowerCase();
            const badge = document.getElementById('status-badge');
            const title = document.querySelector('#track-modal h2');
            const msg = document.getElementById('track-msg');
            const line = document.getElementById('track-progress-line');
            
            if (badge) badge.innerText = status.toUpperCase();

            if (['pending', 'paid'].includes(status)) {
                title.innerText = "¡ORDEN RECIBIDA!";
                msg.innerText = "Tu pedido ha sido enviado. Prepárate para el mejor sabor.";
                line.style.width = "0%";
            } else if (status.includes('preparing')) {
                title.innerText = "PREPARANDO...";
                msg.innerText = "Nuestros baristas están preparando tu orden con amor.";
                line.style.width = "50%";
                updateStepUI(2);
            } else if (['ready', 'drinks_ready', 'food_ready'].includes(status)) {
                title.innerText = "¡ORDEN LISTA!";
                msg.innerText = fulfill === 'delivery' ? "Tu pedido está listo y esperando al repartidor." : "¡Ya puedes pasar por tu pedido a la barra!";
                line.style.width = fulfill === 'delivery' ? "75%" : "100%";
                updateStepUI(3);
            } else if (status === 'shipped' || status === 'out_for_delivery') {
                title.innerText = "EN CAMINO";
                msg.innerText = "El repartidor va en camino a tu ubicación.";
                line.style.width = "90%";
                updateStepUI(4);
            } else if (status === 'completed' || status === 'delivered') {
                title.innerText = "¡ENTREGADA!";
                msg.innerText = "¡Gracias por elegir Rich Aroma! Esperamos que lo disfrutes.";
                line.style.width = "100%";
                updateStepUI(fulfill === 'delivery' ? 4 : 3);
            }

            const deliveryStep = document.getElementById('step-delivery-ui');
            if (deliveryStep) {
                if (fulfill === 'delivery') deliveryStep.classList.remove('hidden');
                else deliveryStep.classList.add('hidden');
            }
        }

        function updateStepUI(stepNumber) {
            for (let i = 1; i <= 4; i++) {
                const step = document.getElementById(`step-${i}`);
                if (!step) continue;
                if (i <= stepNumber) {
                    step.classList.remove('bg-white/5', 'text-white/20', 'border-white/10');
                    step.classList.add('bg-gold', 'text-dark', 'border-gold');
                    step.innerHTML = '<i class="fas fa-check"></i>';
                }
            }
        }

        window.addEventListener('DOMContentLoaded', async () => {
            console.log("DOMContentLoaded started");
            try {
                console.log("Checking store status...");
                const res = await fetch('/api/store/status');
                const data = await res.json();
                console.log("Store status:", data.isOpen);
                if (!data.isOpen) { 
                    console.log("Store closed, showing overlay");
                    document.getElementById('closed-overlay')?.classList.remove('hidden'); 
                    // Don't return, allow menu to load in background
                } else {
                    document.getElementById('store-status-text').innerText = "Abierto Ahora";
                }
            } catch (e) { console.error("Store status error:", e); }
            
            console.log("Calling loadMenu...");
            loadMenu();
            setFulfill('pickup');
            setPayment('cash');
            const savedActive = localStorage.getItem('ra_active_order');
            if (savedActive) {
                try {
                    const localOrder = JSON.parse(savedActive);
                    const vres = await fetch(`/api/orders/${localOrder.id}`);
                    if(vres.ok) {
                        const latest = await vres.json();
                        const s = (latest.status || '').toLowerCase();
                        if(['pending','paid','preparing','ready','drinks_ready','food_ready','shipped','out_for_delivery'].includes(s)) { activeOrder = latest; showTracking(); }
                        else localStorage.removeItem('ra_active_order');
                    } else localStorage.removeItem('ra_active_order');
                } catch(e) { localStorage.removeItem('ra_active_order'); }
            }
            const phone = localStorage.getItem('ra_customer_phone') || localStorage.getItem('ra_phone');
            if (phone) {
                fetch(`/api/customer/profile?phone=${encodeURIComponent(phone)}`).then(r => r.json()).then(u => { if(u && !u.error) { currentCustomer = u; document.getElementById('user-pill').classList.remove('hidden'); document.getElementById('login-btn').classList.add('hidden'); document.getElementById('user-first-name').innerText = u.name.split(' ')[0]; } });
            }
        });
