// test_cali_micro_hubs.js
require('dotenv').config({ path: '.env.local' });
const puppeteer = require('puppeteer');
const app = require('./server');

let server;

function startServer() {
    return new Promise((resolve) => {
        server = app.listen(8089, () => {
            console.log('Local test server running on port 8089');
            resolve();
        });
    });
}

(async () => {
    // 1. Start local server
    await startServer();

    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    try {
        console.log('Navigating to local Cali page...');
        await page.goto('http://localhost:8089/cali', { waitUntil: 'networkidle2' });

        // Wait for locations to load
        console.log('Waiting for locations select options to load...');
        await page.waitForFunction(() => {
            const select = document.getElementById('cust-location');
            return select && select.options.length > 1;
        }, { timeout: 10000 });

        // Print loaded location names
        const locationOptions = await page.evaluate(() => {
            const select = document.getElementById('cust-location');
            return Array.from(select.options).map(o => ({ value: o.value, text: o.text }));
        });
        console.log('Loaded locations in dropdown:', locationOptions);

        // Find "The Ivy Residences (Local Hub)" option
        const ivyOption = locationOptions.find(o => o.text.includes('The Ivy'));
        if (!ivyOption) {
            throw new Error('"The Ivy Residences (Local Hub)" not found in locations list.');
        }
        console.log(`Found option for The Ivy: ID = ${ivyOption.value}`);

        // Verify it is the first choice in select list (at index 1, right after placeholder at 0)
        if (locationOptions[1].value !== ivyOption.value) {
            throw new Error(`The Ivy is not the first option. First is: ${locationOptions[1].text}`);
        }
        console.log('✅ Success! The Ivy Residences is the first option in the dropdown list.');

        // Add 1 bundle of 5 to cart to ensure tracker card renders details
        console.log('Adding a bundle of 5 to cart...');
        // We evaluate a click on the Bundle of 5 package card (typically the third package) or mock cart update
        await page.evaluate(() => {
            // Find "Bundle of 5" button or product
            const cards = Array.from(document.querySelectorAll('.border-white\\/5'));
            const bundleCard = cards.find(c => c.innerText.includes('Bundle of 5'));
            if (bundleCard) {
                // Find and click the Add to Cart or similar button
                const btn = bundleCard.querySelector('button');
                if (btn) btn.click();
            } else {
                // Fallback direct mock addition
                cart.push({
                    id: "bundle_5",
                    name: "Bundle of 5",
                    bottles: 5,
                    qty: 1,
                    unitPrice: 25.00,
                    total: 25.00,
                    selections: [
                        { flavor: "Dirty Chai", milk: "Regular" },
                        { flavor: "Oreo Supreme", milk: "Regular" },
                        { flavor: "Caramel Latte", milk: "Regular" },
                        { flavor: "French Vanilla", milk: "Regular" },
                        { flavor: "Vanilla Latte", milk: "Regular" }
                    ]
                });
                updateCartUI();
            }
        });

        // Select the Ivy Hub option
        console.log('Selecting The Ivy Hub dropdown option...');
        await page.select('#cust-location', ivyOption.value);
        
        // Wait brief moment for DOM transition
        await new Promise(r => setTimeout(r, 1000));

        // Retrieve notes field state and tracker details
        const uiState = await page.evaluate(() => {
            const notes = document.getElementById('cust-notes');
            const tracker = document.getElementById('hub-tracker-card');
            const trackerTitle = document.getElementById('hub-tracker-title');
            const trackerProgress = document.getElementById('hub-tracker-progress-text');
            const trackerMsg = document.getElementById('hub-tracker-msg');

            return {
                notesVisible: notes && !notes.classList.contains('hidden'),
                notesPlaceholder: notes ? notes.placeholder : '',
                trackerVisible: tracker && !tracker.classList.contains('hidden'),
                trackerTitle: trackerTitle ? trackerTitle.innerText : '',
                trackerProgress: trackerProgress ? trackerProgress.innerText : '',
                trackerMsg: trackerMsg ? trackerMsg.innerText : ''
            };
        });

        console.log('Cali UI State with Ivy selected:', uiState);

        // Verification assertions
        if (!uiState.notesVisible) throw new Error('Notes field is not visible when Ivy selected.');
        if (uiState.notesPlaceholder !== 'Specify Ivy 1/2 + Apt #') {
            throw new Error(`Unexpected notes placeholder: ${uiState.notesPlaceholder}`);
        }
        if (uiState.trackerVisible) {
            throw new Error('Collective tracker progress card should be hidden for Ivy Residences.');
        }
        console.log('✅ Success! Tracker card is hidden for Ivy Residences (unrestricted free delivery).');

        // Verify Espresso Selection elements
        console.log('Opening package configuration modal in test...');
        await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll('div[onclick^="openStep2"]'));
            if (cards.length > 0) {
                cards[0].click();
            } else {
                console.error("No product cards found to open step 2.");
            }
        });
        await new Promise(r => setTimeout(r, 1000));

        // Get espresso button texts and active states
        const espressoButtons = await page.evaluate(() => {
            const label = Array.from(document.querySelectorAll('label')).find(l => l.innerText.includes('ESPRESSO LEVEL'));
            if (!label) return [];
            const container = label.nextElementSibling;
            if (!container) return [];
            const buttons = Array.from(container.querySelectorAll('button'));
            return buttons.map(b => b.innerText.replace(/\n/g, ' '));
        });
        console.log('Rendered Espresso Level buttons:', espressoButtons);
        
        // Assert we have the standard 3 levels
        if (espressoButtons.length !== 3) {
            throw new Error(`Expected 3 espresso levels, got ${espressoButtons.length}`);
        }
        
        // Check if one of them is "Standard"
        if (!espressoButtons.some(t => t.includes('Standard'))) {
            throw new Error('Espresso level buttons must include Standard');
        }
        console.log('✅ Success! Espresso strength levels are visible and customizable.');

        console.log('✅ Automated test successfully completed without errors!');
    } catch (e) {
        console.error('❌ Test failed:', e);
    } finally {
        await browser.close();
        if (server) {
            server.close(() => {
                console.log('Local test server stopped.');
            });
        }
    }
})();
