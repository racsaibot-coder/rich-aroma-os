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

        let currentBookingItem = null;
        let selectedBookingDate = "";
        let selectedBookingSlot = null;
        let bookingDuration = 1;

        window.openBooking = (id) => {
            currentBookingItem = menuItems.find(i => i.id === id);
            if (!currentBookingItem) return;

            document.getElementById('booking-item-name').innerText = currentBookingItem.name;
            
            // Set default date to today
            const today = new Date().toISOString().split('T')[0];
            const dateInput = document.getElementById('booking-date');
            dateInput.value = today;
            dateInput.min = today;
            selectedBookingDate = today;
            
            bookingDuration = 1;
            selectedBookingSlot = null;
            updateBookingSlots();
            updateBookingSummary();

            document.getElementById('booking-drawer').classList.add('active');
            document.getElementById('booking-overlay').classList.remove('hidden');
            setTimeout(() => document.getElementById('booking-overlay').style.opacity = "1", 10);
        };

        window.closeBooking = () => {
            document.getElementById('booking-drawer').classList.remove('active');
            document.getElementById('booking-overlay').style.opacity = "0";
            setTimeout(() => document.getElementById('booking-overlay').classList.add('hidden'), 400);
        };

        window.updateBookingSlots = () => {
            selectedBookingDate = document.getElementById('booking-date').value;
            const container = document.getElementById('booking-slots-grid');
            if (!container) return;

            let html = '';
            const now = new Date();
            const isToday = selectedBookingDate === now.toISOString().split('T')[0];
            
            // Generate slots 5am to 10pm
            let start = 5;
            let end = 22;

            for (let h = start; h < end; h++) {
                const hour12 = h > 12 ? h - 12 : h;
                const ampm = h >= 12 ? 'PM' : 'AM';
                const timeStr = `${hour12}:00 ${ampm}`;
                const fullTime = `${h.toString().padStart(2, '0')}:00`;
                
                // Check if slot is in the past
                let isPast = false;
                if (isToday) {
                    if (h <= now.getHours()) isPast = true;
                }

                const isSelected = selectedBookingSlot === fullTime;
                
                html += `
                    <button onclick="selectBookingSlot('${fullTime}')" 
                        class="p-4 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all ${isPast ? 'opacity-20 grayscale pointer-events-none' : (isSelected ? 'bg-gold text-dark border-gold shadow-lg' : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10')}">
                        ${timeStr}
                    </button>
                `;
            }
            container.innerHTML = html;
        };

        window.selectBookingSlot = (time) => {
            selectedBookingSlot = time;
            updateBookingSlots();
            updateBookingSummary();
        };

        window.changeBookingDuration = (delta) => {
            bookingDuration = Math.max(1, Math.min(8, bookingDuration + delta));
            document.getElementById('booking-duration').innerText = bookingDuration;
            updateBookingSummary();
        };

        function updateBookingSummary() {
            if (!currentBookingItem) return;
            const total = parseFloat(currentBookingItem.price) * bookingDuration;
            document.getElementById('booking-total-price').innerText = `L ${total.toFixed(0)}`;
            
            const label = document.getElementById('booking-time-label');
            if (selectedBookingSlot) {
                label.innerText = `${selectedBookingSlot} (${bookingDuration}hr)`;
                label.classList.remove('text-white/20');
                label.classList.add('text-gold');
            } else {
                label.innerText = "Selecciona horario";
                label.classList.add('text-white/20');
            }
        }

        window.submitBookingToCart = () => {
            if (!selectedBookingSlot) return alert("Por favor selecciona una hora");
            
            const startTime = new Date(`${selectedBookingDate}T${selectedBookingSlot}:00`);
            
            // Add to cart as a special item
            const bookingItem = {
                ...currentBookingItem,
                qty: bookingDuration,
                finalPrice: parseFloat(currentBookingItem.price) * bookingDuration,
                mods: [],
                note: `RESERVA: ${selectedBookingDate} @ ${selectedBookingSlot} (${bookingDuration}hr)`,
                scheduledFor: startTime.toISOString()
            };
            
            // Since cart normally handles 1-qty items from menu, we push this directly
            cart.push(bookingItem);
            updateCartUI();
            closeBooking();
            
            // Open cart immediately to show success
            setTimeout(window.openCheckout, 500);
        };

        async function loadMenu() {
            try {
                console.log("Loading menu...");
                const urlParams = new URLSearchParams(window.location.search);
                const resId = urlParams.get('restaurantId') || 'rich-aroma';
                const res = await fetch(`/api/menu?restaurantId=${resId}`, { cache: 'no-cache' });
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
                const separator = url.includes('?') ? '&' : '?';
                return url + separator + 'width=400';
            }
            return url;
        }

        function renderMenu() {
            try {
                const container = document.getElementById('menu-container');
                if (!container) return;
                const categories = {};
                
                // --- MEMBER DASHBOARD BANNER (NEW) ---
                let dashboardHtml = '';
                if (currentCustomer) {
                    const streak = (currentCustomer.drink_streak || 0) % 7;
                    const coffeeAvailable = currentCustomer.is_vip_eligible;
                    const isBootcamp = Array.isArray(currentCustomer.tags) && currentCustomer.tags.includes('Bootcamp');

                    dashboardHtml = `
                        <div class="mb-12 animate-in fade-in zoom-in duration-500">
                            <div class="bg-gradient-to-br from-gold/20 to-transparent border border-gold/20 rounded-[2.5rem] p-6 space-y-4">
                                <div class="flex justify-between items-center">
                                    <div>
                                        <h4 class="text-[10px] font-black text-gold uppercase tracking-[0.3em]">Retos & Puntos</h4>
                                        ${isBootcamp ? `<span class="inline-block mt-1 bg-blue-500 text-white text-[7px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest"><i class="fas fa-dumbbell mr-1"></i> Bootcamp Member</span>` : ''}
                                    </div>
                                    <span class="text-[10px] font-black text-white/40 uppercase">${currentCustomer.points || 0} Rico Points</span>
                                </div>
                                
                                ${coffeeAvailable ? `
                                <div class="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex justify-between items-center mb-2">
                                    <div class="flex items-center gap-3">
                                        <span class="text-xl">☕</span>
                                        <div>
                                            <p class="text-[10px] font-black text-white uppercase tracking-tighter">Café Diario Gratis</p>
                                            <p class="text-[8px] text-amber-500 font-bold uppercase">¡Disponible para hoy!</p>
                                        </div>
                                    </div>
                                    <div class="w-2 h-2 bg-amber-500 rounded-full animate-ping"></div>
                                </div>
                                ` : ''}

                                <div class="flex items-center gap-4">
                                    <div class="flex-1 space-y-2">
                                        <div class="flex justify-between text-[11px] font-bold">
                                            <span class="text-white/80">Drink Streak</span>
                                            <span class="text-gold">${streak}/6</span>
                                        </div>
                                        <div class="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                            <div class="h-full bg-gold shadow-[0_0_10px_rgba(201,166,107,0.5)]" style="width: ${(streak/6)*100}%"></div>
                                        </div>
                                    </div>
                                    <button onclick="window.openProfile()" class="w-10 h-10 rounded-2xl bg-gold text-dark flex items-center justify-center shadow-lg"><i class="fas fa-gift text-sm"></i></button>
                                </div>
                                <p class="text-[9px] text-white/30 font-bold uppercase tracking-widest text-center">${streak === 6 ? '¡PRÓXIMA BEBIDA GRATIS!' : 'Faltan ' + (6-streak) + ' bebidas para tu premio'}</p>
                                ${isBootcamp ? `<p class="text-[8px] text-blue-400 font-bold uppercase tracking-tighter text-center">¡Precio Especial Post-Workout Activo! (5am-8am / 6pm-10pm)</p>` : ''}
                            </div>
                        </div>
                    `;
                }

                menuItems.forEach(item => {
                    let cat = item.category || 'Otros';
                    const itemName = (item.name || '').toLowerCase();
                    const catLower = cat.toLowerCase();
                    
                    // --- REINFORCED CATEGORIZATION (Combos first) ---
                    if (catLower === 'combos' || catLower === 'combo' || catLower.includes('paquete') || itemName.includes('combo') || itemName.includes('paquete')) cat = 'Combos';
                    else if (catLower === 'retail' || catLower.includes('deportes')) cat = 'Deportes';
                    else if (catLower === 'hot_drinks' || catLower === 'coffee' || catLower.includes('caliente')) cat = 'Café';
                    else if (catLower === 'cold_drinks' || catLower === 'drinks' || catLower.includes('helada')) cat = 'Heladas';
                    else if (catLower === 'food' || catLower === 'comida') cat = 'Comida';
                    else if (catLower === 'pastry' || catLower === 'postres' || catLower.includes('reposteria') || catLower === 'pastries') cat = 'Postres';
                    else if (catLower === 'secret' || catLower === 'secreto') cat = 'Menú Secreto';
                    
                    if(!categories[cat]) categories[cat] = [];
                    categories[cat].push(item);
                });

                const categoryOrder = ['Combos', 'Deportes', 'Comida', 'Café', 'Heladas', 'Postres', 'Menú Secreto', 'Otros'];
                const sortedCategories = Object.keys(categories).sort((a, b) => {
                    let indexA = categoryOrder.indexOf(a);
                    let indexB = categoryOrder.indexOf(b);
                    if (indexA === -1) indexA = 99;
                    if (indexB === -1) indexB = 99;
                    return indexA - indexB;
                });

                let html = dashboardHtml;
                sortedCategories.forEach(category => {
                    // --- SECURITY: Hide internal categories from public view ---
                    if (category === 'Deportes' || category === 'retail') return;

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
                        const isBooking = item.id.startsWith('sports_court') || item.id.startsWith('event_');
                        const cardClass = isCombo ? "item-card rounded-[2rem] bg-white/5 border border-gold/30 overflow-hidden flex flex-col group active:scale-95 transition-all shadow-xl" : "item-card rounded-[2rem] bg-white/5 border border-white/5 overflow-hidden flex flex-col group active:scale-95 transition-all";
                        const clickAction = isBooking ? `openBooking('${item.id}')` : `openModifier('${item.id}')`;
                        const btnLabel = isBooking ? 'Reservar' : 'Agregar';
                        
                        // --- STATUS ENGINE: Price Preview ---
                        const tags = Array.isArray(currentCustomer?.tags) ? currentCustomer.tags : [];
                        const hasFiftyPower = tags.includes('Employee') || tags.includes('BlackCard');
                        const isExclusion = item.id.includes('dubai_chocolate') || (item.category || '').toLowerCase().includes('retail');
                        
                        let displayPrice = parseFloat(item.price) || 0;
                        let priceHtml = `<span class="text-gold font-mono font-black text-base">L ${displayPrice.toFixed(0)}</span>`;
                        
                        if (hasFiftyPower && !isExclusion && !isBooking) {
                            const discounted = displayPrice * 0.5;
                            priceHtml = `
                                <div class="flex flex-col">
                                    <span class="text-white/20 text-[9px] font-bold line-through tracking-tighter italic leading-none mb-1">Público: L ${displayPrice.toFixed(0)}</span>
                                    <span class="text-cyan-400 font-mono font-black text-lg leading-none">L ${discounted.toFixed(0)}</span>
                                    <span class="text-[7px] text-cyan-400/50 font-black uppercase tracking-widest mt-1">Status 50% OFF</span>
                                </div>
                            `;
                        }

                        const imgUrl = optimizeImg(item.image_url);
                        const imgHtml = imgUrl ? `
                                <div class="w-full h-40 bg-charcoal overflow-hidden relative">
                                    <img src="${imgUrl}" class="w-full h-full object-cover" loading="lazy">
                                    <div class="absolute inset-0 bg-gradient-to-t from-dark/80 to-transparent"></div>
                                    <div class="absolute bottom-3 right-3 w-max px-3 h-10 rounded-2xl bg-gold text-dark flex items-center justify-center gap-2 shadow-lg transform rotate-3 group-hover:rotate-0 transition-transform"><span class="text-[9px] font-black uppercase tracking-widest">${btnLabel}</span><i class="fas fa-plus text-xs"></i></div>
                                </div>` : `
                                <div class="w-full h-16 bg-charcoal relative flex items-center justify-end px-4">
                                    <div class="w-max px-3 h-10 rounded-2xl bg-gold text-dark flex items-center justify-center gap-2 shadow-lg"><span class="text-[9px] font-black uppercase tracking-widest">${btnLabel}</span><i class="fas fa-plus text-xs"></i></div>
                                </div>`;
                        
                        html += `
                            <div class="${cardClass}" onclick="${clickAction}">
                                ${imgHtml}
                                <div class="p-5 flex-1 flex flex-col justify-between">
                                    <h3 class="font-black text-sm leading-tight mb-2 text-white/90">${item.name}</h3>
                                    ${priceHtml}
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

        function initTimeSlots() {
            const select = document.getElementById('check-schedule');
            if (!select) return;
            
            let html = '<option value="asap">Lo antes posible (ASAP)</option>';
            const now = new Date();
            
            // Set starting point to next 15-min block (min 20 mins from now)
            let start = new Date(now.getTime() + 20 * 60000);
            let mins = start.getMinutes();
            let step = 15;
            start.setMinutes(Math.ceil(mins / step) * step);
            start.setSeconds(0);
            start.setMilliseconds(0);

            // Generate slots for today until 7:00 PM (Closing time)
            for (let i = 0; i < 24; i++) {
                if (start.getHours() >= 19) break; // Don't schedule past 7 PM
                const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                html += `<option value="${start.toISOString()}">${timeStr}</option>`;
                start = new Date(start.getTime() + 15 * 60000);
            }
            select.innerHTML = html;
        }

        window.openCheckout = () => {
            const container = document.getElementById('check-items');
            initTimeSlots();
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
                if(b) {
                    if(f === type) { b.classList.remove('border-white/5', 'bg-white/5', 'text-white/40'); b.classList.add('border-gold', 'bg-gold/10', 'text-gold'); }
                    else { b.classList.add('border-white/5', 'bg-white/5', 'text-white/40'); b.classList.remove('border-gold', 'bg-gold/10', 'text-gold'); }
                }
            });
            if(type === 'dinein') {
                const el = document.getElementById('check-table-ui');
                if(el) el.classList.remove('hidden');
            } else {
                const el = document.getElementById('check-table-ui');
                if(el) el.classList.add('hidden');
            }
            if(type === 'delivery') {
                const el = document.getElementById('check-address-ui');
                if(el) el.classList.remove('hidden');
            } else {
                const el = document.getElementById('check-address-ui');
                if(el) el.classList.add('hidden');
            }
        };

        window.setPayment = (method) => {
            currentSelectedPayment = method;
            ['cash', 'transfer', 'rico_balance'].forEach(p => {
                const b = document.getElementById('pbtn-' + p);
                if(b) {
                    if(p === method) { b.classList.remove('border-white/5', 'bg-white/5', 'text-white/40'); b.classList.add('border-gold', 'bg-gold/10', 'text-gold'); }
                    else { b.classList.add('border-white/5', 'bg-white/5', 'text-white/40'); b.classList.remove('border-gold', 'bg-gold/10', 'text-gold'); }
                }
            });
            if(method === 'transfer') {
                const el = document.getElementById('check-bank-ui');
                if(el) el.classList.remove('hidden');
            } else {
                const el = document.getElementById('check-bank-ui');
                if(el) el.classList.add('hidden');
            }
        };

        window.submitFinalOrder = async () => {
            if(cart.length === 0) return;
            const btn = document.getElementById('final-btn');
            const name = document.getElementById('check-name').value.trim();
            const phone = document.getElementById('check-phone').value.trim();
            
            if(!name) return alert("Por favor ingresa tu nombre");
            if(!currentCustomer && !phone) return alert("Por favor ingresa tu número de WhatsApp para contactarte sobre tu pedido");
            
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Procesando...';
            btn.disabled = true;

            const urlParams = new URLSearchParams(window.location.search);
            const resId = urlParams.get('restaurantId') || 'rich-aroma';

            const itemsMap = {};
            cart.forEach(item => {
                const key = item.id + JSON.stringify(item.mods); 
                if (!itemsMap[key]) itemsMap[key] = { ...item, qty: 0 };
                itemsMap[key].qty += 1;
            });
            const subtotal = cart.reduce((sum, item) => sum + item.finalPrice, 0);
            const scheduleVal = document.getElementById('check-schedule').value;
            
            // Check if cart has a booking item (prioritize its schedule)
            const bookingItem = cart.find(i => i.scheduledFor);
            const finalSchedule = bookingItem ? bookingItem.scheduledFor : (scheduleVal === 'asap' ? null : scheduleVal);

            const payload = {
                items: Object.values(itemsMap), subtotal, tax: 0, discount: 0, total: subtotal, paymentMethod: currentSelectedPayment,
                fulfillment: fulfillmentType,
                restaurantId: resId,
                guestPhone: phone,
                scheduledFor: finalSchedule,
                notes: `Mobile: ${name} (${fulfillmentType})` + (document.getElementById('check-table').value ? ` MESA: ${document.getElementById('check-table').value}` : "")
            };
            if(currentCustomer) payload.customerId = currentCustomer.id;

            try {
                // Pointing to V2 for testing the new features
                const res = await fetch('/api/orders-v2', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if(!res.ok) throw new Error('Fail');
                const saved = await res.json();
                cart = []; updateCartUI(); window.closeCheckout();
                activeOrder = saved;
                localStorage.setItem('ra_active_order', JSON.stringify(saved));
                showTracking();
            } catch(e) { alert("Error al enviar. Intenta de nuevo."); btn.innerHTML = "Enviar Pedido Ahora 🚀"; btn.disabled = false; }
        };

        window.uploadReceipt = async (input) => {
            if (!input.files || !input.files[0] || !activeOrder) return;
            const file = input.files[0];
            const btn = document.getElementById('upload-btn');
            const status = document.getElementById('upload-status');
            
            btn.disabled = true;
            status.classList.remove('hidden');
            
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64 = e.target.result;
                try {
                    const res = await fetch('/api/upload-receipt', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ orderId: activeOrder.id, image: base64 })
                    });
                    if (res.ok) {
                        alert("✅ Comprobante subido exitosamente. Procesaremos tu orden pronto.");
                        document.getElementById('transfer-upload-section').classList.add('hidden');
                    } else {
                        throw new Error("Upload fail");
                    }
                } catch (err) {
                    alert("Error al subir imagen. Intenta de nuevo.");
                } finally {
                    btn.disabled = false;
                    status.classList.add('hidden');
                }
            };
            reader.readAsDataURL(file);
        };

        async function showTracking() {
            if(!activeOrder) return;
            document.getElementById('track-modal').classList.remove('hidden');
            document.getElementById('receipt-num').innerText = `#${activeOrder.order_number || activeOrder.id.slice(-4)}`;
            
            // Re-fetch to ensure we have latest if this is a manual refresh
            try {
                const res = await fetch(`/api/orders/${activeOrder.id}?v=${Date.now()}`);
                if(res.ok) {
                    const latest = await res.json();
                    activeOrder = latest;
                }
            } catch(e) {}

            // Render Items in tracking view
            const list = document.getElementById('track-items-list');
            if (list && activeOrder.items) {
                const total = parseFloat(activeOrder.total || 0).toFixed(2);
                const paymentStatus = (activeOrder.status === 'pending' && activeOrder.payment_method !== 'transfer') ? 'PENDIENTE DE PAGO' : activeOrder.status.toUpperCase();
                
                list.innerHTML = `
                    <div class="mb-4 pb-4 border-b border-white/10">
                        <p class="text-[8px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">Estado de Pago</p>
                        <p class="text-xs font-black ${activeOrder.status === 'paid' ? 'text-success' : 'text-amber-500'} uppercase">${paymentStatus}</p>
                    </div>
                ` + activeOrder.items.map(item => `
                    <div class="flex justify-between items-center py-2 border-b border-white/5">
                        <span class="text-white text-xs font-bold">${item.qty}x ${item.name}</span>
                        <span class="text-gold font-mono text-[10px]">L ${(parseFloat(item.finalPrice || item.price) * item.qty).toFixed(2)}</span>
                    </div>
                `).join('') + `
                    <div class="flex justify-between items-center pt-4">
                        <span class="text-white/40 text-[10px] font-black uppercase">Total</span>
                        <span class="text-white text-xl font-black italic">L ${total}</span>
                    </div>
                `;
            }

            if (window.QRCode) {
                const qrContainer = document.getElementById('receipt-qr');
                if (qrContainer) {
                    qrContainer.innerHTML = "";
                    qrContainer.onclick = () => {
                        alert(`ID de Orden: ${activeOrder.id}\nMuestra este ID al cajero si no puede escanear el código.`);
                    };
                    qrContainer.style.cursor = "pointer";
                    new QRCode(qrContainer, {
                        text: activeOrder.id,
                        width: 120,
                        height: 120,
                        colorDark: "#120C09",
                        colorLight: "#ffffff",
                        correctLevel: QRCode.CorrectLevel.H
                    });
                }
            }

            updateTrackingUI(activeOrder);

            // Show Transfer Upload if needed
            const uploadSection = document.getElementById('transfer-upload-section');
            if (uploadSection) {
                if (activeOrder.payment_method === 'transfer' && !activeOrder.receipt_url) {
                    uploadSection.classList.remove('hidden');
                } else {
                    uploadSection.classList.add('hidden');
                }
            }

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
                    const res = await fetch(`/api/orders/${activeOrder.id}?v=${Date.now()}`);
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
            const icon = document.getElementById('track-icon');
            
            if (badge) badge.innerText = status.toUpperCase();

            // Reset step icons first
            const steps = [
                { id: 1, icon: 'fa-check' },
                { id: 2, icon: 'fa-fire-alt' },
                { id: 3, icon: 'fa-mug-hot' },
                { id: 4, icon: 'fa-motorcycle' }
            ];
            steps.forEach(s => {
                const el = document.getElementById(`step-${s.id}`);
                if(el) el.innerHTML = `<i class="fas ${s.icon}"></i>`;
            });

            if (['pending', 'paid'].includes(status)) {
                title.innerText = "¡ORDEN RECIBIDA!";
                msg.innerText = "Tu pedido ha sido enviado. Prepárate para el mejor sabor.";
                line.style.width = "0%";
                if(icon) icon.innerHTML = '<i class="fas fa-check"></i>';
                updateStepUI(1);
            } else if (status.includes('preparing')) {
                title.innerText = "PREPARANDO...";
                msg.innerText = "Nuestros baristas están preparando tu orden con amor.";
                line.style.width = "50%";
                if(icon) icon.innerHTML = '<i class="fas fa-fire-alt text-gold"></i>';
                updateStepUI(2);
            } else if (['ready', 'drinks_ready', 'food_ready'].includes(status)) {
                title.innerText = "¡ORDEN LISTA!";
                msg.innerText = fulfill === 'delivery' ? "Tu pedido está listo y esperando al repartidor." : "¡Ya puedes pasar por tu pedido a la barra!";
                line.style.width = fulfill === 'delivery' ? "75%" : "100%";
                if(icon) icon.innerHTML = '<i class="fas fa-mug-hot text-gold"></i>';
                updateStepUI(3);
            } else if (status === 'shipped' || status === 'out_for_delivery') {
                title.innerText = "EN CAMINO";
                msg.innerText = "El repartidor va en camino a tu ubicación.";
                line.style.width = "90%";
                if(icon) icon.innerHTML = '<i class="fas fa-motorcycle text-cyan"></i>';
                updateStepUI(4);
            } else if (status === 'completed' || status === 'delivered') {
                title.innerText = "¡ENTREGADA!";
                msg.innerText = "¡Gracias por elegir Rich Aroma! Esperamos que lo disfrutes.";
                line.style.width = "100%";
                if(icon) icon.innerHTML = '<i class="fas fa-heart text-gold"></i>';
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
                } else {
                    step.classList.add('bg-white/5', 'text-white/20', 'border-white/10');
                    step.classList.remove('bg-gold', 'text-dark', 'border-gold');
                    // Icon reset is handled in updateTrackingUI
                }
            }
        }

        let loginPin = "";
        window.openLogin = () => {
            document.getElementById('login-overlay').classList.remove('hidden');
            loginPin = "";
            updateLoginPinDisplay();
        };

        window.closeLogin = () => {
            document.getElementById('login-overlay').classList.add('hidden');
        };

        window.typeLoginPin = (num) => {
            if (loginPin.length < 4) {
                loginPin += num;
                updateLoginPinDisplay();
                if (loginPin.length === 4) {
                    setTimeout(submitLogin, 300);
                }
            }
        };

        window.clearLoginPin = () => {
            loginPin = "";
            updateLoginPinDisplay();
        };

        function updateLoginPinDisplay() {
            for (let i = 1; i <= 4; i++) {
                const dot = document.getElementById(`lpin-${i}`);
                if (dot) {
                    dot.classList.toggle('bg-white', i <= loginPin.length);
                    dot.classList.toggle('border-white/20', i > loginPin.length);
                }
            }
        }

        window.submitLogin = async () => {
            const country = document.getElementById('login-country').value;
            const rawPhone = document.getElementById('login-phone').value.replace(/\D/g, '');
            const phone = country + rawPhone;
            const btn = document.getElementById('login-submit-btn');

            if (rawPhone.length < 8 || loginPin.length < 4) {
                alert("Ingresa tu número y PIN completo.");
                return;
            }

            btn.innerText = "...";
            btn.disabled = true;

            try {
                // 1. Verify PIN and get profile
                const res = await fetch(`/api/customer/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone, pin: loginPin })
                });

                const data = await res.json();

                if (res.ok && data.success) {
                    localStorage.setItem('ra_customer_phone', phone);
                    localStorage.setItem('ra_customer_pin', loginPin);
                    location.reload(); // Refresh to apply status pricing
                } else {
                    alert(data.error || "PIN Incorrecto o cuenta no encontrada.");
                    window.clearLoginPin();
                }
            } catch (e) {
                alert("Error de conexión. Intenta de nuevo.");
            } finally {
                btn.innerText = "OK";
                btn.disabled = false;
            }
        };

        window.logout = () => {
            localStorage.removeItem('ra_customer_phone');
            localStorage.removeItem('ra_customer_pin');
            localStorage.removeItem('ra_active_order');
            location.reload();
        };

        window.openProfile = () => {
            if(!currentCustomer) return window.openLogin();
            document.getElementById('prof-name').innerText = currentCustomer.name;
            document.getElementById('prof-phone').innerText = currentCustomer.phone;
            document.getElementById('prof-initial').innerText = currentCustomer.name.charAt(0).toUpperCase();
            document.getElementById('prof-points').innerText = (currentCustomer.points || 0);
            const badge = document.getElementById('prof-points-badge');
            if (badge) badge.innerText = `${currentCustomer.points || 0} PTS`;
            
            const bal = (parseFloat(currentCustomer.cash_balance) || 0) + (parseFloat(currentCustomer.membership_credit) || 0);
            document.getElementById('prof-balance').innerText = `L ${bal.toFixed(2)}`;
            
            if(currentCustomer.is_vip) document.getElementById('prof-vip-badge').classList.remove('hidden');
            else document.getElementById('prof-vip-badge').classList.add('hidden');

            const isStaff = Array.isArray(currentCustomer.tags) && currentCustomer.tags.includes('Employee');
            if(isStaff) {
                document.getElementById('prof-vip-badge').innerText = "Employee Member";
                document.getElementById('prof-vip-badge').classList.remove('hidden');
                document.getElementById('prof-vip-badge').className = "mt-2 inline-flex items-center gap-1.5 bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-full text-[9px] font-black uppercase border border-cyan-500/30";
            }

            if(currentCustomer.is_vip_eligible) document.getElementById('prof-coffee-badge').classList.remove('hidden');
            else document.getElementById('prof-coffee-badge').classList.add('hidden');

            const streak = (currentCustomer.drink_streak || 0) % 7;
            document.getElementById('prof-streak-count').innerText = `${streak}/6`;
            document.getElementById('prof-streak-msg').innerText = streak === 6 ? "¡Tu próxima bebida es GRATIS!" : `Faltan ${6-streak} bebidas para tu premio.`;

            renderRewards();
            
            document.getElementById('profile-drawer').classList.add('active');
            document.getElementById('profile-overlay').classList.remove('hidden');
            setTimeout(() => document.getElementById('profile-overlay').style.opacity = "1", 10);
            
            if (window.QRCode) {
                document.getElementById('prof-qr').innerHTML = "";
                new QRCode(document.getElementById('prof-qr'), { text: currentCustomer.phone, width: 160, height: 160, colorDark: "#120C09", colorLight: "#ffffff" });
            }
        };

        function renderRewards() {
            const list = document.getElementById('prof-rewards-list');
            if(!list) return;
            const rewards = [
                { p: 30, n: "Upgrade de Tamaño", d: "Sube de 12oz a 16oz gratis", i: "⬆️" },
                { p: 50, n: "Café Gratis", d: "Cualquier bebida caliente", i: "☕" },
                { p: 100, n: "Baleada Gratis", d: "Baleada sencilla o con todo", i: "🫓" },
                { p: 200, n: "Plato Típico", d: "Desayuno o Almuerzo completo", i: "🍽️" }
            ];
            const myPoints = currentCustomer.points || 0;
            list.innerHTML = rewards.map(r => `
                <div class="glass p-5 rounded-[2rem] flex justify-between items-center border border-white/5">
                    <div class="flex items-center gap-4">
                        <div class="text-2xl">${r.i}</div>
                        <div>
                            <p class="text-[10px] font-black text-white uppercase">${r.n}</p>
                            <p class="text-[8px] text-white/40 font-bold uppercase tracking-tighter">${r.d}</p>
                        </div>
                    </div>
                    <button onclick="claimReward(${r.p}, '${r.n}')" class="px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${myPoints >= r.p ? 'bg-gold text-dark' : 'bg-white/5 text-white/20 pointer-events-none'}">
                        ${r.p} PTS
                    </button>
                </div>
            `).join('');
        }

        window.claimReward = async (pts, name) => {
            if(!currentCustomer || (currentCustomer.points || 0) < pts) return;
            if(!confirm(`¿Canjear ${pts} puntos por: ${name}? Se generará un cupón en tu cuenta.`)) return;
            
            try {
                const res = await fetch('/api/staff?action=claim_reward', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ customerId: currentCustomer.id, points: pts, rewardName: name })
                });
                if(res.ok) {
                    const updated = await res.json();
                    currentCustomer.points = updated.points;
                    alert("¡Premio Canjeado! Muéstralo en caja para aplicarlo.");
                    window.openProfile(); // Refresh
                }
            } catch(e) { alert("Error al canjear"); }
        };

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
                fetch(`/api/customer/profile?phone=${encodeURIComponent(phone)}`).then(r => r.json()).then(u => { 
                    if(u && !u.error) { 
                        currentCustomer = u; 
                        document.getElementById('user-pill').classList.remove('hidden'); 
                        document.getElementById('login-btn').classList.add('hidden'); 
                        
                        const isEmployee = Array.isArray(u.tags) && u.tags.includes('Employee');
                        const firstName = u.name.split(' ')[0];
                        document.getElementById('user-first-name').innerText = isEmployee ? `[STAFF] ${firstName}` : firstName;
                    } 
                });
            }
        });
