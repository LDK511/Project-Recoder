import pg from 'pg';
import { logger } from '../utils/logger.js';

const { Pool } = pg;
type PoolClient = pg.PoolClient;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

// BIGINT(COUNT, SUM 결과)를 JS number 로 받습니다. 금액은 원 단위 정수라 안전 범위 안입니다.
pg.types.setTypeParser(20, (v: string) => parseInt(v, 10));
// TIMESTAMP(타임존 없음) 컬럼은 UTC 로 저장합니다(아래 timezone=UTC). 읽을 때도 UTC 로 해석해야
// 서버/컨테이너의 TZ 설정과 상관없이 시간이 어긋나지 않습니다.
pg.types.setTypeParser(1114, (v: string) => new Date(v.replace(' ', 'T') + 'Z'));

const sslMode = process.env.DATABASE_SSL; // 'require' | 'no-verify' | undefined

const pool = new Pool({
  connectionString: databaseUrl,
  max: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  options: '-c timezone=UTC',
  ssl:
    sslMode === 'require'
      ? { rejectUnauthorized: true }
      : sslMode === 'no-verify'
        ? { rejectUnauthorized: false }
        : undefined,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle database client', { err });
});

export async function query<T = any>(text: string, params?: unknown[]): Promise<pg.QueryResult<T & pg.QueryResultRow>> {
  const start = Date.now();
  try {
    const result = await pool.query(text, params as any[]);
    const duration = Date.now() - start;
    if (duration > 500) {
      logger.warn('Slow query', { duration, sql: text.replace(/\s+/g, ' ').slice(0, 160) });
    }
    return result as any;
  } catch (error) {
    logger.error('Database query error', { error, sql: text.replace(/\s+/g, ' ').slice(0, 160) });
    throw error;
  }
}

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      logger.error('Rollback failed', { rollbackError });
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function pingDatabase(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}

export { Pool };
export type { PoolClient };
