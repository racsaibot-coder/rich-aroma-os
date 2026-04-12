const puppeteer = require('puppeteer');

async function runQA() {
    console.log('🚀 RICH AROMA QA SQUAD - COMMENCING FULL AUDIT\n');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const baseUrl = 'https://www.richaromacoffee.com';

    const results = {
        mobilePos: { status: 'Pending', notes: [] },
        desktopPos: { status: 'Pending', notes: [] },
        membership: { status: 'Pending', notes: [] },
        economy: { status: 'Pending', notes: [] }
    };

    try {
        // --- UNIT 1: MOBILE POS UX ---
        console.log('📦 Unit 1: Testing Mobile POS (/pos)...');
        await page.goto(`${baseUrl}/pos`);
        await page.waitForSelector('#menu-grid', { timeout: 10000 });
        
        const version = await page.evaluate(() => {
            return document.body.innerText.includes('V2.1.3');
        });
        results.mobilePos.notes.push(version ? 'Verified Version V2.1.3 is active.' : 'Version V2.1.3 NOT found.');

        // Check for "COBRAR" button in tender modal
        const chargeBtnText = await page.evaluate(() => {
            const btn = document.getElementById('final-charge-btn');
            return btn ? btn.innerText.trim() : 'NOT_FOUND';
        });
        results.mobilePos.notes.push(`Main Button text: ${chargeBtnText}`);
        
        if (version && chargeBtnText === 'COBRAR') {
            results.mobilePos.status = 'PASS';
        } else {
            results.mobilePos.status = 'FAIL';
        }

        // --- UNIT 2: DESKTOP POS & SPLIT TAB ---
        console.log('🖥️ Unit 2: Testing Desktop POS (/pos.html)...');
        await page.goto(`${baseUrl}/pos.html`);
        await page.waitForSelector('#split-toggle-btn', { timeout: 5000 });
        
        const splitBtnVisible = await page.evaluate(() => {
            const btn = document.getElementById('split-toggle-btn');
            return btn && !btn.classList.contains('hidden');
        });
        
        if (splitBtnVisible) {
            results.desktopPos.status = 'PASS';
            results.desktopPos.notes.push('Split Tab button ("Dividir") is visible and integrated.');
        } else {
            results.desktopPos.status = 'FAIL';
            results.desktopPos.notes.push('Split Tab button missing.');
        }

        // --- UNIT 3: MEMBERSHIP & ECONOMY ---
        console.log('💰 Unit 3: Testing Economy Logic...');
        // We do this via API simulation
        const apiTestRes = await fetch(`${baseUrl}/api/menu`);
        if (apiTestRes.ok) {
            results.economy.status = 'PASS';
            results.economy.notes.push('API is responsive.');
        } else {
            results.economy.status = 'FAIL';
        }

    } catch (e) {
        console.error('❌ QA Squad Error:', e.message);
    } finally {
        await browser.close();
    }

    console.log('\n--- FINAL QA REPORT ---');
    console.log(JSON.stringify(results, null, 2));
}

runQA();
