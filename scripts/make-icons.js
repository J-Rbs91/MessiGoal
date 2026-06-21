'use strict';

// Génère le favicon + les icônes PNG de la PWA selon le design system
// « The Goal Archive » : stade de nuit, grille de but/filet et trajectoire
// de tir dorée vers la lucarne. Rendu via Chromium (Playwright).
//   node scripts/make-icons.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'icons');

// Palette « Night Stadium » + accent Goal Gold
const NAVY_HI = '#102640';
const NAVY = '#0B1B2F';
const NIGHT = '#07111F';
const GRID = '#23415F';
const GOLD = '#F2C14E';
const WHITE = '#F4F7FA';

function archiveSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
    <defs>
      <radialGradient id="sky" cx="50%" cy="0%" r="90%">
        <stop offset="0%" stop-color="${NAVY_HI}"/>
        <stop offset="60%" stop-color="${NAVY}"/>
        <stop offset="100%" stop-color="${NIGHT}"/>
      </radialGradient>
    </defs>
    <rect width="512" height="512" rx="96" fill="url(#sky)"/>
    <rect x="8" y="8" width="496" height="496" rx="90" fill="none" stroke="${GRID}" stroke-width="3"/>
    <g stroke="${GRID}" stroke-width="3" opacity="0.85">
      <rect x="120" y="150" width="272" height="212" rx="10" fill="none"/>
      <line x1="120" y1="203" x2="392" y2="203"/>
      <line x1="120" y1="256" x2="392" y2="256"/>
      <line x1="120" y1="309" x2="392" y2="309"/>
      <line x1="188" y1="150" x2="188" y2="362"/>
      <line x1="256" y1="150" x2="256" y2="362"/>
      <line x1="324" y1="150" x2="324" y2="362"/>
    </g>
    <path d="M104 408 C 200 360, 300 250, 372 178" fill="none"
          stroke="${GOLD}" stroke-width="14" stroke-linecap="round"/>
    <circle cx="372" cy="178" r="18" fill="${GOLD}"/>
    <circle cx="372" cy="178" r="30" fill="none" stroke="${GOLD}" stroke-width="3" opacity="0.4"/>
    <circle cx="104" cy="408" r="20" fill="${WHITE}"/>
  </svg>`;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'icon.svg'), archiveSvg(512), 'utf8');

  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const size of [180, 192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<!doctype html><html><body style="margin:0">${archiveSvg(size)}</body></html>`);
    await page.screenshot({ path: path.join(OUT, `icon-${size}.png`), clip: { x: 0, y: 0, width: size, height: size } });
  }
  await browser.close();
  console.log('Icônes « The Goal Archive » générées dans', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
