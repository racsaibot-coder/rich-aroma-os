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
        const locationOptions = await page.evaluate(() => {
            const select = document.getElementById('cust-location');
            return Array.from(select.options).map(o => o.text);
        });
        console.log('Production dropdown locations:', locationOptions);

        const ivyOption = locationOptions.find(text => text.includes('The Ivy Residences'));
        if (ivyOption) {
            console.log('✅ Success! The Ivy Residences is live in production!');
        } else {
            console.log('❌ Failure: The Ivy Residences is missing in production dropdown.');
        }

        const fontanaOption = locationOptions.find(text => text.includes('Kaiser Fontana (Sister'));
        if (fontanaOption) {
            console.log('✅ Success! Kaiser Fontana (Sister\'s Office) is live in production!');
        } else {
            console.log('❌ Failure: Kaiser Fontana (Sister\'s Office) is missing.');
        }

    } catch (e) {
        console.error('❌ Test failed:', e);
    } finally {
        await browser.close();
    }
})();
