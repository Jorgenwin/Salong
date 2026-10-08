'use strict';

const { createPostgres } = require('./db/postgres');
const { runMigrations } = require('./db/migrate');
const { createRepositories } = require('./db/repositories');

async function createRuntime({
  config,
  pgModule,
  logger=()=>{},
  migrate=true
}={}){
  if(!config) throw new TypeError('createRuntime requires config');

  if(!config.databaseUrl){
    if(config.nodeEnv==='production'){
      throw new Error('DATABASE_URL is required in production');
    }
    logger({event:'database_not_configured'});
    return {
      database:null,
      repositories:null,
      async close(){}
    };
  }

  const database=createPostgres({
    connectionString:config.databaseUrl,
    pgModule
  });

  try{
    await database.ping();
    logger({event:'database_connected'});

    if(migrate){
      const migration=await database.withClient(
        client=>runMigrations(client,{logger})
      );
      logger({
        event:'database_migrations_ready',
        applied:migration.applied.length,
        skipped:migration.skipped
      });
    }

    return {
      database,
      repositories:createRepositories(database),
      async close(){
        await database.close();
        logger({event:'database_closed'});
      }
    };
  }catch(error){
    try{ await database.close(); }catch(_closeError){}
    throw error;
  }
}

module.exports={ createRuntime };
