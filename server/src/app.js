'use strict';

const http = require('node:http');
const { URL } = require('node:url');

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store'
  });
  res.end(payload);
}

function createServer(options = {}) {
  const serviceName = options.serviceName || 'salong-api';

  return http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://salong.local');

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { status: 'ok', service: serviceName });
      return;
    }

    sendJson(res, 404, {
      success: false,
      error_code: 'not_found',
      error_message: 'Endpoint not found'
    });
  });
}

module.exports = { createServer, sendJson };
