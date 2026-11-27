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
    assertDatabaseUrl,
    assertTestDatabaseUrl,
    assertDevDatabaseUrl,
    isLocal,
    isLocalHost,
    parseDbUrl,
    testDatabaseUrl,
    devDatabaseUrl,
    modeConfig,
    DEFAULT_TEST_DB_PORT,
    TEST_DB_PORT,
    TEST_DB_NAME,
    TEST_DB_CONTAINER,
    DEV_DB_PORT,
    DEV_DB_NAME,
    DEV_DB_CONTAINER,
    DEV_DB_VOLUME,
    DB_HOST,
  } = require('../scripts/_guard');

  const url = (host, db = TEST_DB_NAME, port = TEST_DB_PORT) => `postgres://u:p@${host}:${port}/${db}`;

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
    ['test mode: 127.0.0.1 _test', 'test', url('127.0.0.1'), null],
    ['test mode: localhost is refused', 'test', url('localhost'), /host must be 127.0.0.1/],
    ['test mode: ::1 is refused', 'test', url('[::1]'), /host must be 127.0.0.1/],
    ['test mode: remote host', 'test', url('db.example.com'), /host must be 127.0.0.1/],
    ['test mode: remote supabase', 'test', url('db.supabase.co'), /host must be 127.0.0.1/],
    ['test mode: wrong port', 'test', url('127.0.0.1', TEST_DB_NAME, DEV_DB_PORT), /port must be/],
    ['test mode: dev database name', 'test', url('127.0.0.1', DEV_DB_NAME, TEST_DB_PORT), /must end with _test/],
    ['test mode: db without suffix', 'test', url('127.0.0.1', 'spms', TEST_DB_PORT), /must end with _test/],
    ['test mode: no URL', 'test', null, /DATABASE_URL is required/],
    ['test mode: garbage', 'test', 'not a url', /not a valid URL/],
    ['dev mode: 127.0.0.1 _dev', 'dev', url('127.0.0.1', DEV_DB_NAME, DEV_DB_PORT), null],
    ['dev mode: localhost is refused', 'dev', url('localhost', DEV_DB_NAME, DEV_DB_PORT), /host must be 127.0.0.1/],
    ['dev mode: remote host', 'dev', url('db.supabase.co', DEV_DB_NAME, DEV_DB_PORT), /host must be 127.0.0.1/],
    ['dev mode: test port', 'dev', url('127.0.0.1', DEV_DB_NAME, TEST_DB_PORT), /port must be/],
    ['dev mode: test database name', 'dev', url('127.0.0.1', TEST_DB_NAME, DEV_DB_PORT), /must end with _dev/],
    ['dev mode: no URL', 'dev', null, /DATABASE_URL is required/],
    ['dev mode: garbage', 'dev', 'not a url', /not a valid URL/],
  ])('assertDatabaseUrl: %s', (_label, mode, value, expectedError) => {
    if (expectedError === null) {
      expect(assertDatabaseUrl(value, mode).host).toBe(DB_HOST);
    } else {
      expect(() => assertDatabaseUrl(value, mode)).toThrow(expectedError);
    }
  });

  test.each([
    ['test mode accepts the generated test URL', () => assertTestDatabaseUrl(testDatabaseUrl()).database === TEST_DB_NAME],
    ['dev mode accepts the generated dev URL', () => assertDevDatabaseUrl(devDatabaseUrl()).database === DEV_DB_NAME],
  ])('%s', (_label, check) => {
    expect(check()).toBe(true);
  });

  test.each([
    ['test', 'test', TEST_DB_PORT, TEST_DB_NAME, TEST_DB_CONTAINER, 'tmpfs', null],
    ['dev', 'dev', DEV_DB_PORT, DEV_DB_NAME, DEV_DB_CONTAINER, 'volume', DEV_DB_VOLUME],
  ])('%s mode is bound to 127.0.0.1 with its own port, container and storage', (mode, name, port, database, container, storage, volume) => {
    const config = modeConfig(mode);
    expect(config).toMatchObject({ name, host: DB_HOST, port, database, container, storage, volume });
    expect(config.host).toBe('127.0.0.1');
  });

  test('test and dev modes share no port, database name, container or volume', () => {
    const testMode = modeConfig('test');
    const devMode = modeConfig('dev');
    expect(testMode.port).not.toBe(devMode.port);
    expect(testMode.database).not.toBe(devMode.database);
    expect(testMode.container).not.toBe(devMode.container);
    expect(testMode.volume).toBeNull();
    expect(devMode.volume).not.toBeNull();
  });

  test('unknown mode is rejected', () => {
    expect(() => assertDatabaseUrl(url('127.0.0.1'), 'prod')).toThrow(/unknown database mode/);
  });

  test('default port comes from DEFAULT_TEST_DB_PORT unless TEST_DB_PORT overrides it', () => {
    expect(TEST_DB_PORT).toBe(Number(process.env.TEST_DB_PORT || DEFAULT_TEST_DB_PORT));
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
          SPMS_DB_MODE: '',
          TEST_DB_PORT: String(TEST_DB_PORT),
          DEV_DB_PORT: String(DEV_DB_PORT),
          ...extraEnv,
        },
      });
    }

    test.each([
      ['valid local _test URL', { DATABASE_URL: testDatabaseUrl() }, 0],
      ['valid local _dev URL in dev mode', { DATABASE_URL: devDatabaseUrl(), SPMS_DB_MODE: 'dev' }, 0],
      ['missing URL', {}, 0],
      ['remote URL', { DATABASE_URL: url('db.supabase.co') }, 1],
      ['wrong port', { DATABASE_URL: url('127.0.0.1', TEST_DB_NAME, 5432) }, 1],
      ['database without _test', { DATABASE_URL: url('127.0.0.1', 'spms') }, 1],
      ['invalid URL', { DATABASE_URL: 'not a url' }, 1],
      ['remote URL + CONFIRM_LIVE (no bypass)', { DATABASE_URL: url('db.supabase.co'), CONFIRM_LIVE: 'prod-ref' }, 1],
      ['_dev URL without dev mode', { DATABASE_URL: devDatabaseUrl() }, 1],
      ['_test URL in dev mode', { DATABASE_URL: testDatabaseUrl(), SPMS_DB_MODE: 'dev' }, 1],
      ['dev mode on the test port', { DATABASE_URL: url('127.0.0.1', DEV_DB_NAME, TEST_DB_PORT), SPMS_DB_MODE: 'dev' }, 1],
      ['localhost in dev mode', { DATABASE_URL: url('localhost', DEV_DB_NAME, DEV_DB_PORT), SPMS_DB_MODE: 'dev' }, 1],
      ['unknown mode fails closed', { DATABASE_URL: testDatabaseUrl(), SPMS_DB_MODE: 'prod' }, 1],
    ])('%s', (_label, env, expectedStatus) => {
      const result = runGuard(env);
      expect(result.status).toBe(expectedStatus);
      if (expectedStatus === 1) {
        expect(result.stderr).toMatch(/REFUSING TO TOUCH DATABASE/);
      }
    });
  });
});
