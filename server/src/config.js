'use strict';

const VALID_NODE_ENVS = new Set(['development', 'test', 'production']);

function parsePort(value) {
  const raw = value == null || value === '' ? '3000' : String(value).trim();
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

function loadConfig(env = process.env) {
  const nodeEnv = String(env.NODE_ENV || 'development').trim();
  if (!VALID_NODE_ENVS.has(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test or production');
  }

  const host = String(env.HOST || '0.0.0.0').trim();
  if (!host) throw new Error('HOST must not be empty');

  const supabaseUrl=String(env.SUPABASE_URL||'').trim()||null;
  const supabasePublishableKey=String(env.SUPABASE_PUBLISHABLE_KEY||'').trim()||null;
  if(Boolean(supabaseUrl)!==Boolean(supabasePublishableKey)){
    throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set together');
  }

  return Object.freeze({
    nodeEnv,
    host,
    port: parsePort(env.PORT),
    databaseUrl: String(env.DATABASE_URL || '').trim() || null,
    authSecret: String(env.AUTH_SECRET || '').trim() || null,
    supabaseUrl,
    supabasePublishableKey,
    anthropicModel: String(env.ANTHROPIC_MODEL || 'claude-sonnet-5').trim() || 'claude-sonnet-5',
    providers: Object.freeze({
      apollo: String(env.APOLLO_API_KEY || '').trim() || null,
      exa: String(env.EXA_API_KEY || '').trim() || null,
      anthropic: String(env.ANTHROPIC_API_KEY || '').trim() || null,
      firecrawl: String(env.FIRECRAWL_API_KEY || '').trim() || null
    })
  });
}

function publicConfigSummary(config) {
  return {
    nodeEnv: config.nodeEnv,
    host: config.host,
    port: config.port,
    databaseConfigured: Boolean(config.databaseUrl),
    authConfigured: Boolean(config.supabaseUrl&&config.supabasePublishableKey),
    providersConfigured: Object.fromEntries(
      Object.entries(config.providers).map(([name, value]) => [name, Boolean(value)])
    )
  };
}

module.exports = { loadConfig, publicConfigSummary };
