const axios = require('axios');
jest.mock('axios');
const { verifyTransaction } = require('../src/services/bakongVerifier');

describe('Bakong Verifier Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.post.mockReset();
  });

  test('20 concurrent polls', async () => {
    axios.post.mockResolvedValue({
      status: 200,
      data: {
        responseCode: 0,
        data: {
          hash: 'tx_hash_123',
          amount: 10,
          currency: 'USD',
          toAccountId: 'abaakhppxxx@abaa',
          createdDate: new Date().toISOString()
        }
      }
    });

    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(verifyTransaction({ amount: 10, currency: 'USD' }, 'test_md5_' + i));
    }
    const results = await Promise.all(promises);
    expect(results.length).toBe(20);
    expect(results[0].state).toBe('PAID');
  });

  test('missing currency => FAILED_MISMATCH', async () => {
    axios.post.mockResolvedValue({
      status: 200,
      data: {
        responseCode: 0,
        data: {
          hash: 'tx_hash_123',
          amount: 10,
          // currency missing
          toAccountId: 'abaakhppxxx@abaa',
          createdDate: new Date().toISOString()
        }
      }
    });

    const session = { amount: 10, currency: 'USD' };
    const res = await verifyTransaction(session, 'test_missing_curr');
    expect(res.state).toBe('FAILED_MISMATCH');
  });

  test('missing account => FAILED_MISMATCH', async () => {
    axios.post.mockResolvedValue({
      status: 200,
      data: {
        responseCode: 0,
        data: {
          hash: 'tx_hash_123',
          amount: 10,
          currency: 'USD',
          // toAccountId missing
          createdDate: new Date().toISOString()
        }
      }
    });

    const session = { amount: 10, currency: 'USD' };
    const res = await verifyTransaction(session, 'test_missing_acc');
    expect(res.state).toBe('FAILED_MISMATCH');
  });

  test('missing time => FAILED_MISMATCH', async () => {
    axios.post.mockResolvedValue({
      status: 200,
      data: {
        responseCode: 0,
        data: {
          hash: 'tx_hash_123',
          amount: 10,
          currency: 'USD',
          toAccountId: 'abaakhppxxx@abaa'
          // createdDate missing
        }
      }
    });

    const session = { amount: 10, currency: 'USD', created_at: new Date().toISOString() };
    const res = await verifyTransaction(session, 'test_missing_time');
    expect(res.state).toBe('FAILED_MISMATCH');
  });

  test('same bakong_hash', async () => {
    axios.post.mockResolvedValue({
      status: 200,
      data: {
        responseCode: 0,
        data: {
          hash: 'tx_hash_123',
          amount: 10,
          currency: 'USD',
          toAccountId: 'abaakhppxxx@abaa',
          createdDate: new Date().toISOString()
        }
      }
    });

    const res1 = await verifyTransaction({ amount: 10, currency: 'USD' }, 'test_md5_same');
    const res2 = await verifyTransaction({ amount: 10, currency: 'USD' }, 'test_md5_same');
    expect(res1.state).toBe('PAID');
    expect(res2.state).toBe('PAID');
  });

  test('valid signed request', async () => {
    axios.post.mockResolvedValue({
      status: 200,
      data: {
        responseCode: 0,
        data: {
          hash: 'tx_hash_123',
          amount: 10,
          currency: 'USD',
          toAccountId: 'abaakhppxxx@abaa',
          createdDate: new Date().toISOString()
        }
      }
    });

    const res = await verifyTransaction({ amount: 10, currency: 'USD' }, 'test_md5_valid');
    expect(res.state).toBe('PAID');
  });

  test.each([
    [401, 'AUTH'],
    [403, 'FORBIDDEN_OR_GEO'],
    [429, 'RATE'],
    [500, 'UPSTREAM'],
    [503, 'UPSTREAM'],
  ])('provider HTTP %i maps to ERROR/%s', async (status, errorKind) => {
    axios.post.mockResolvedValue({ status, data: { responseCode: 9 } });

    const res = await verifyTransaction({ amount: 19, currency: 'USD' }, `test_status_${status}`);

    expect(res.state).toBe('ERROR');
    expect(res.errorKind).toBe(errorKind);
  });

  test('provider timeout maps to ERROR/UPSTREAM', async () => {
    const err = new Error('timeout');
    err.code = 'ECONNABORTED';
    axios.post.mockRejectedValue(err);

    const res = await verifyTransaction({ amount: 19, currency: 'USD' }, 'test_timeout');

    expect(res.state).toBe('ERROR');
    expect(res.errorKind).toBe('UPSTREAM');
  });
});
