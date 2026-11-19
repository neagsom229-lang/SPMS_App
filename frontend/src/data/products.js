// Single source of truth for the public hardware catalog.
//
// To add a product: add one object to PRODUCTS below, then run
//   npm run gen:images   -> renders /images/products/<id>.svg
//   npm run db:dev:seed  -> upserts the row (name, price, category, stock)
// Nothing else is needed: the storefront, the category dropdown, the image
// generator, the store seed and npm run verify:store all read this file.
export const EXCHANGE_RATE = 4000; // 1 USD = 4,000 KHR (៛)

// Public SKU of a catalog item. The seed writes it into tbl_products.barcode
// and the storefront resolves that barcode to the real row id, so checkout
// always orders the database row behind the card. One place, one format.
export const barcodeFor = (product) => `SKU-${String(product.id).padStart(4, '0')}`;

export const ALL_CATEGORIES = [
  'Gaming PCs',
  'Laptops',
  'Monitors',
  'Keyboards',
  'Mice',
  'Headsets',
  'Storage & Components',
  'Accessories',
];

export const PRODUCTS = [
  {
    id: 1,
    name: 'ASUS ROG Strix G16CH',
    category: 'Gaming PCs',
    price: 1899,
    shortDescription: 'Core i9-14900F · RTX 4070 Ti Super · 32GB DDR5 · 1TB NVMe.',
    image: '/images/products/1.svg',
    inStock: true,
    stockStatus: 'in',
  },
  {
    id: 2,
    name: 'MSI MAG Infinite S3',
    category: 'Gaming PCs',
    price: 1499,
    shortDescription: 'Core i7-14700F · RTX 4060 Ti · 16GB DDR5 · 1TB NVMe.',
    image: '/images/products/2.svg',
    inStock: true,
    stockStatus: 'in',
  },
  {
    id: 3,
    name: 'Corsair Vengeance i7500',
    category: 'Gaming PCs',
    price: 2499,
    shortDescription: 'Ryzen 9 7950X · RTX 4080 Super · 64GB DDR5 · 2TB NVMe.',
    image: '/images/products/3.svg',
    inStock: true,
    stockStatus: 'low',
  },
  {
    id: 4,
    name: 'NZXT Player: Two',
    category: 'Gaming PCs',
    price: 3299,
    shortDescription: 'Core i9-14900K · RTX 4090 · 64GB DDR5 · 2TB NVMe.',
    image: '/images/products/4.svg',
    inStock: true,
    stockStatus: 'in',
  },
  {
    id: 5,
    name: 'ASUS ROG Zephyrus G16',
    category: 'Laptops',
    price: 2699,
    shortDescription: '16-inch OLED 240Hz · Ultra 9 185H · RTX 4070 · 32GB/1TB.',
    image: '/images/products/5.svg',
    inStock: true,
    stockStatus: 'in',
  },
  {
    id: 6,
    name: 'Alienware x16 R2',
    category: 'Laptops',
    price: 2199,
    shortDescription: '16-inch QHD+ 240Hz · Core i9 · RTX 4070 · 32GB/1TB.',
    image: '/images/products/6.svg',
    inStock: true,
    stockStatus: 'in',
  },
  {
    id: 7,
    name: 'Lenovo Legion Pro 5i',
    category: 'Laptops',
    price: 949,
    shortDescription: '16-inch WQXGA 240Hz · Core i7 · RTX 4060 · 16GB/1TB.',
    image: '/images/products/7.svg',
    inStock: true,
    stockStatus: 'low',
  },
  {
    id: 8,
    name: 'LG UltraGear 32GS95UE',
    category: 'Monitors',
    price: 1199,
    shortDescription: '32-inch 4K OLED · 240Hz · 0.03ms · G-Sync compatible.',
    image: '/images/products/8.svg',
    inStock: true,
    stockStatus: 'in',
  },
  {
    id: 9,
    name: 'Samsung Odyssey OLED G8',
    category: 'Monitors',
    price: 899,
    shortDescription: '34-inch OLED ultra-wide · 175Hz · 0.1ms response.',
    image: '/images/products/9.svg',
    inStock: true,
    stockStatus: 'in',
  },
  {
    id: 10,
    name: 'ASUS ROG Swift PG27UQR',
    category: 'Monitors',
    price: 599,
    shortDescription: '27-inch 4K IPS · 160Hz · 1ms · HDR600.',
    image: '/images/products/10.svg',
    inStock: true,
    stockStatus: 'in',
  },
  {
    id: 11,
    name: 'Keychron Q1 Pro',
    category: 'Keyboards',
    price: 189,
    shortDescription: '75% aluminum hot-swap · Gateron Jupiter Brown · wireless.',
    image: '/images/products/11.svg',
    inStock: true,
    stockStatus: 'in',
  },
  {
    id: 12,
    name: 'Razer Huntsman V2 TKL',
    category: 'Keyboards',
    price: 139,
    shortDescription: 'Optical linear switches · 8K polling · PBT keycaps.',
    image: '/images/products/12.svg',
    inStock: true,
    stockStatus: 'in',
  },
  {
    id: 13,
    name: 'Logitech G515 Lightspeed TKL',
    category: 'Keyboards',
    price: 99,
    shortDescription: 'Low-profile GL switches · LIGHTSPEED wireless · 36h battery.',
    image: '/images/products/13.svg',
    inStock: true,
    stockStatus: 'in',
  },
  {
    id: 14,
    name: 'Logitech G Pro X Superlight 2',
    category: 'Mice',
    price: 149,
    shortDescription: '60g HERO 2 sensor · 44K DPI · 70h battery.',
    image: '/images/products/14.svg',
    inStock: true,
    stockStatus: 'in',
  },
  {
    id: 15,
    name: 'Razer Viper Mini',
    category: 'Mice',
    price: 45,
    shortDescription: '61g lightweight · PAW3359 sensor · 8500 DPI.',
    image: '/images/products/15.svg',
    inStock: true,
    stockStatus: 'low',
  },
  {
    id: 16,
    name: 'Glorious Model O2',
    category: 'Mice',
    price: 39,
    shortDescription: '59g wireless · 26K BAMF sensor · 90h battery.',
    image: '/images/products/16.svg',
    inStock: true,
    stockStatus: 'in',
  },
  {
    id: 17,
    name: 'SteelSeries Arctis Nova Pro Wireless',
    category: 'Headsets',
    price: 299,
    shortDescription: 'Hi-Res dual drivers · active noise cancelling · swappable batteries.',
    image: '/images/products/17.svg',
    inStock: true,
    stockStatus: 'in',
  },
  {
    id: 18,
    name: 'Logitech G435 Lightspeed',
    category: 'Headsets',
    price: 49,
    shortDescription: '18h wireless · 40mm drivers · 165g lightweight build.',
    image: '/images/products/18.svg',
    inStock: true,
    stockStatus: 'in',
  },
  {
    id: 19,
    name: 'Samsung 990 Pro 2TB',
    category: 'Storage & Components',
    price: 189,
    shortDescription: 'PCIe 4.0 NVMe · 7,450MB/s read · 1,200TBW endurance.',
    image: '/images/products/19.svg',
    inStock: true,
    stockStatus: 'in',
  },
  {
    id: 20,
    name: 'Corsair Vengeance DDR5 64GB',
    category: 'Storage & Components',
    price: 229,
    shortDescription: '2x32GB · 6000MT/s · CL30 · low-profile RGB.',
    image: '/images/products/20.svg',
    inStock: false,
    stockStatus: 'out',
  },
];

// Category dropdown data is derived from the product list automatically.
export const CATEGORIES = ALL_CATEGORIES
  .map((name) => ({
    id: name,
    name,
    product_count: PRODUCTS.filter((p) => p.category === name).length,
  }))
  .filter((category) => category.product_count > 0);

export default PRODUCTS;
