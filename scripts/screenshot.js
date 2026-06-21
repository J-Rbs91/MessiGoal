'use strict';

// Capture d'écran du site via Playwright.
// Usage : node scripts/screenshot.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = path.join(__dirname, '..', 'screenshots');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  // --- Desktop : pleine page ---
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktop.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#goals-body tr');
  await page.screenshot({ path: path.join(OUT, '01-accueil-pleine-page.png'), fullPage: true });
  await page.screenshot({ path: path.join(OUT, '02-accueil-viewport.png') });

  // --- Modale d'ajout ---
  await page.click('#btn-add');
  await page.waitForSelector('#goal-dialog[open]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, '03-modale-ajout.png') });
  await page.keyboard.press('Escape');

  // --- Mobile ---
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const mpage = await mobile.newPage();
  await mpage.goto(BASE, { waitUntil: 'networkidle' });
  await mpage.waitForSelector('#goals-body tr');
  await mpage.screenshot({ path: path.join(OUT, '04-mobile.png'), fullPage: true });

  await browser.close();
  console.log('Captures enregistrées dans', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
