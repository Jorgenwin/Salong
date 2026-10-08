'use strict';

const http = require('node:http');
const { createApp } = require('./app');
const { loadConfig, publicConfigSummary } = require('./config');
const { createRuntime } = require('./runtime');
const { createAuthBoundary } = require('./auth/authorization');
const { createSupabaseVerifier } = require('./auth/supabase');

function log(level, event, data = {}) {
  const entry = { level, event, time: new Date().toISOString(), ...data };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

function runtimeLog(entry = {}) {
  const { event = 'runtime_event', level = 'info', ...data } = entry;
  log(level, event, data);
}

async function start() {
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
    process.exitCode = 1;
    return;
  }

  let runtime;
  try {
    runtime = await createRuntime({ config, logger: runtimeLog });
  } catch (error) {
    log('error', 'runtime_start_failed', { message: error.message });
    process.exitCode = 1;
    return;
  }

  let authBoundary=null;
  if(config.supabaseUrl){
    try{
      if(!runtime.repositories||!runtime.repositories.members){
        throw new Error('Supabase Auth requires a configured PostgreSQL members repository');
      }
      authBoundary=createAuthBoundary({
        verifyToken:createSupabaseVerifier({
          url:config.supabaseUrl,
          publishableKey:config.supabasePublishableKey
        }),
        members:runtime.repositories.members
      });
    }catch(error){
      log('error','auth_start_failed',{message:error.message});
      await runtime.close();
      process.exitCode=1;
      return;
    }
  }

  const server = http.createServer(createApp({
    config,
    repositories: runtime.repositories,
    authBoundary
  }));

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

    server.close(async error => {
      try {
        await runtime.close();
      } catch (closeError) {
        log('error', 'runtime_stop_failed', { message: closeError.message });
        clearTimeout(timer);
        process.exit(1);
        return;
      }

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

  return { server, runtime, config, shutdown };
}

if (require.main === module) {
  start().catch(error => {
    log('error', 'server_start_failed', { message: error.message });
    process.exitCode = 1;
  });
}

module.exports = { start, log, runtimeLog };
