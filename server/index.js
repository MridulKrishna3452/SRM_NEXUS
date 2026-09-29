import { config } from './config.js';
import { getDb } from './db.js';
import { createApp } from './app.js';

const db = getDb();
const users = db.prepare('SELECT COUNT(*) n FROM users').get().n;

createApp().listen(config.port, () => {
  console.log(`\n  SRM Nexus running at http://localhost:${config.port}`);
  console.log(`  Database: ${config.databasePath}`);
  if (!users) console.log('  ⚠  Database is empty — run "npm run db:reset" to load demo data.');
  if (config.demoMode) console.log('  Demo mode ON — demo accounts are listed on the sign-in page.');
  console.log('');
});
