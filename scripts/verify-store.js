// npm run verify:store
// Fails loudly (exit 1) if any storefront-catalog requirement regresses.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.resolve(ROOT, 'frontend/src/data/products.js');
const IMG_DIR = path.resolve(ROOT, 'frontend/public/images/products');
const STOREFRONT = path.resolve(ROOT, 'frontend/src/pages/Storefront.jsx');
const SEED = path.resolve(ROOT, 'backend/scripts/seed-demo.js');

const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

const PRICE_BOUNDS = {
  'Gaming PCs': [1200, 3500],
  Laptops: [900, 2800],
  Monitors: [300, 1200],
  Keyboards: [50, 200],
  Mice: [30, 150],
  Headsets: [40, 300],
  'Storage & Components': [60, 900],
  Accessories: [5, 500],
};

async function main() {
  const { PRODUCTS, CATEGORIES, ALL_CATEGORIES, EXCHANGE_RATE } =
    await import(pathToFileURL(DATA_FILE).href);

  check(EXCHANGE_RATE === 4000, `KHR rate must be 4000, got ${EXCHANGE_RATE}`);
  check(PRODUCTS.length === 20, `expected 20 products, got ${PRODUCTS.length}`);

  const names = PRODUCTS.map((p) => p.name);
  check(new Set(names).size === names.length, 'product names must be unique');

  const ids = PRODUCTS.map((p) => p.id);
  check(new Set(ids).size === ids.length, 'product ids must be unique');

  const required = ['id', 'name', 'category', 'price', 'shortDescription', 'image', 'inStock'];
  const banned = /demo|placeholder|lorem|sample|generic|tbd/i;
  const seenImages = new Set();
  for (const p of PRODUCTS) {
    const tag = `product ${p.id}`;
    for (const key of required) {
      check(p[key] !== undefined && p[key] !== null && p[key] !== '',
        `${tag}: missing field ${key}`);
    }
    check(typeof p.price === 'number' && Number.isFinite(p.price), `${tag}: price is not a number`);
    check(banned.test(p.name) || banned.test(p.shortDescription) || banned.test(p.category)
      ? false : true, `${tag}: placeholder word left in visible text`);
    check(ALL_CATEGORIES.includes(p.category), `${tag}: unknown category ${p.category}`);
    const bounds = PRICE_BOUNDS[p.category];
    if (bounds) {
      check(p.price >= bounds[0] && p.price <= bounds[1],
        `${tag}: $${p.price} outside realistic range ${bounds[0]}-${bounds[1]} for ${p.category}`);
    }
    check(typeof p.shortDescription === 'string' && p.shortDescription.length >= 15 && p.shortDescription.length <= 160,
      `${tag}: shortDescription must be one specific line (15-160 chars)`);
    check(typeof p.inStock === 'boolean', `${tag}: inStock must be boolean`);
    check(['in', 'low', 'out'].includes(p.stockStatus), `${tag}: invalid stockStatus`);
    check((p.stockStatus === 'out') === (p.inStock === false), `${tag}: inStock/stockStatus disagree`);
    check(typeof p.image === 'string' && /^\/images\/products\/\d+\.svg$/.test(p.image),
      `${tag}: image must be /images/products/<id>.svg`);
    check(!seenImages.has(p.image), `${tag}: duplicate image ${p.image}`);
    seenImages.add(p.image);

    const file = path.join(IMG_DIR, `${p.id}.svg`);
    check(fs.existsSync(file), `${tag}: image file missing ${path.relative(ROOT, file)}`);
    if (fs.existsSync(file)) {
      const size = fs.statSync(file).size;
      check(size < 150 * 1024, `${tag}: image ${size} bytes >= 150 KB`);
      const head = fs.readFileSync(file, 'utf8').trim();
      check(head.startsWith('<svg') && head.endsWith('</svg>'), `${tag}: image is not valid SVG`);
    }
  }

  const statuses = PRODUCTS.map((p) => p.stockStatus);
  check(statuses.includes('low'), 'at least one Low Stock item required');
  check(statuses.includes('out'), 'at least one Out of Stock item required');

  const ranges = {
    under_50: PRODUCTS.filter((p) => p.price < 50),
    '50_200': PRODUCTS.filter((p) => p.price >= 50 && p.price <= 200),
    '200_1000': PRODUCTS.filter((p) => p.price > 200 && p.price <= 1000),
    '1000_plus': PRODUCTS.filter((p) => p.price > 1000),
  };
  for (const [key, list] of Object.entries(ranges)) {
    check(list.length >= 3, `price range ${key} has only ${list.length} products (need >= 3)`);
  }

  check(CATEGORIES.length >= 7, `category dropdown should list >= 7 populated categories, got ${CATEGORIES.length}`);
  for (const c of CATEGORIES) {
    check(c.product_count === PRODUCTS.filter((p) => p.category === c.id).length,
      `category ${c.id}: wrong product_count`);
  }

  const storefront = fs.readFileSync(STOREFRONT, 'utf8');
  const productsSource = fs.readFileSync(DATA_FILE, 'utf8');
  const sourceChecks = [
    ["../data/products", 'storefront imports the canonical data file'],
    ['loading="lazy"', 'images are lazy-loaded'],
    ['alt={displayName}', 'images have alt text'],
    ['aspect-[4/3]', 'images use a fixed aspect ratio'],
    ['value="under_50"', 'Under $50 filter present'],
    ['value="50_200"', '$50-$200 filter present'],
    ['value="200_1000"', '$200-$1000 filter present'],
    ['value="1000_plus"', '$1000+ filter present'],
    ['value="price_asc"', 'price ascending sort present'],
    ['value="price_desc"', 'price descending sort present'],
    ['value="name"', 'name sort present'],
    ['addToCart(product)', 'Add To Cart wired to cards'],
    ['sm:grid-cols-2', 'responsive grid (tablet)'],
    ['lg:grid-cols-4', 'responsive grid (desktop)'],
    ['barcodeFor(', 'checkout resolves catalog SKU to DB row id'],
    ['/public/store/${storeSlug}/menu', 'storefront resolves SKU via public menu'],
  ];
  for (const [needle, label] of sourceChecks) {
    check(storefront.includes(needle), `storefront: ${label} missing`);
  }
  check(productsSource.includes('barcodeFor'), 'products data exposes barcodeFor for SKU resolution');
  check(/public\/store\/\$\{storeSlug\}\/menu/.test(storefront), 'storefront: public menu endpoint missing');
  check(/stockStatus === 'out'/.test(storefront) && /inStock === false/.test(storefront),
    'storefront: out-of-stock guard missing');
  check(/price \* exchangeRate/.test(storefront), 'storefront: KHR is not computed from USD');

  const seed = fs.readFileSync(SEED, 'utf8');
  check(!/Demo Product|Demo Category/.test(seed), 'seed still contains Demo Product/Demo Category');
  check(seed.includes('products.js'), 'seed does not read the canonical data file');

  if (failures.length) {
    console.error(`verify:store FAILED (${failures.length} problem${failures.length === 1 ? '' : 's'}):`);
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }
  console.log(`verify:store PASS — ${PRODUCTS.length} products, ${CATEGORIES.length} categories, ${Object.keys(ranges).length} price ranges, images < 150 KB, 1 USD = ${EXCHANGE_RATE} KHR`);
}

main().catch((err) => {
  console.error('verify:store crashed:', err.message);
  process.exit(1);
});
