import { chromium } from 'playwright';

async function runVerification() {
  console.log('🚀 Starting end-to-end browser verification of fixes...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.message);
  });

  try {
    // TEST 1: Test valid certificate lookup
    console.log('\n--- TEST 1: Visiting /verify/TNV-CS-2026-0000-TEST ---');
    await page.goto('http://localhost:5173/verify/TNV-CS-2026-0000-TEST', { waitUntil: 'domcontentloaded' });
    
    // Check that page is not blank
    const bodyText = await page.textContent('body');
    if (!bodyText || bodyText.trim().length === 0) {
      throw new Error('Test 1 Failed: Page rendered completely blank!');
    }

    // Wait for verified badge or student name
    await page.waitForSelector('text=Demo / Verification Test Student', { timeout: 8000 });
    console.log('✅ Test 1 Passed: Certificate found and rendered successfully with student name!');

    // TEST 2: Test non-existent certificate lookup fallback
    console.log('\n--- TEST 2: Visiting /verify/NON-EXISTENT-CERT ---');
    await page.goto('http://localhost:5173/verify/NON-EXISTENT-CERT', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Certificate Not Found', { timeout: 8000 });
    console.log('✅ Test 2 Passed: Non-existent certificate rendered "Certificate Not Found" fallback UI without blank screen!');

    // TEST 3: Admin login flow and session persistence
    console.log('\n--- TEST 3: Admin Login & Session Persistence ---');
    const adminPage = await context.newPage();
    adminPage.on('console', msg => console.log('  [Browser]', msg.text()));
    adminPage.on('pageerror', err => console.log('  [Browser PageError]', err.message));
    
    await adminPage.goto('http://localhost:5173/admin/login', { waitUntil: 'domcontentloaded' });
    await adminPage.waitForTimeout(1200);
    
    // Fill credentials
    const emailInput = adminPage.locator('input[type="email"], input[placeholder*="email" i], input[name="email"]');
    await emailInput.fill('technicalteamsvit@gmail.com');

    const passInput = adminPage.locator('input[type="password"]');
    await passInput.fill('BuildLearn@SVIT#9Q');

    const submitBtn = adminPage.locator('button:has-text("Sign In as Administrator"), button[type="submit"]');
    await submitBtn.click();

    // Wait for transition to /admin
    await adminPage.waitForURL('**/admin', { timeout: 10000 });
    console.log('✅ Logged in successfully, transitioned to /admin');

    // Wait for admin dashboard content
    await adminPage.waitForSelector('text=Authorized Administrator', { timeout: 10000 });
    console.log('✅ Admin dashboard loaded!');

    // Test session persistence on reload
    console.log('Testing session persistence after browser page refresh...');
    await adminPage.reload({ waitUntil: 'domcontentloaded' });
    
    // Verify we remain on /admin and not bounced to /admin/login
    await adminPage.waitForTimeout(2000);
    const currentUrl = adminPage.url();
    if (currentUrl.includes('/admin/login')) {
      throw new Error('Test 3 Failed: Page refresh bounced admin back to /admin/login!');
    }
    console.log('✅ Test 3 Passed: Admin session persisted across page reload at URL:', currentUrl);

    console.log('\n🎉 ALL 3 VERIFICATION TESTS PASSED PERFECTLY!');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    if (consoleErrors.length > 0) {
      console.log('\nConsole errors detected during run:');
      consoleErrors.forEach(e => console.log('  -', e));
    }
    await browser.close();
  }
}

runVerification();
