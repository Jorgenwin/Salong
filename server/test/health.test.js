'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const test = require('node:test');

const { createApp } = require('../src/app');
const { loadConfig, publicConfigSummary } = require('../src/config');

async function withServer(handler, fn) {
  const server = http.createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    const address = server.address();
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('GET /health returns a small non-secret health response', async () => {
  const config = loadConfig({ NODE_ENV: 'test', PORT: '3000' });
  const fixedNow = new Date('2026-10-07T12:00:00.000Z');

  await withServer(createApp({
    config,
    now: () => fixedNow,
    makeRequestId: () => 'req-test'
  }), async baseUrl => {
    const response = await fetch(baseUrl + '/health');
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-request-id'), 'req-test');
    assert.deepEqual(body, {
      status: 'ok',
      service: 'salong-api',
      environment: 'test',
      time: fixedNow.toISOString(),
      requestId: 'req-test'
    });
  });
});

test('unknown endpoints use the Salong error shape', async () => {
  const config = loadConfig({ NODE_ENV: 'test', PORT: '3000' });

  await withServer(createApp({
    config,
    makeRequestId: () => 'req-404'
  }), async baseUrl => {
    const response = await fetch(baseUrl + '/api/not-yet');
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.success, false);
    assert.equal(body.error_code, 'not_found');
    assert.equal(body.requestId, 'req-404');
  });
});

test('configuration rejects invalid ports', () => {
  assert.throws(
    () => loadConfig({ NODE_ENV: 'test', PORT: 'not-a-port' }),
    /PORT must be an integer/
  );
});

test('public config summary never exposes secret values', () => {
  const config = loadConfig({
    NODE_ENV: 'production',
    PORT: '8080',
    DATABASE_URL: 'postgres://secret-db',
    AUTH_SECRET: 'secret-auth',
    APOLLO_API_KEY: 'secret-apollo'
  });

  const summary = publicConfigSummary(config);
  const serialized = JSON.stringify(summary);

  assert.equal(summary.databaseConfigured, true);
  assert.equal(summary.authConfigured, true);
  assert.equal(summary.providersConfigured.apollo, true);
  assert.equal(serialized.includes('secret-'), false);
});
