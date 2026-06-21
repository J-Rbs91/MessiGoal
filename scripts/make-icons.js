'use strict';

// Génère le favicon + les icônes PNG de la PWA : un ballon de foot classique
// (⚽, premier élément du README) sur une tuile vert nuit (palette « Pelouse
// Nocturne »). Surfaces plates, aucun dégradé. Rendu via Chromium (Playwright).
//   node scripts/make-icons.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'icons');

// Palette « Pelouse Nocturne »
const PITCH = '#0A1410';
const BORDER = '#25382B';
const BALL = '#F2F5F0';
const SEAM = '#16221B';

function ballSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
    <defs><clipPath id="ball"><circle cx="256" cy="256" r="196"/></clipPath></defs>
    <rect width="512" height="512" rx="96" fill="${PITCH}"/>
    <rect x="8" y="8" width="496" height="496" rx="90" fill="none" stroke="${BORDER}" stroke-width="3"/>
    <circle cx="256" cy="256" r="196" fill="${BALL}"/>
    <g clip-path="url(#ball)">
      <g stroke="${SEAM}" stroke-width="11" stroke-linecap="round">
        <line x1="256.0" y1="196.0" x2="256.0" y2="60.0"/>
        <line x1="313.1" y1="237.5" x2="442.4" y2="195.4"/>
        <line x1="291.3" y1="304.5" x2="371.2" y2="414.6"/>
        <line x1="220.7" y1="304.5" x2="140.8" y2="414.6"/>
        <line x1="198.9" y1="237.5" x2="69.6" y2="195.4"/>
      </g>
      <g fill="${SEAM}" stroke="${PITCH}" stroke-width="6" stroke-linejoin="round">
        <polygon points="308.9,183.2 287.1,116.1 344.2,74.6 401.2,116.1 379.4,183.2"/>
        <polygon points="341.6,283.8 398.7,242.4 455.7,283.8 433.9,350.9 363.4,350.9"/>
        <polygon points="256.0,346.0 313.1,387.5 291.3,454.5 220.7,454.5 198.9,387.5"/>
        <polygon points="170.4,283.8 148.6,350.9 78.1,350.9 56.3,283.8 113.3,242.4"/>
        <polygon points="203.1,183.2 132.6,183.2 110.8,116.1 167.8,74.6 224.9,116.1"/>
        <polygon points="256.0,194.0 315.0,236.8 292.4,306.2 219.6,306.2 197.0,236.8"/>
      </g>
    </g>
    <circle cx="256" cy="256" r="196" fill="none" stroke="${SEAM}" stroke-width="6"/>
  </svg>`;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'icon.svg'), ballSvg(512), 'utf8');

  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const size of [180, 192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<!doctype html><html><body style="margin:0">${ballSvg(size)}</body></html>`);
    await page.screenshot({ path: path.join(OUT, `icon-${size}.png`), clip: { x: 0, y: 0, width: size, height: size } });
  }
  await browser.close();
  console.log('Icônes (ballon de foot · pelouse nocturne) générées dans', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
