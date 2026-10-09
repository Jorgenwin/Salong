'use strict';

// Operator-only database schema readiness. No secrets or customer rows printed.
const {createPostgres}=require('../src/db/postgres');
const {runMigrations,listMigrations}=require('../src/db/migrate');

const EXPECTED=['members','organizations','prospects','contacts','opportunities','activities',
  'prospect_batches','prospect_batch_accounts','enrichment_jobs'];

async function inspectSchema(db){
  const tables=await db.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1::text[])",
    [EXPECTED]
  );
  const present=new Set(tables.rows.map(row=>row.table_name));
  const migrations=await db.query("SELECT to_regclass('public.schema_migrations') AS migration_table");
  let versions=[];
  if(migrations.rows[0].migration_table){
    const rows=await db.query('SELECT version FROM public.schema_migrations ORDER BY version');
    versions=rows.rows.map(row=>row.version);
  }
  return {
    tables_present:EXPECTED.filter(t=>present.has(t)),
    tables_missing:EXPECTED.filter(t=>!present.has(t)),
    migrations_applied:versions,
    migrations_pending:listMigrations().map(m=>m.version).filter(v=>!versions.includes(v))
  };
}

async function main(argv=process.argv.slice(2),env=process.env){
  const apply=argv.includes('--apply');
  if(argv.some(arg=>!['--apply','--check'].includes(arg))||(apply&&argv.includes('--check'))){
    throw new Error('Usage: node server/scripts/setup-schema.js [--check|--apply]');
  }
  if(!env.DATABASE_URL) throw new Error('DATABASE_URL must be set');
  const db=createPostgres({connectionString:env.DATABASE_URL,applicationName:'salong-schema-setup'});
  try{
    const before=await db.withClient(inspectSchema);
    if(!apply){
      process.stdout.write(JSON.stringify({mode:'check',...before})+'\n');
      return before;
    }
    const applied=await db.withClient(client=>runMigrations(client));
    const after=await db.withClient(inspectSchema);
    if(after.tables_missing.length||after.migrations_pending.length){
      throw new Error('Schema is incomplete after migrations');
    }
    const result={mode:'apply',new_migrations:applied.applied,...after};
    process.stdout.write(JSON.stringify(result)+'\n');
    return result;
  }finally{
    await db.close();
  }
}

if(require.main===module){
  main().catch(error=>{
    process.stderr.write(JSON.stringify({event:'schema_setup_failed',message:error.message})+'\n');
    process.exitCode=1;
  });
}
module.exports={inspectSchema,main};
