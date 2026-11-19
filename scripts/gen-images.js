// npm run gen:images
// Generates one clean studio-style product illustration per catalog item into
// frontend/public/images/products/<id>.svg. No API key, no binary downloads,
// no remote URLs. The style is identical for every item (dark gradient stage,
// soft glow, top-left key light) so the storefront grid looks uniform.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const DATA_FILE = path.resolve(__dirname, '../frontend/src/data/products.js');
const OUT_DIR = path.resolve(__dirname, '../frontend/public/images/products');

function keys() {
  const cells = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 14; col += 1) {
      const x = 124 + col * 25;
      const y = 194 + row * 26;
      const lit = (row + col) % 9 === 0;
      cells.push(
        `<rect x="${x}" y="${y}" width="19" height="19" rx="3" fill="${lit ? '#06b6d4' : '#1e293b'}" ${lit ? 'opacity="0.8"' : ''}/>`
      );
    }
  }
  return cells.join('');
}

function shapeFor(category) {
  switch (category) {
    case 'Gaming PCs':
      return `
        <rect x="205" y="108" width="190" height="248" rx="14" fill="#111a2e" stroke="#334155" stroke-width="2"/>
        <rect x="220" y="123" width="160" height="218" rx="8" fill="#0b1424" stroke="#06b6d4" stroke-opacity="0.45"/>
        <path d="M226 336 L302 126 L342 126 L266 336 Z" fill="#22d3ee" opacity="0.06"/>
        <circle cx="272" cy="180" r="27" fill="none" stroke="#06b6d4" stroke-width="3" opacity="0.85"/>
        <circle cx="272" cy="180" r="8" fill="#06b6d4" opacity="0.45"/>
        <circle cx="272" cy="252" r="27" fill="none" stroke="#6366f1" stroke-width="3" opacity="0.85"/>
        <circle cx="272" cy="252" r="8" fill="#6366f1" opacity="0.45"/>
        <rect x="230" y="320" width="140" height="4" rx="2" fill="url(#accent)"/>
        <rect x="216" y="356" width="22" height="8" rx="2" fill="#1e293b"/>
        <rect x="362" y="356" width="22" height="8" rx="2" fill="#1e293b"/>`;
    case 'Laptops':
      return `
        <path d="M180 138 h240 a8 8 0 0 1 8 8 v152 h-256 v-152 a8 8 0 0 1 8 -8 z" fill="#0b1424" stroke="#334155" stroke-width="2"/>
        <rect x="192" y="150" width="216" height="136" rx="4" fill="#06101f" stroke="#06b6d4" stroke-opacity="0.45"/>
        <path d="M192 150 h216 v136 h-216 z" fill="url(#accent)" opacity="0.10"/>
        <rect x="160" y="298" width="280" height="14" rx="7" fill="#1e293b" stroke="#334155"/>
        <rect x="270" y="298" width="60" height="4" rx="2" fill="#0f172a"/>`;
    case 'Monitors':
      return `
        <rect x="120" y="108" width="360" height="212" rx="10" fill="#0b1424" stroke="#334155" stroke-width="2"/>
        <rect x="132" y="120" width="336" height="188" rx="5" fill="#06101f" stroke="#06b6d4" stroke-opacity="0.45"/>
        <path d="M132 308 L468 122 L468 170 L200 308 Z" fill="url(#accent)" opacity="0.09"/>
        <rect x="285" y="320" width="30" height="36" fill="#1e293b"/>
        <path d="M250 356 h100 l16 10 h-132 z" fill="#1e293b" stroke="#334155"/>`;
    case 'Keyboards':
      return `
        <rect x="110" y="180" width="380" height="120" rx="12" fill="#111a2e" stroke="#334155" stroke-width="2"/>
        ${keys()}
        <rect x="150" y="298" width="300" height="3" rx="1.5" fill="url(#accent)" opacity="0.6"/>`;
    case 'Mice':
      return `
        <g transform="translate(300,220)">
          <path d="M0 -72 C46 -72 62 -26 58 24 C55 66 28 86 0 86 C-28 86 -55 66 -58 24 C-62 -26 -46 -72 0 -72 Z" fill="#111a2e" stroke="#334155" stroke-width="2"/>
          <path d="M0 -72 V -8" stroke="#06b6d4" stroke-width="2" opacity="0.55"/>
          <rect x="-5" y="-46" width="10" height="22" rx="5" fill="url(#accent)"/>
          <path d="M0 -8 V 86" stroke="#06b6d4" stroke-width="1" opacity="0.30"/>
        </g>`;
    case 'Headsets':
      return `
        <g transform="translate(300,218)">
          <path d="M-92 18 A 92 92 0 0 1 92 18" fill="none" stroke="#1e293b" stroke-width="18" stroke-linecap="round"/>
          <path d="M-92 18 A 92 92 0 0 1 92 18" fill="none" stroke="#06b6d4" stroke-width="3" opacity="0.55"/>
          <rect x="-118" y="6" width="48" height="82" rx="18" fill="#111a2e" stroke="#334155" stroke-width="2"/>
          <rect x="70" y="6" width="48" height="82" rx="18" fill="#111a2e" stroke="#334155" stroke-width="2"/>
          <rect x="-108" y="16" width="28" height="62" rx="14" fill="url(#accent)" opacity="0.35"/>
          <rect x="80" y="16" width="28" height="62" rx="14" fill="url(#accent)" opacity="0.35"/>
          <path d="M-94 66 Q -124 116 -60 120" fill="none" stroke="#334155" stroke-width="5" stroke-linecap="round"/>
        </g>`;
    case 'Storage & Components':
      return `
        <rect x="92" y="168" width="416" height="112" rx="10" fill="#111a2e" stroke="#334155" stroke-width="2"/>
        <rect x="108" y="184" width="330" height="80" rx="6" fill="#0b1424" stroke="#06b6d4" stroke-opacity="0.35"/>
        <circle cx="160" cy="224" r="30" fill="none" stroke="#06b6d4" stroke-width="3" opacity="0.75"/>
        <circle cx="160" cy="224" r="9" fill="#06b6d4" opacity="0.40"/>
        <circle cx="246" cy="224" r="30" fill="none" stroke="#6366f1" stroke-width="3" opacity="0.75"/>
        <circle cx="246" cy="224" r="9" fill="#6366f1" opacity="0.40"/>
        <rect x="92" y="168" width="14" height="112" fill="#334155"/>
        <rect x="444" y="196" width="64" height="14" rx="3" fill="#1e293b"/>`;
    default: // Accessories and any future category
      return `
        <rect x="200" y="148" width="200" height="152" rx="22" fill="#111a2e" stroke="#334155" stroke-width="2"/>
        <circle cx="300" cy="224" r="46" fill="none" stroke="url(#accent)" stroke-width="8" opacity="0.75"/>
        <circle cx="300" cy="224" r="16" fill="#06b6d4" opacity="0.35"/>`;
  }
}

