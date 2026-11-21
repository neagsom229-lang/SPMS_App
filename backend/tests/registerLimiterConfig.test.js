const request = require('supertest');
const express = require('express');

function loadRegisterLimiter(envValue) {
  jest.resetModules();
  if (envValue === undefined) {
    delete process.env.SPMS_DB_MODE;
  } else {
    process.env.SPMS_DB_MODE = envValue;
  }
  const { registerLimiter } = require('../src/middleware/rateLimit');
  return registerLimiter;
}

function makeApp(limiter) {
  const app = express();
  app.post('/register-client', limiter, (req, res) => res.status(201).json({ ok: true }));
  return app;
}

async function postN(app, n) {
  let last;
  for (let i = 0; i < n; i += 1) {
    last = await request(app).post('/register-client').send({});
  }
  return last;
}

describe('registerLimiter production/test max', () => {
  const originalMode = process.env.SPMS_DB_MODE;

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.SPMS_DB_MODE;
    } else {
      process.env.SPMS_DB_MODE = originalMode;
    }
  });

  test('blocks the 21st registration when SPMS_DB_MODE is unset (max 20)', async () => {
    const app = makeApp(loadRegisterLimiter(undefined));
    const last = await postN(app, 21);
    expect(last.status).toBe(429);
  });

  test('allows the 21st registration when SPMS_DB_MODE is test (max 1000)', async () => {
    const app = makeApp(loadRegisterLimiter('test'));
    const last = await postN(app, 21);
    expect(last.status).toBe(201);
  });
});
