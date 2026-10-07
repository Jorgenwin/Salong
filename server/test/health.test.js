'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createServer } = require('../src/app');
const { loadConfig, parsePort } = require('../src/config');

async function withServer(run) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('GET /health reports the API as healthy', async () => {
  await withServer(async baseUrl => {
    const response = await fetch(baseUrl + '/health');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /application\/json/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { status: 'ok', service: 'salong-api' });
  });
});

test('unknown endpoints use the service error shape', async () => {
  await withServer(async baseUrl => {
    const response = await fetch(baseUrl + '/api/not-yet');
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      success: false,
      error_code: 'not_found',
      error_message: 'Endpoint not found'
    });
  });
});

test('configuration has safe defaults and validates PORT', () => {
  assert.deepEqual(loadConfig({}), { port: 3000, nodeEnv: 'development' });
  assert.equal(parsePort('8080'), 8080);
  assert.throws(() => parsePort('abc'), /PORT/);
  assert.throws(() => parsePort('70000'), /PORT/);
});
