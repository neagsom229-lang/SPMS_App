// backend/tests/postgresGuard.test.js
const { URL } = require('url');

describe('Postgres Guard Tests', () => {
  const originalEnv = process.env.DATABASE_URL;
  const originalAllow = process.env.ALLOW_REMOTE_DB;
  const originalRender = process.env.RENDER;

  afterEach(() => {
    process.env.DATABASE_URL = originalEnv;
    process.env.ALLOW_REMOTE_DB = originalAllow;
    process.env.RENDER = originalRender;
    jest.resetModules();
  });

  test('localhost host is allowed', () => {
    const localUrl = new URL(process.env.DATABASE_URL);
    localUrl.pathname = '/spms_test';
    process.env.DATABASE_URL = localUrl.toString();
    jest.isolateModules(() => {
      expect(() => {
        require('../src/config/postgres');
      }).not.toThrow();
    });
  });

  test('remote host alone is refused', () => {
    process.env.DATABASE_URL = 'postgres://postgres:postgres@db.supabase.co:5432/spms_test';
    delete process.env.ALLOW_REMOTE_DB;
    delete process.env.RENDER;
    jest.isolateModules(() => {
      expect(() => {
        require('../src/config/postgres');
      }).toThrow();
    });
  });

  test('remote host + RENDER=true is allowed', () => {
    process.env.DATABASE_URL = 'postgres://postgres:postgres@db.supabase.co:5432/spms_test';
    process.env.RENDER = 'true';
    jest.isolateModules(() => {
      expect(() => {
        require('../src/config/postgres');
      }).not.toThrow();
    });
  });

  test('remote host + ALLOW_REMOTE_DB=1 is allowed', () => {
    process.env.DATABASE_URL = 'postgres://postgres:postgres@db.supabase.co:5432/spms_test';
    process.env.ALLOW_REMOTE_DB = '1';
    jest.isolateModules(() => {
      expect(() => {
        require('../src/config/postgres');
      }).not.toThrow();
    });
  });

  test('empty host is refused', () => {
    process.env.DATABASE_URL = 'postgres://postgres:postgres@/spms_test';
    jest.isolateModules(() => {
      expect(() => {
        require('../src/config/postgres');
      }).toThrow();
    });
  });
});
