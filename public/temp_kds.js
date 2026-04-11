        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        gold: '#C9A66B',
                        dark: '#120C09',
                        charcoal: '#1E1610',
                        success: '#10B981',
                        danger: '#EF4444',
                        warning: '#F59E0B'
                    }
                }
            }
        }
    </script>
    <script>
        let orders = [];
        let currentMode = 'drinks'; // 'drinks' or 'food'

        // --- CORE LOGIC ---
        window.onload = () => {
            fetchOrders();
            setInterval(fetchOrders, 5000);
        };

        async function fetchOrders() {
            try {
                const res = await fetch('/api/orders');
                const data = await res.json();
                orders = data.orders || [];
                console.log("KDS Fetched Orders:", orders.length);
                renderKDS();
                document.getElementById('sync-status').innerText = 'Sincronizado: ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
            } catch (e) {
                console.error("KDS Fetch Error:", e);
                document.getElementById('sync-status').innerText = 'Error de Sincronización';
            }
        }

        function setMode(mode) {
            currentMode = mode;
            document.getElementById('btn-drinks').className = mode === 'drinks' ? 'px-4 py-1.5 rounded-full text-[9px] font-black uppercase bg-gold text-dark transition-all' : 'px-4 py-1.5 rounded-full text-[9px] font-black uppercase text-white/40 transition-all';
            document.getElementById('btn-food').className = mode === 'food' ? 'px-4 py-1.5 rounded-full text-[9px] font-black uppercase bg-gold text-dark transition-all' : 'px-4 py-1.5 rounded-full text-[9px] font-black uppercase text-white/40 transition-all';
            renderKDS();
        }

        function isDrink(item) {
            const id = (item.id || '').toLowerCase();
            const name = (item.name || '').toLowerCase();
            const cat = (item.category || '').toLowerCase();
            return id.startsWith('hot_') || id.startsWith('cold_') || id.startsWith('frappe_') || 
                   name.includes('combo') || name.includes('latte') || name.includes('caf') || 
                   name.includes('jugo') || name.includes('frappe') || name.includes('tés') ||
                   cat.includes('coffee') || cat.includes('drinks') || cat.includes('heladas');
        }

        function isFood(item) {
            const id = (item.id || '').toLowerCase();
            const name = (item.name || '').toLowerCase();
            const cat = (item.category || '').toLowerCase();
            return id.startsWith('food_') || name.includes('baleada') || name.includes('sandwich') || 
                   name.includes('combo') || name.includes('crepa') || name.includes('toast') ||
                   cat.includes('food') || cat.includes('comida');
        }

        function renderKDS() {
            const container = document.getElementById('kds-container');
            
            const activeOrders = orders.filter(o => {
                // Skip completed or cancelled
                if (['completed', 'cancelled', 'ready'].includes(o.status)) return false;
                
                // Station specific status filtering
                if (currentMode === 'drinks' && o.status === 'drinks_ready') return false;
                if (currentMode === 'food' && o.status === 'food_ready') return false;

                // Ensure it has items for this station
                const items = o.items || [];
                const hasRelevantItems = items.some(i => currentMode === 'drinks' ? isDrink(i) : isFood(i));
                
                return hasRelevantItems;
            });

            if (activeOrders.length === 0) {
                container.innerHTML = '<div class="py-20 text-center opacity-20"><p class="text-[10px] font-black uppercase tracking-widest">Sin órdenes pendientes</p></div>';
                return;
            }

            container.innerHTML = activeOrders.map(o => {
                const items = (o.items || []).filter(i => currentMode === 'drinks' ? isDrink(i) : isFood(i));
                const isPrep = o.status === 'preparing';
                
                // Fulfillment Icon
                let type = '🍽️ AQUÍ';
                if (o.notes && o.notes.includes('[TYPE: pickup]')) type = '🛍️ LLEVAR';
                if (o.notes && o.notes.includes('[TYPE: delivery]')) type = '🚗 DELIVERY';

                return `
                    <div class="bg-white/5 border border-white/10 rounded-[2rem] p-6 space-y-4 shadow-xl order-card ${isPrep ? 'border-orange-500/30 bg-orange-500/5' : ''}">
                        <div class="flex justify-between items-start">
                            <div class="flex items-center gap-3">
                                <span class="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center font-black text-xl text-gold border border-white/5">#${o.order_number || '---'}</span>
                                <div>
                                    <h2 class="font-black text-sm uppercase truncate max-w-[120px]">${o.customers?.name || 'Invitado'}</h2>
                                    <span class="status-badge text-gold opacity-60">${type}</span>
                                </div>
                            </div>
                            <div class="text-right">
                                <p class="text-[10px] font-black text-white/30">${new Date(o.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                <span class="status-badge ${isPrep ? 'text-orange-500' : 'text-blue-500'} animate-pulse">${o.status.toUpperCase()}</span>
                            </div>
                        </div>

                        <div class="space-y-3 py-2">
                            ${items.map(i => `
                                <div class="flex gap-3">
                                    <span class="font-black text-gold text-sm">${i.qty || i.quantity || 1}x</span>
                                    <div>
                                        <p class="font-bold text-sm uppercase leading-tight">${i.name}</p>
                                        <p class="text-[10px] text-white/40 mt-1 font-medium">${(i.mods || []).map(m => m.name).join(', ')}</p>
                                    </div>
                                </div>
                            `).join('')}
                        </div>

                        <div class="pt-2">
                            ${!isPrep ? 
                                `<button onclick="updateStatus('${o.id}', 'preparing')" class="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-900/20 active:scale-95 transition-all">Empezar</button>` :
                                `<button onclick="updateStatus('${o.id}', '${currentMode === 'drinks' ? 'drinks_ready' : 'food_ready'}')" class="w-full bg-success text-dark py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-green-900/20 active:scale-95 transition-all">Listo</button>`
                            }
                        </div>
                    </div>
                `;
            }).join('');
        }

        async function updateStatus(id, status) {
            try {
                const res = await fetch(\`/api/orders/$\{id\}\`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status })
                });
                if (res.ok) fetchOrders();
            } catch (e) { console.error("KDS Update Error:", e); }
        }
