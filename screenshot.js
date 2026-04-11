const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log('Taking screenshot of homepage...');
  await page.goto('https://www.richaromacoffee.com', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: 'homepage.png' });

  console.log('Taking screenshot of order page...');
  await page.goto('https://www.richaromacoffee.com/order', { waitUntil: 'networkidle2' });
  // Wait for "Cargando menú..." to disappear and some menu item to appear
  await page.waitForFunction(() => !document.body.innerText.includes('Cargando menú'), { timeout: 15000 }).catch(() => console.log('Timeout waiting for menu to load'));
  await page.screenshot({ path: 'order_menu.png' });

  console.log('Taking screenshot of Cali side...');
  await page.goto('https://www.richaromacoffee.com/cali', { waitUntil: 'networkidle2' }).catch(() => console.log('Cali page failed to load'));
  // Wait for "Connecting to artisan database..." to disappear
  await page.waitForFunction(() => !document.body.innerText.includes('Connecting to artisan database'), { timeout: 15000 }).catch(() => console.log('Timeout waiting for Cali menu to load'));
  await page.screenshot({ path: 'cali_menu.png' });

  await browser.close();
  console.log('Screenshots taken.');
})();
