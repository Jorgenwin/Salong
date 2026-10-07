'use strict';

const { createServer } = require('./app');
const { loadConfig } = require('./config');

const config = loadConfig();
const server = createServer();

server.listen(config.port, '0.0.0.0', () => {
  const address = server.address();
  const port = address && typeof address === 'object' ? address.port : config.port;
  console.log(JSON.stringify({
    level: 'info',
    event: 'server_started',
    service: 'salong-api',
    node_env: config.nodeEnv,
    port
  }));
});

function shutdown(signal) {
  console.log(JSON.stringify({ level: 'info', event: 'server_stopping', signal }));
  server.close(err => {
    if (err) {
      console.error(JSON.stringify({ level: 'error', event: 'server_stop_failed', message: err.message }));
      process.exitCode = 1;
    }
  });
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
