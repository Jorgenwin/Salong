'use strict';

const {createPostgres}=require('../src/db/postgres');
const {runMigrations}=require('../src/db/migrate');

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ownerInput(env=process.env){
  const subject=String(env.SALONG_OWNER_AUTH_SUBJECT||'').trim();
  const name=String(env.SALONG_OWNER_NAME||'Eier').trim();
  const email=String(env.SALONG_OWNER_EMAIL||'').trim();
  if(!UUID.test(subject)) throw new Error('SALONG_OWNER_AUTH_SUBJECT must be the UUID from Supabase Auth Users');
  if(!name) throw new Error('SALONG_OWNER_NAME cannot be blank');
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    throw new Error('SALONG_OWNER_EMAIL must be a valid email if set');
  }
  return {subject,name,email:email||null};
}

async function provisionOwner(db,owner){
  await db.query('BEGIN');
  try{
    await db.query("SELECT pg_advisory_xact_lock(hashtext('salong_owner_provision'))");
    const existing=await db.query('SELECT count(*)::integer AS n FROM public.members');
    if(Number(existing.rows[0].n)!==0){
      throw new Error('Refusing to provision: members already exist. Review manually.');
    }
    // No Artifact members are trusted. Only the known Supabase Auth subject
    // is allowed to become Salong's first owner.
    await db.query(
      "INSERT INTO public.members(id,auth_subject,name,email,role,active) VALUES ($1,$2,$3,$4,'owner',true)",
      ['salong-owner',owner.subject,owner.name,owner.email]
    );
    await db.query('COMMIT');
    return {inserted:1,role:'owner'};
  }catch(error){
    await db.query('ROLLBACK');
    throw error;
  }
}

async function main(argv=process.argv.slice(2),env=process.env){
  if(!argv.includes('--apply')){
    throw new Error('Provisioning requires explicit --apply after Supabase Auth user creation');
  }
  if(!env.DATABASE_URL) throw new Error('DATABASE_URL required to provision owner');
  const owner=ownerInput(env);
  const db=createPostgres({connectionString:env.DATABASE_URL,applicationName:'salong-owner-provision'});
  try{
    await db.withClient(client=>runMigrations(client));
    const result=await db.withClient(client=>provisionOwner(client,owner));
    process.stdout.write(JSON.stringify({event:'salong_owner_provisioned',...result})+'\n');
    return result;
  }finally{
    await db.close();
  }
}

if(require.main===module){
  main().catch(error=>{
    process.stderr.write(JSON.stringify({event:'salong_owner_provision_failed',message:error.message})+'\n');
    process.exitCode=1;
  });
}
module.exports={UUID,ownerInput,provisionOwner,main};
