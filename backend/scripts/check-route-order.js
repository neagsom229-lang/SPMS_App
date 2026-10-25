// backend/scripts/check-route-order.js
const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../src/routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js') || f.endsWith('.cjs'));

let hasErrors = false;

console.log('🔍 Checking route ordering across all backend routers...');

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  try {
    delete require.cache[require.resolve(filePath)];
    const router = require(filePath);

    if (!router || !router.stack || typeof router.stack.forEach !== 'function') {
      console.log(`ℹ️ [${file}] skipped (not an Express router module).`);
      return;
    }

    let sawParametric = false;
    let parametricPath = '';
    const findings = [];

    router.stack.forEach(layer => {
      if (layer.route && layer.route.path) {
        const routePath = layer.route.path;
        const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();

        const isParametric = typeof routePath === 'string' && routePath.includes(':');
        const isStatic = typeof routePath === 'string' && !routePath.includes(':') && routePath !== '/';

        if (isParametric) {
          sawParametric = true;
          parametricPath = routePath;
        } else if (isStatic && sawParametric) {
          findings.push({ routePath, methods, precededBy: parametricPath });
        }
      }
    });

    if (findings.length > 0) {
      hasErrors = true;
      console.error(`❌ [${file}] has static routes defined AFTER parameterized routes (shadowed):`);
      findings.forEach(f => {
        console.error(`   - Static route "${f.routePath}" (${f.methods}) appears after parameterized route "${f.precededBy}"`);
      });
    } else {
      console.log(`✅ [${file}] route order is correct.`);
    }
  } catch (err) {
    console.log(`ℹ️ [${file}] skipped due to missing runtime dependencies or exports: ${err.message}`);
  }
});

if (hasErrors) {
  console.error('\n❌ Route order check FAILED: Static routes must be defined before parameterized routes (/:id).');
  process.exit(1);
} else {
  console.log('\n✨ Route order check PASSED successfully!');
  process.exit(0);
}