function buildSvg(product) {
  const label = String(product.category).toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450" viewBox="0 0 600 450" role="img" aria-label="${product.name}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0a1020"/><stop offset="1" stop-color="#131f38"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="42%" r="58%">
      <stop offset="0" stop-color="#06b6d4" stop-opacity="0.28"/><stop offset="1" stop-color="#06b6d4" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#6366f1"/>
    </linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="9"/></filter>
  </defs>
  <rect width="600" height="450" fill="url(#bg)"/>
  <rect width="600" height="450" fill="url(#glow)"/>
  <g opacity="0.10" stroke="#334155" stroke-width="1">
    <path d="M0 360 H600 M0 390 H600 M0 420 H600"/>
  </g>
  <ellipse cx="300" cy="372" rx="176" ry="20" fill="#000000" opacity="0.45" filter="url(#soft)"/>
  <g transform="translate(300 225) scale(1.3) translate(-300 -225)">
    ${shapeFor(product.category)}
  </g>
  <text x="28" y="42" fill="#22d3ee" font-family="ui-sans-serif,system-ui,Arial" font-size="13" font-weight="700" letter-spacing="2">${label}</text>
  <text x="572" y="428" text-anchor="end" fill="#64748b" font-family="ui-sans-serif,system-ui,Arial" font-size="11" letter-spacing="1">BUILD YOUR DREAM SETUP</text>
</svg>
`;
}

async function main() {
  const { PRODUCTS } = await import(pathToFileURL(DATA_FILE).href);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const product of PRODUCTS) {
    const file = path.join(OUT_DIR, `${product.id}.svg`);
    fs.writeFileSync(file, buildSvg(product), 'utf8');
  }
  console.log(`generated ${PRODUCTS.length} product images in ${path.relative(process.cwd(), OUT_DIR)}`);
}

main().catch((err) => {
  console.error('gen:images failed:', err.message);
  process.exit(1);
});
