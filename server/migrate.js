import { openDb, migrate } from './db.js';
import { config } from './config.js';

const conn = openDb();
const applied = migrate(conn);
conn.close();
console.log(applied.length
  ? `Applied migrations to ${config.databasePath}: ${applied.join(', ')}`
  : `Database already up to date (${config.databasePath})`);
