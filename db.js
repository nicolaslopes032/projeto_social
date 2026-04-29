const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'bancodedadosmultimeios',
  password: 'nicolas13',
  port: 5432,
});

async function conectarBanco() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Conectado ao PostgreSQL!');
  } catch (err) {
    console.error('❌ Erro ao conectar:', err.stack);
  }
}

conectarBanco();

// EXPORTE O POOL AQUI:
module.exports = pool;
