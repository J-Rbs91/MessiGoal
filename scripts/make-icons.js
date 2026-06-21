'use strict';

// Génère les icônes PNG de la PWA à partir d'un SVG, via Chromium (Playwright).
//   node scripts/make-icons.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'icons');

function svg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="#000000"/>
    <circle cx="256" cy="248" r="150" fill="none" stroke="#edbb00" stroke-width="16"/>
    <text x="256" y="248" font-family="Arial, Helvetica, sans-serif" font-size="190" font-weight="800"
          fill="#edbb00" text-anchor="middle" dominant-baseline="central">10</text>
    <rect x="96" y="430" width="320" height="14" fill="#a50044"/>
    <rect x="120" y="456" width="272" height="10" fill="#004d98"/>
  </svg>`;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'icon.svg'), svg(512), 'utf8');

  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const size of [180, 192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<!doctype html><html><body style="margin:0">${svg(size)}</body></html>`);
    await page.screenshot({ path: path.join(OUT, `icon-${size}.png`), clip: { x: 0, y: 0, width: size, height: size } });
  }
  await browser.close();
  console.log('Icônes générées dans', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
