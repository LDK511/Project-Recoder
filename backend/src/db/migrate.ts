import { getClient } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { migrations } from './migrations.js';

const MIGRATION_LOCK_ID = 7_283_110; // 여러 인스턴스가 동시에 떠도 한 번만 실행되게 하는 advisory lock

/** 아직 적용되지 않은 마이그레이션을 순서대로 적용합니다. */
export async function runMigrations(): Promise<void> {
  const client = await getClient();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
    const { rows } = await client.query<{ version: number }>('SELECT version FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.version));

    for (const m of [...migrations].sort((a, b) => a.version - b.version)) {
      if (applied.has(m.version)) continue;
      logger.info('Applying migration', { version: m.version, name: m.name });
      try {
        await client.query('BEGIN');
        await client.query(m.sql);
        await client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [m.version, m.name]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Migration failed', { version: m.version, name: m.name, error });
        throw error;
      }
    }
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
    } finally {
      client.release();
    }
  }
}
