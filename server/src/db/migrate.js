'use strict';

const fs=require('node:fs');
const path=require('node:path');

const DEFAULT_DIR=path.resolve(__dirname,'../../db/migrations');

function requireDb(db){
  if(!db||typeof db.query!=='function'){
    throw new TypeError('runMigrations requires an object with query(text, params)');
  }
  return db;
}

function listMigrations(dir=DEFAULT_DIR){
  return fs.readdirSync(dir,{withFileTypes:true})
    .filter(entry=>entry.isFile()&&/^[0-9][0-9A-Za-z_-]*\.sql$/.test(entry.name))
    .map(entry=>({
      version:entry.name.replace(/\.sql$/,''),
      filename:entry.name,
      path:path.join(dir,entry.name)
    }))
    .sort((a,b)=>a.filename.localeCompare(b.filename));
}

async function ensureMigrationTable(db){
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function appliedVersions(db){
  const result=await db.query('SELECT version FROM schema_migrations ORDER BY version');
  return new Set(result.rows.map(row=>row.version));
}

async function runMigrations(input,{dir=DEFAULT_DIR,logger=()=>{}}={}){
  const db=requireDb(input);
  await ensureMigrationTable(db);

  const applied=await appliedVersions(db);
  const pending=listMigrations(dir).filter(migration=>!applied.has(migration.version));
  const completed=[];

  for(const migration of pending){
    const sql=fs.readFileSync(migration.path,'utf8');
    logger({event:'migration_started',version:migration.version,filename:migration.filename});

    try{
      await db.query(sql);
      await db.query(
        'INSERT INTO schema_migrations(version) VALUES ($1) ON CONFLICT (version) DO NOTHING',
        [migration.version]
      );
      completed.push(migration.version);
      logger({event:'migration_completed',version:migration.version,filename:migration.filename});
    }catch(error){
      try{ await db.query('ROLLBACK'); }catch(_rollbackError){}
      logger({
        event:'migration_failed',
        version:migration.version,
        filename:migration.filename,
        message:error.message
      });
      error.migration=migration.version;
      throw error;
    }
  }

  return {
    applied:completed,
    skipped:listMigrations(dir).length-completed.length
  };
}

module.exports={
  DEFAULT_DIR,
  listMigrations,
  ensureMigrationTable,
  appliedVersions,
  runMigrations
};
