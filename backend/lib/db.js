const { Pool } = require('pg');

const DEFAULT_URL = 'postgres://capa:capa@localhost:5432/capa';

let pool;

const getPool = () => {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL || DEFAULT_URL });
  }
  return pool;
};

const setPool = (p) => {
  pool = p;
};

module.exports = { getPool, setPool };
