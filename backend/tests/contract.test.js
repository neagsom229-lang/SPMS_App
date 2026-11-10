// backend/tests/contract.test.js
const fs = require('fs');
const path = require('path');
const app = require('../src/app');

function matches(call, route) {
  if (route.method !== call.method) return false;
  const rParts = route.path.split('/').filter(Boolean);
  const cParts = call.path.split('/').filter(Boolean);
  if (rParts.length !== cParts.length) return false;
  return rParts.every((p, idx) => {
    const cp = cParts[idx];
    const pIsParam = p.startsWith(':');
    const cpIsParam = cp.startsWith(':');
    if (pIsParam || cpIsParam) {
      return pIsParam && cpIsParam;
    }
    return p === cp;
  });
}

function scanFrontendCalls() {
  const frontendDir = path.resolve(__dirname, '../../frontend/src');
  const calls = [];

  function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const regex = /apiClient\.(get|post|put|patch|delete)\s*\(\s*(['"`])([^'"`]+)\2/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
          const method = match[1].toUpperCase();
          let rawPath = match[3];
          rawPath = rawPath.split('?')[0];
          rawPath = rawPath.replace(/\$\{[^}]+\}/g, ':id');
          if (!rawPath.startsWith('/')) rawPath = '/' + rawPath;
          if (!rawPath.startsWith('/api')) {
            rawPath = '/api' + rawPath;
          }
          calls.push({ method, path: rawPath, file: path.relative(frontendDir, fullPath) });
        }
      }
    }
  }

  walk(frontendDir);
  return calls;
}

describe('Frontend-Backend Contract Test', () => {
  it('pure matches function: backend /x/:id does NOT match frontend /x/low-stock', () => {
    const route = { method: 'GET', path: '/api/x/:id' };
    const callWithParam = { method: 'GET', path: '/api/x/:id' };
    const callLiteral = { method: 'GET', path: '/api/x/low-stock' };

    expect(matches(callWithParam, route)).toBe(true);
    expect(matches(callLiteral, route)).toBe(false);
  });

  it('all frontend apiClient calls match a mounted backend route', () => {
    const frontendCalls = scanFrontendCalls();
    const backendRoutes = app.mountedRoutes || [];

    console.log('Frontend calls count:', frontendCalls.length);
    console.log('Backend routes count:', backendRoutes.length);

    expect(frontendCalls.length).toBeGreaterThan(50);
    expect(backendRoutes.length).toBeGreaterThan(50);

    backendRoutes.forEach(r => {
      expect(typeof r.method).toBe('string');
      expect(typeof r.path).toBe('string');
    });

    const mismatches = [];
    for (const call of frontendCalls) {
      const matched = backendRoutes.some(r => matches(call, r));
      if (!matched) {
        mismatches.push(`${call.method} ${call.path} (in ${call.file})`);
      }
    }

    if (mismatches.length > 0) {
      console.error('❌ API Contract Mismatches found:', mismatches);
    }
    expect(mismatches.length).toBe(0);
  });
});
