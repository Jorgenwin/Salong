'use strict';

const { randomUUID } = require('node:crypto');

function writeJson(res, statusCode, body, requestId) {
  const payload = JSON.stringify(body);
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('content-length', Buffer.byteLength(payload));
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-request-id', requestId);
  res.end(payload);
}

function createApp({ config, now = () => new Date(), makeRequestId = randomUUID } = {}) {
  if (!config) throw new Error('createApp requires config');

  return function handleRequest(req, res) {
    const incomingId = req.headers['x-request-id'];
    const requestId = typeof incomingId === 'string' && incomingId.trim()
      ? incomingId.trim().slice(0, 128)
      : makeRequestId();

    try {
      const url = new URL(req.url || '/', 'http://salong.local');

      if (req.method === 'GET' && url.pathname === '/health') {
        writeJson(res, 200, {
          status: 'ok',
          service: 'salong-api',
          environment: config.nodeEnv,
          time: now().toISOString(),
          requestId
        }, requestId);
        return;
      }

      writeJson(res, 404, {
        success: false,
        error_code: 'not_found',
        error_message: 'Endepunktet finnes ikke.',
        requestId
      }, requestId);
    } catch (error) {
      writeJson(res, 500, {
        success: false,
        error_code: 'internal_error',
        error_message: 'Uventet serverfeil.',
        requestId
      }, requestId);
    }
  };
}

module.exports = { createApp };
