'use strict';

const http = require('node:http');
const { createApp } = require('./app');
const { loadConfig, publicConfigSummary } = require('./config');

function log(level, event, data = {}) {
  const entry = { level, event, time: new Date().toISOString(), ...data };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

let config;
try {
  config = loadConfig();
} catch (error) {
  process.stderr.write(JSON.stringify({
    level: 'error',
    event: 'config_invalid',
    time: new Date().toISOString(),
    message: error.message
  }) + '\n');
  process.exit(1);
}

const server = http.createServer(createApp({ config }));

server.on('clientError', (error, socket) => {
  log('warn', 'client_error', { code: error.code || 'unknown' });
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(config.port, config.host, () => {
  log('info', 'server_started', publicConfigSummary(config));
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('info', 'server_stopping', { signal });

  const timer = setTimeout(() => {
    log('error', 'server_forced_shutdown');
    process.exit(1);
  }, 10000);
  timer.unref();

  server.close(error => {
    clearTimeout(timer);
    if (error) {
      log('error', 'server_stop_failed', { message: error.message });
      process.exit(1);
      return;
    }
    log('info', 'server_stopped');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
