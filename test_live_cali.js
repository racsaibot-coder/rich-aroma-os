// test_live_cali.js
const puppeteer = require('puppeteer');

(async () => {
    console.log('Launching browser to check live production...');
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    try {
        console.log('Navigating to live Cali page...');
        await page.goto('https://www.richaromacoffee.com/cali', { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for locations to load
        console.log('Waiting for dropdown locations to load...');
        await page.waitForFunction(() => {
            const select = document.getElementById('cust-location');
            return select && select.options.length > 1;
        }, { timeout: 15000 });

        // Print loaded options
        const locations = await page.evaluate(() => {
            const select = document.getElementById('cust-location');
            return Array.from(select.options).map(o => ({ value: o.value, text: o.text }));
        });
        console.log('Production dropdown locations:', locations.map(o => o.text));

        const ivyOption = locations.find(o => o.text.includes('The Ivy Residences'));
        if (ivyOption) {
            if (ivyOption.text.includes('Chino')) {
                console.log('✅ Success! The Ivy Residences city is correctly listed as Chino!');
            } else {
                console.log(`❌ Failure: Ivy Residences city is wrong: ${ivyOption.text}`);
            }
            if (locations[1].value === ivyOption.value) {
                console.log('✅ Success! The Ivy Residences is sorted to the top (first option)!');
            } else {
                console.log(`❌ Failure: The Ivy is not the first option. First is: ${locations[1].text}`);
            }
            
            // Check tracker visibility for Ivy
            console.log('Selecting The Ivy option to verify tracker visibility...');
            await page.select('#cust-location', ivyOption.value);
            await new Promise(r => setTimeout(r, 1000));
            const trackerVisible = await page.evaluate(() => {
                const tracker = document.getElementById('hub-tracker-card');
                return tracker && !tracker.classList.contains('hidden');
            });
            if (trackerVisible) {
                console.log('❌ Failure: Tracker card should be hidden for Ivy Residences.');
            } else {
                console.log('✅ Success! Tracker card is correctly hidden for Ivy Residences (no limit).');
            }
        } else {
            console.log('❌ Failure: The Ivy Residences is missing in production dropdown.');
        }

        const fontanaOption = locations.find(o => o.text.includes('Kaiser Fontana'));
        if (fontanaOption) {
            console.log('✅ Success! Kaiser Fontana is live in production!');
        } else {
            console.log('❌ Failure: Kaiser Fontana is missing.');
        }

        // Find and click the "Classic Black Americano" card to customize
        console.log('Opening customization modal for Classic Black Americano...');
        await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll('div[onclick^="openStep2"]'));
            const blackCard = cards.find(c => c.innerText.toLowerCase().includes('black') || c.innerText.toLowerCase().includes('americano'));
            if (blackCard) {
                blackCard.click();
            } else {
                console.error("Could not find Classic Black Americano product card");
                if (cards[0]) cards[0].click();
            }
        });

        await new Promise(r => setTimeout(r, 1000));

        // Check if "Classic Black" is rendered and selected by default
        const hasClassicBlackSelection = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const blackBtn = buttons.find(b => b.innerText === 'Classic Black');
            if (!blackBtn) return { present: false, active: false };
            const isActive = blackBtn.classList.contains('border-brand-gold') && blackBtn.classList.contains('bg-brand-gold/5');
            return { present: true, active: isActive };
        });

        if (hasClassicBlackSelection.present) {
            console.log('✅ Success! Classic Black is available in the flavor selector.');
            if (hasClassicBlackSelection.active) {
                console.log('✅ Success! Classic Black is SELECTED by default for Classic Black Americano product!');
            } else {
                console.log('❌ Failure: Classic Black is not selected by default.');
            }
        } else {
            console.log('❌ Failure: Classic Black option is missing.');
        }

    } catch (e) {
        console.error('❌ Test failed:', e);
    } finally {
        await browser.close();
    }
})();
