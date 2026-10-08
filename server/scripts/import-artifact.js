'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {createPostgres}=require('../src/db/postgres');
const {runMigrations}=require('../src/db/migrate');
const {buildImportPlan,applyImport}=require('../src/db/artifact-import');

const ROOT=path.resolve(__dirname,'../..');
const EXPORT_DIR=path.resolve(ROOT,'data/exports');

function argumentsFor(argv){
  const apply=argv.includes('--apply');
  if(argv.includes('--apply')&&argv.includes('--dry-run')){
    throw new Error('Use either --apply or --dry-run, not both');
  }
  const idx=argv.indexOf('--file');
  if(idx<0||!argv[idx+1]||argv[idx+1].startsWith('--')){
    throw new Error('Usage: node server/scripts/import-artifact.js --file data/exports/export.json [--dry-run|--apply]');
  }
  return {file:path.resolve(process.cwd(),argv[idx+1]),apply};
}
function readPrivateExport(file){
  const directory=fs.realpathSync(EXPORT_DIR);
  const actual=fs.realpathSync(file);
  if(actual===directory||!actual.startsWith(directory+path.sep)){
    throw new Error('Artifact export must remain inside gitignored data/exports/');
  }
  if(!actual.endsWith('.json')) throw new Error('Artifact export must be a JSON file');
  return JSON.parse(fs.readFileSync(actual,'utf8'));
}
async function main(argv=process.argv.slice(2),env=process.env){
  const args=argumentsFor(argv);
  const plan=buildImportPlan(readPrivateExport(args.file));

  if(!args.apply){
    process.stdout.write(JSON.stringify({
      mode:'dry_run',...plan.report,
      note:'No database writes. Original documents will be staged before mapping on --apply.'
    },null,2)+'\n');
    return plan.report;
  }
  if(!env.DATABASE_URL){
    throw new Error('DATABASE_URL required for --apply; no data was imported');
  }
  const database=createPostgres({
    connectionString:env.DATABASE_URL,
    applicationName:'salong-artifact-import'
  });
  try{
    await database.withClient(client=>runMigrations(client));
    const report=await database.withClient(client=>applyImport(client,plan));
    process.stdout.write(JSON.stringify({mode:'applied',...report},null,2)+'\n');
    return report;
  }finally{
    await database.close();
  }
}
if(require.main===module){
  main().catch(error=>{
    process.stderr.write(JSON.stringify({
      event:'artifact_import_failed',message:error.message
    })+'\n');
    process.exitCode=1;
  });
}
module.exports={argumentsFor,readPrivateExport,main};
