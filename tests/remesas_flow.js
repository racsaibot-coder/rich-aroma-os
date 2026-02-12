const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    console.log('🚀 Starting Remesas Flow Test...');
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    
    // Set viewport to mobile
    await page.setViewport({ width: 375, height: 812 });

    try {
        // 1. Navigate to Home
        console.log('📍 Navigating to Home...');
        await page.goto('http://localhost:8083', { waitUntil: 'networkidle0' });

        // 2. Click Remesas
        console.log('👇 Clicking Remesas module...');
        // Find element containing text 'Remesas' or by class
        // The button has onclick="window.location.href='/remesas.html'"
        await page.evaluate(() => {
            const modules = Array.from(document.querySelectorAll('.module'));
            const btn = modules.find(m => m.textContent.includes('Remesas'));
            if (btn) btn.click();
        });
        
        await page.waitForNavigation();
        console.log('✅ On Remesas Page');

        // 3. Verify Rate
        const rateEl = await page.waitForSelector('#displayRate');
        const rateText = await page.evaluate(el => el.textContent, rateEl);
        console.log(`💵 Current Rate: ${rateText}`);

        // 4. Update Rate (Admin)
        console.log('✏️ Updating Rate...');
        await page.click('.rate-edit'); // Click pencil
        await page.waitForSelector('#rateModal.active');
        await page.type('#newRateInput', '0'); // Clear somehow? standard type appends. 
        // Better to set value via eval for clean test
        await page.evaluate(() => document.getElementById('newRateInput').value = '24.5');
        await page.click('#rateModal .btn-primary'); // Save
        // Wait for rate to update (fetch)
        await new Promise(r => setTimeout(r, 1000));

        // 5. Transaction: Exchange
        console.log('💱 Performing Exchange (100 USD -> HNL)...');
        
        // Handle Dialogs
        page.on('dialog', async dialog => {
            console.log(`💬 Alert: ${dialog.message()}`);
            await dialog.accept();
        });

        await page.type('#usdInput', '100');
        const hnlText = await page.evaluate(() => document.getElementById('hnlOutput').textContent);
        console.log(`   Expected Output displayed: ${hnlText}`);
        
        await page.click('.btn-primary'); // Confirmar Cambio
        await new Promise(r => setTimeout(r, 1000)); // Wait for reload/history

        // 6. Transaction: Payout
        console.log('💸 Performing Payout (50 USD)...');
        await page.evaluate(() => switchTab('payout'));
        await page.type('#remesaCode', 'TEST-REF-999');
        await page.type('#payoutUsd', '50');
        
        // Click "Procesar Pago" (it's the .btn-secondary in the active view)
        // Need to target specific button. It has text "Procesar Pago"
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const btn = btns.find(b => b.textContent.includes('Procesar Pago'));
            if (btn) btn.click();
        });
        await new Promise(r => setTimeout(r, 1000));

        // 7. Verify History
        console.log('📜 Verifying History...');
        const transactions = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.tx-item')).map(el => ({
                type: el.querySelector('.tx-type').textContent,
                amount: el.querySelector('.tx-amount').textContent
            }));
        });
        
        console.log('   Recent Transactions found:', transactions.length);
        transactions.forEach(t => console.log(`   - ${t.type}: ${t.amount}`));

        if (transactions.length >= 2) {
            console.log('✅ Flow Verified Successfully!');
        } else {
            console.error('❌ Missing transactions in history');
            process.exit(1);
        }

    } catch (e) {
        console.error('❌ Test Failed:', e);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
