const fs = require('fs');
const orderPath = './public/order.html';
let orderHtml = fs.readFileSync(orderPath, 'utf8');

const oldText = `            currentMods = {};
            const container = document.getElementById('mod-dynamic-container');
            let html = '';

            relevantGroups.forEach(groupId => {
                const group = modGroups.find(g => g.id === groupId);
                if (!group) return;
                const options = modOptions.filter(o => o.group_id === groupId);
                const defaultOpt = options.find(o => o.is_default);
                currentMods[groupId] = defaultOpt ? [defaultOpt.id] : [];

                html += \`<div class="mb-6"><h3 class="text-white/60 uppercase text-xs tracking-widest font-bold mb-3">\${group.name}</h3><div class="grid grid-cols-2 gap-3">\`;`;

const newText = `            currentMods = {};
            
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

                html += \`<div class="mb-6"><h3 class="text-white/60 uppercase text-xs tracking-widest font-bold mb-3">\${group.name}</h3><div class="grid grid-cols-2 gap-3">\`;`;

if (orderHtml.includes(oldText)) {
    orderHtml = orderHtml.replace(oldText, newText);
    fs.writeFileSync(orderPath, orderHtml, 'utf8');
    console.log("Patched order.html");
} else {
    console.log("Could not find exact text in order.html");
}
