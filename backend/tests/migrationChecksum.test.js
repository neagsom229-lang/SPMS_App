const { sha256 } = require('../scripts/migration-checksum');

test('sha256 of the same SQL is equal for LF and CRLF line endings', () => {
  const sql = 'SELECT 1;\nSELECT 2;\n';
  expect(sha256(sql.replace(/\n/g, '\r\n'))).toBe(sha256(sql));
});

test('sha256 changes when SQL content changes', () => {
  expect(sha256('SELECT 1;\n')).not.toBe(sha256('SELECT 2;\n'));
});
