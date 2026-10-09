const { Pool } = require('pg');
// ReCoder: NUMERIC/DECIMAL 을 문자열이 아닌 숫자로 받는다(화면의 toFixed 등).
require('pg').types.setTypeParser(1700, (value) => parseFloat(value));
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'shopping_mall',
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = pool;
