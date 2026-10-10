import { Pool, PoolClient, QueryResult } from 'pg';

let pool: Pool | null = null;

/**
 * 데이터베이스 연결 풀을 초기화합니다.
 * DATABASE_URL 환경변수가 필요합니다.
 */
export function initPool(): Pool {
  if (pool) return pool;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL 환경변수가 필요합니다');
  }

  pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
  });

  pool.on('error', (err) => {
    console.error('[db] Unexpected error on idle client', err);
  });

  return pool;
}

/**
 * 연결 풀을 가져옵니다.
 */
export function getPool(): Pool {
  if (!pool) {
    initPool();
  }
  return pool!;
}

/**
 * 단일 쿼리를 실행합니다.
 */
export async function query<T = any>(
  text: string,
  values?: any[],
): Promise<QueryResult<T>> {
  const client = getPool();
  return client.query<T>(text, values);
}

/**
 * 트랜잭션 내에서 콜백을 실행합니다.
 * 콜백 내에서 에러가 발생하면 자동으로 롤백됩니다.
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * 행 잠금(FOR UPDATE)을 사용하여 동시성 제어를 합니다.
 * 트랜잭션 내에서만 의미가 있습니다.
 */
export async function withLock<T>(
  client: PoolClient,
  table: string,
  whereClause: string,
  values: any[],
  callback: (rows: any[]) => Promise<T>,
): Promise<T> {
  const lockQuery = `SELECT * FROM ${table} WHERE ${whereClause} FOR UPDATE`;
  const lockResult = await client.query(lockQuery, values);
  return callback(lockResult.rows);
}

/**
 * 연결 풀을 종료합니다.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
