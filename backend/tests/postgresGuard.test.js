// backend/tests/postgresGuard.test.js
const path = require('path');
const { spawnSync } = require('child_process');
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

describe('Test DB guard allow/deny matrix', () => {
  const {
    assertTestDatabaseUrl,
    isLocal,
    isLocalHost,
    parseDbUrl,
    testDatabaseUrl,
    TEST_DB_PORT,
  } = require('../scripts/_guard');

  const url = (host, db = 'spms_test', port = TEST_DB_PORT) => `postgres://u:p@${host}:${port}/${db}`;

  test.each([
    ['localhost', url('localhost'), true],
    ['127.0.0.1', url('127.0.0.1'), true],
    ['::1', url('[::1]'), true],
    ['remote host', url('db.example.com'), false],
    ['remote supabase', url('db.supabase.co'), false],
    ['empty URL', '', false],
    ['garbage', 'not a url', false],
  ])('isLocal: %s', (_label, value, allowed) => {
    expect(isLocal(value)).toBe(allowed);
  });

  test.each([
    ['localhost', 'localhost', true],
    ['127.0.0.1', '127.0.0.1', true],
    ['::1', '[::1]', true],
    ['remote host', 'db.example.com', false],
    ['empty host', '', false],
  ])('isLocalHost: %s', (_label, host, allowed) => {
    expect(isLocalHost(host)).toBe(allowed);
  });

  test.each([
    ['parses host/port/database', url('127.0.0.1'), { host: '127.0.0.1', port: TEST_DB_PORT, database: 'spms_test' }],
    ['garbage', 'not a url', null],
  ])('parseDbUrl: %s', (_label, value, expected) => {
    expect(parseDbUrl(value)).toEqual(expected);
  });

  test.each([
    ['localhost _test', url('localhost'), null],
    ['127.0.0.1 _test', url('127.0.0.1'), null],
    ['::1 _test', url('[::1]'), null],
    ['remote host', url('db.example.com'), /host must be localhost/],
    ['remote supabase', url('db.supabase.co'), /host must be localhost/],
    ['wrong port', url('127.0.0.1', 'spms_test', 5432), /port must be TEST_DB_PORT/],
    ['db without _test suffix', url('127.0.0.1', 'spms'), /must end with _test/],
    ['no URL', null, /DATABASE_URL is required/],
    ['garbage', 'not a url', /not a valid URL/],
  ])('assertTestDatabaseUrl: %s', (_label, value, expectedError) => {
    if (expectedError === null) {
      expect(assertTestDatabaseUrl(value).host).toBeDefined();
    } else {
      expect(() => assertTestDatabaseUrl(value)).toThrow(expectedError);
    }
  });

  test('default port is 55432 unless TEST_DB_PORT overrides it', () => {
    expect(TEST_DB_PORT).toBe(Number(process.env.TEST_DB_PORT || 55432));
  });

  describe('require-time guard fails closed', () => {
    const guard = path.join(__dirname, '..', 'scripts', '_guard.js');

    function runGuard(extraEnv) {
      return spawnSync(process.execPath, ['-e', `require(${JSON.stringify(guard)})`], {
        encoding: 'utf8',
        env: {
          ...process.env,
          DATABASE_URL: '',
          DIRECT_URL: '',
          TEST_DB_PORT: String(TEST_DB_PORT),
          ...extraEnv,
        },
      });
    }

    test.each([
      ['valid local _test URL', { DATABASE_URL: testDatabaseUrl() }, 0],
      ['missing URL', {}, 0],
      ['remote URL', { DATABASE_URL: url('db.supabase.co') }, 1],
      ['wrong port', { DATABASE_URL: url('127.0.0.1', 'spms_test', 5432) }, 1],
      ['database without _test', { DATABASE_URL: url('127.0.0.1', 'spms') }, 1],
      ['invalid URL', { DATABASE_URL: 'not a url' }, 1],
      ['remote URL + CONFIRM_LIVE (no bypass)', { DATABASE_URL: url('db.supabase.co'), CONFIRM_LIVE: 'prod-ref' }, 1],
    ])('%s', (_label, env, expectedStatus) => {
      const result = runGuard(env);
      expect(result.status).toBe(expectedStatus);
      if (expectedStatus === 1) {
        expect(result.stderr).toMatch(/REFUSING TO TOUCH DATABASE/);
      }
    });
  });
});
