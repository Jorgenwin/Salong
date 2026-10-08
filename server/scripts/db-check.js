'use strict';

const { loadConfig, publicConfigSummary } = require('../src/config');
const { createRuntime } = require('../src/runtime');

async function main(){
  const config=loadConfig();
  if(!config.databaseUrl){
    throw new Error('DATABASE_URL must be set for db:check');
  }

  const log=entry=>{
    const safe={...entry};
    delete safe.connectionString;
    process.stdout.write(JSON.stringify({time:new Date().toISOString(),...safe})+'\n');
  };

  const runtime=await createRuntime({config,logger:log});
  try{
    const ok=await runtime.database.ping();
    process.stdout.write(JSON.stringify({
      event:'database_check_ok',
      ok,
      config:publicConfigSummary(config)
    })+'\n');
  }finally{
    await runtime.close();
  }
}

main().catch(error=>{
  process.stderr.write(JSON.stringify({
    event:'database_check_failed',
    message:error.message
  })+'\n');
  process.exitCode=1;
});
