import { chromium } from 'playwright';

async function verifyLive() {
  console.log('🚀 Testing live Vercel deployment: https://technova-code-sprint.vercel.app ...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('Visiting live verify page: https://technova-code-sprint.vercel.app/verify/TNV-CS-2026-0000-TEST');
    await page.goto('https://technova-code-sprint.vercel.app/verify/TNV-CS-2026-0000-TEST', { waitUntil: 'domcontentloaded' });
    
    // Check that body is not blank
    const text = await page.textContent('body');
    if (!text || text.trim().length === 0) {
      throw new Error('Live page is blank!');
    }

    await page.waitForSelector('text=Demo / Verification Test Student', { timeout: 15000 });
    console.log('✅ LIVE VERIFICATION SUCCESSFUL: Certificate rendered cleanly with student name!');

    console.log('Visiting non-existent certificate ID on live site...');
    await page.goto('https://technova-code-sprint.vercel.app/verify/CERT-INVALID-RANDOM-404', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    console.log('Full body text:', body);
    await page.waitForSelector('text=Certificate not found', { timeout: 15000 });
    console.log('✅ LIVE NOT-FOUND FALLBACK SUCCESSFUL: "Certificate not found" card rendered without white screen!');
  } catch (err) {
    console.error('❌ Live check failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

verifyLive();
