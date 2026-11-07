import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function inspectProduction() {
  const diagDir = path.resolve('video-production/diagnostics');
  fs.mkdirSync(diagDir, { recursive: true });

  const report = {
    timestamp: new Date().toISOString(),
    apiHealth: null,
    apiPublicCampaign: null,
    landingPage: {},
    adminLoginPage: {},
  };

  // 1. Check API Health
  try {
    const res = await fetch('https://quiz-vibe-ai.vercel.app/api/health');
    report.apiHealth = {
      status: res.status,
      ok: res.ok,
      data: await res.json(),
    };
  } catch (err) {
    report.apiHealth = { error: err.message };
  }

  // 2. Check Public Active Campaign API
  try {
    const res = await fetch('https://quiz-vibe-ai.vercel.app/api/public/campaign?slug=active');
    report.apiPublicCampaign = {
      status: res.status,
      ok: res.ok,
      data: await res.json(),
    };
  } catch (err) {
    report.apiPublicCampaign = { error: err.message };
  }

  // 3. Inspect Browser UI (Read-Only)
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  // Route 1: Public landing page
  try {
    console.log('Navigating to https://quiz-vibe-ai.vercel.app/...');
    await page.goto('https://quiz-vibe-ai.vercel.app/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    const title = await page.title();
    const h1 = await page.textContent('h1').catch(() => null);
    const badges = await page.$$eval('[class*="badge"], [class*="Badge"]', els => els.map(e => e.textContent.trim())).catch(() => []);
    const buttons = await page.$$eval('button', els => els.map(e => e.textContent.trim())).catch(() => []);
    const bodySnippet = await page.$eval('body', el => el.innerText.slice(0, 500)).catch(() => '');

    const screenshotPath = path.join(diagDir, 'prod-landing.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });

    report.landingPage = {
      url: page.url(),
      title,
      h1,
      badges,
      buttons,
      bodySnippet,
      screenshot: screenshotPath,
    };
  } catch (err) {
    report.landingPage = { error: err.message };
  }

  // Route 2: Admin Login page
  try {
    console.log('Navigating to https://quiz-vibe-ai.vercel.app/admin/login...');
    await page.goto('https://quiz-vibe-ai.vercel.app/admin/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    const title = await page.title();
    const h1 = await page.textContent('h1').catch(() => null);
    const buttons = await page.$$eval('button', els => els.map(e => e.textContent.trim())).catch(() => []);
    const bodySnippet = await page.$eval('body', el => el.innerText.slice(0, 500)).catch(() => '');

    const screenshotPath = path.join(diagDir, 'prod-admin-login.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });

    report.adminLoginPage = {
      url: page.url(),
      title,
      h1,
      buttons,
      bodySnippet,
      screenshot: screenshotPath,
    };
  } catch (err) {
    report.adminLoginPage = { error: err.message };
  }

  await browser.close();

  const reportPath = path.join(diagDir, 'prod-inspection-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log('Inspection complete. Report saved to:', reportPath);
}

inspectProduction().catch(console.error);

