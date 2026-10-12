/**
 * `npm run db:init` — 마이그레이션을 적용하고, SEED_DEMO=true 이면 데모 데이터를 넣습니다.
 * (서버도 시작할 때 같은 작업을 자동으로 하므로 보통은 따로 실행하지 않아도 됩니다)
 */
import 'dotenv/config';
import { runMigrations } from './migrate.js';
import { seedDatabase } from './seed.js';
import { closePool } from '../config/database.js';

try {
  await runMigrations();
  if (process.env.SEED_DEMO === 'true') {
    await seedDatabase();
  }
  console.log('Database is ready.');
  await closePool();
  process.exit(0);
} catch (error) {
  console.error('Database init failed:', error);
  process.exit(1);
}
