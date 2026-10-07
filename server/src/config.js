'use strict';

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT must be an integer between 0 and 65535');
  }
  return port;
}

function loadConfig(env = process.env) {
  return Object.freeze({
    port: parsePort(env.PORT || '3000'),
    nodeEnv: env.NODE_ENV || 'development'
  });
}

module.exports = { loadConfig, parsePort };
