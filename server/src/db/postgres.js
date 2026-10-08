'use strict';

function requireConnectionString(value){
  const connectionString=String(value||'').trim();
  if(!connectionString) throw new TypeError('DATABASE_URL is required to create PostgreSQL runtime');
  return connectionString;
}

function loadPg(pgModule){
  const pg=pgModule||require('pg');
  if(!pg||typeof pg.Pool!=='function'){
    throw new TypeError('PostgreSQL runtime requires pg.Pool');
  }
  return pg;
}

function createPostgres({
  connectionString,
  pgModule,
  max=10,
  idleTimeoutMillis=30000,
  connectionTimeoutMillis=10000,
  applicationName='salong'
}={}){
  const value=requireConnectionString(connectionString);
  const pg=loadPg(pgModule);
  const pool=new pg.Pool({
    connectionString:value,
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    application_name:applicationName
  });

  let closed=false;

  return {
    async query(text,params){
      if(closed) throw new Error('PostgreSQL pool is closed');
      return pool.query(text,params);
    },

    async ping(){
      const result=await pool.query('SELECT 1 AS ok');
      return Boolean(result&&result.rows&&result.rows[0]&&Number(result.rows[0].ok)===1);
    },

    async withClient(fn){
      if(closed) throw new Error('PostgreSQL pool is closed');
      if(typeof fn!=='function') throw new TypeError('withClient requires a function');
      const client=await pool.connect();
      try{
        return await fn({
          query(text,params){ return client.query(text,params); }
        });
      }finally{
        client.release();
      }
    },

    async close(){
      if(closed) return;
      closed=true;
      await pool.end();
    },

    get closed(){ return closed; }
  };
}

module.exports={
  createPostgres,
  requireConnectionString,
  loadPg
};
