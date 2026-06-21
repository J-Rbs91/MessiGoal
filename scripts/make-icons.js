'use strict';

// Génère le favicon + les icônes PNG de la PWA : un ballon de foot aux
// couleurs du Barça (bleu / grenat). Rendu via Chromium (Playwright).
//   node scripts/make-icons.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'icons');

const BG = '#000000';
const BALL = '#f5f5f5';
const BLAU = '#004d98';
const GRANA = '#a50044';
const SEAM = '#0b1c2c';

// Points d'un pentagone régulier (chaîne "x,y x,y …")
function pentagon(cx, cy, r, rotDeg = 0) {
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const a = ((-90 + rotDeg + i * 72) * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

function ballSvg(size) {
  const c = 256, R = 196;

  // Pentagones extérieurs : au milieu des arêtes du pentagone central,
  // près du bord, pointant vers le centre et découpés par le ballon.
  const outerAngles = [-54, 18, 90, 162, 234];
  const outer = outerAngles.map((deg) => {
    const a = (deg * Math.PI) / 180;
    return { x: c + 150 * Math.cos(a), y: c + 150 * Math.sin(a), rot: deg - 90 };
  });

  // Coutures : des sommets du pentagone central vers le bord (entre les pentagones)
  const seams = [];
  for (let i = 0; i < 5; i++) {
    const a = ((-90 + i * 72) * Math.PI) / 180;
    seams.push(
      `<line x1="${(c + 60 * Math.cos(a)).toFixed(1)}" y1="${(c + 60 * Math.sin(a)).toFixed(1)}" ` +
      `x2="${(c + R * Math.cos(a)).toFixed(1)}" y2="${(c + R * Math.sin(a)).toFixed(1)}" ` +
      `stroke="${SEAM}" stroke-width="11" stroke-linecap="round"/>`
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
    <defs><clipPath id="ball"><circle cx="${c}" cy="${c}" r="${R}"/></clipPath></defs>
    <rect width="512" height="512" fill="${BG}"/>
    <circle cx="${c}" cy="${c}" r="${R}" fill="${BALL}"/>
    <g clip-path="url(#ball)">
      ${seams.join('\n      ')}
      ${outer.map((o) => `<polygon points="${pentagon(o.x, o.y, 60, o.rot)}" fill="${BLAU}" stroke="${SEAM}" stroke-width="6" stroke-linejoin="round"/>`).join('\n      ')}
      <polygon points="${pentagon(c, c, 62, 0)}" fill="${GRANA}" stroke="${SEAM}" stroke-width="6" stroke-linejoin="round"/>
    </g>
    <circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="${BLAU}" stroke-width="10"/>
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
  console.log('Icônes (ballon bleu/grenat) générées dans', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
