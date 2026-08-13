require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getPool } = require('../lib/db');
const { runMigrations } = require('./migrate');
const { saveData } = require('../lib/store');

(async () => {
  const pool = getPool();
  await runMigrations(pool);

  const { rows } = await pool.query('SELECT count(*)::int AS count FROM people');
  if (rows[0].count > 0) {
    console.log(`Database already has ${rows[0].count} people — skipping seed to avoid wiping existing data. Use a fresh database if you want to reseed.`);
    await pool.end();
    return;
  }

  const raw = fs.readFileSync(path.join(__dirname, '../data/mockData.json'), 'utf8');
  const { people, projects, tasks } = JSON.parse(raw);

  await saveData({ people, projects, tasks });
  console.log(`Seeded ${people.length} people, ${projects.length} projects, ${tasks.length} tasks into the database.`);
  await pool.end();
})().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
