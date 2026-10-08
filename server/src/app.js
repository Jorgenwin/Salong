'use strict';

const { randomUUID } = require('node:crypto');
const { handleReadRequest } = require('./api/read');
const { handleEnrichmentRequest } = require('./api/enrichment');
const { handleContactWriteRequest } = require('./api/contacts-write');
const { handleActivityWriteRequest } = require('./api/activities-write');

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

function createApp({ config, repositories = null, authBoundary = null, now = () => new Date(), makeRequestId = randomUUID } = {}) {
  if (!config) throw new Error('createApp requires config');

  return async function handleRequest(req, res) {
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

      if (!authBoundary && (config.nodeEnv === 'production' || Boolean(config.databaseUrl)) && url.pathname.startsWith('/api/')) {
        writeJson(res, 503, {
          success: false,
          error_code: 'auth_not_ready',
          error_message: 'Autentisering er ikke aktivert.',
          requestId
        }, requestId);
        return;
      }

      if (authBoundary && url.pathname.startsWith('/api/')) {
        const minimumRole = req.method === 'GET' ? 'reader' : 'editor';
        const auth = await authBoundary.authorizeRequest(req, { minimumRole });
        if (!auth.ok) {
          writeJson(res, auth.status, { ...auth.body, requestId }, requestId);
          return;
        }
        req.salongUser = auth.user;
      }

      const activityWriteResult = await handleActivityWriteRequest({ req, url, repositories });
      if (activityWriteResult) {
        const body = activityWriteResult.body && activityWriteResult.body.success === false
          ? { ...activityWriteResult.body, requestId }
          : activityWriteResult.body;
        writeJson(res, activityWriteResult.status, body, requestId);
        return;
      }

      const contactWriteResult = await handleContactWriteRequest({ req, url, repositories });
      if (contactWriteResult) {
        const body = contactWriteResult.body && contactWriteResult.body.success === false
          ? { ...contactWriteResult.body, requestId }
          : contactWriteResult.body;
        writeJson(res, contactWriteResult.status, body, requestId);
        return;
      }

      const enrichmentResult = await handleEnrichmentRequest({ req, url, repositories });
      if (enrichmentResult) {
        const body = enrichmentResult.body && enrichmentResult.body.success === false
          ? { ...enrichmentResult.body, requestId }
          : enrichmentResult.body;
        writeJson(res, enrichmentResult.status, body, requestId);
        return;
      }

      const readResult = await handleReadRequest({ req, url, repositories });
      if (readResult) {
        const body = readResult.body && readResult.body.success === false
          ? { ...readResult.body, requestId }
          : readResult.body;
        writeJson(res, readResult.status, body, requestId);
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
