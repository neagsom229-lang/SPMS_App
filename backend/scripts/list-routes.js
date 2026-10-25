// backend/scripts/list-routes.js
const fs = require('fs');
const path = require('path');
const app = require('../src/app');

function printRouter(stack, basePath = '') {
  let routes = [];
  stack.forEach((layer) => {
    if (layer.route) {
      // Routes registered directly on the app/router
      const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
      routes.push(`${methods} ${basePath}${layer.route.path}`);
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      // Nested router
      let regexpStr = layer.regexp.toString();
      // Clean up express router regex
      let cleanPath = regexpStr
        .replace(/^\/\^\\\//, '/')
        .replace(/\\\/\?\(\?=\/\|\$\)/, '')
        .replace(/\\\//g, '/')
        .replace(/\/\(\?:\\\/\([^\)]+\)\)\?\$/, '')
        .replace(/\/\?\(\?=\/\|\$\)/, '')
        .replace(/\(\?:\\\/\([^\)]+\)\)\?/g, '')
        .replace(/\^/, '')
        .replace(/\$/, '');
      
      if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
      if (cleanPath === '//') cleanPath = '';

      const nested = printRouter(layer.handle.stack, basePath + cleanPath);
      routes = routes.concat(nested);
    }
  });
  return routes;
}

function main() {
  const routes = printRouter(app._router.stack);
  const uniqueRoutes = [...new Set(routes)].sort();
  
  const markdown = `# SPMS API Routes\n\nGenerated automatically via list-routes.js\n\nTotal Routes: ${uniqueRoutes.length}\n\n\`\`\`text\n${uniqueRoutes.join('\n')}\n\`\`\`\n`;
  
  const docsDir = path.join(__dirname, '../../docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  
  fs.writeFileSync(path.join(docsDir, 'ROUTES.md'), markdown, 'utf8');
  console.log(`✅ Successfully generated docs/ROUTES.md with ${uniqueRoutes.length} routes.`);
}

if (require.main === module) {
  main();
}
