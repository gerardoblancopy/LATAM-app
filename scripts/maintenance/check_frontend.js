const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();

        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

        await page.goto('http://localhost:3005', { waitUntil: 'networkidle2' });
        console.log('Page loaded');
        await browser.close();
    } catch (e) {
        console.error('Puppeteer failed:', e.message);
    }
})();
