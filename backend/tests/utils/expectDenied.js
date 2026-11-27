// backend/tests/utils/expectDenied.js
const request = require('supertest');

const send = (app, { method, path, token, body, headers = {} }) => {
  let req = request(app)[method](path);
  if (token) req = req.set('Authorization', `Bearer ${token}`);
  for (const [name, value] of Object.entries(headers)) {
    req = req.set(name, value);
  }
  if (body !== undefined) req = req.send(body);
  return req;
};

/**
 * A denial only means something if the same request succeeds for someone who
 * is allowed to make it.
 *
 * 1. snapshot readRow() (the row the request could change), when supplied
 * 2. send the request as the denied actor and require the expected status
 * 3. require readRow() to be identical afterwards
 * 4. send the same request as the allowed actor and require a 2xx
 *
 * readRow is optional only for read-only requests, which cannot change a row.
 */
async function expectDenied(app, options) {
  const {
    method,
    path,
    deniedToken,
    allowedToken,
    body,
    headers,
    status,
    readRow,
  } = options;

  const before = readRow ? await readRow() : undefined;

  const denied = await send(app, { method, path, token: deniedToken, body, headers });
  expect(denied.status).toBe(status);

  if (readRow) {
    expect(await readRow()).toEqual(before);
  }

  const allowed = await send(app, {
    method,
    path: options.allowedPath || path,
    token: allowedToken,
    body: options.allowedBody !== undefined ? options.allowedBody : body,
    headers: options.allowedHeaders || headers,
  });
  expect(allowed.status).toBeGreaterThanOrEqual(200);
  expect(allowed.status).toBeLessThan(300);

  return { denied, allowed };
}

module.exports = { expectDenied };
