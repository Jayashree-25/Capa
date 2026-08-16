require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getPool } = require('../lib/db');
const { runMigrations } = require('./migrate');

const parseArgs = (argv) => {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    out[key] = next && !next.startsWith('--') ? next : true;
    if (out[key] !== true) i += 1;
  }
  return out;
};

(async () => {
  let { email, password, role = 'engineer', personId } = parseArgs(process.argv);
  if (!email || !password) {
    console.error('Usage: npm run create:user -- --email you@example.com --password secret123 [--role boss|lead|engineer] [--personId p-...]');
    process.exit(1);
  }
  if (!['boss', 'lead', 'engineer'].includes(role)) {
    console.error(`Invalid role "${role}". Use boss, lead, or engineer.`);
    process.exit(1);
  }
  if (typeof password === 'string' && password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const pool = getPool();
  await runMigrations(pool);

  const normalizedEmail = email.toLowerCase();
  const existing = await pool.query('SELECT 1 FROM users WHERE email = $1', [normalizedEmail]);
  if (existing.rowCount > 0) {
    console.error(`A user with email ${normalizedEmail} already exists.`);
    process.exit(1);
  }

  if (personId) {
    const person = await pool.query('SELECT id, role FROM people WHERE id = $1', [personId]);
    if (person.rowCount === 0) {
      console.error(`No person with id ${personId}. List people via GET /api/people.`);
      process.exit(1);
    }
    if (person.rows[0].role === 'lead') {
      role = 'lead';
    } else if (role === 'lead') {
      console.error(`Cannot assign a lead account to a member person. Mark ${personId} as a lead first.`);
      process.exit(1);
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    'INSERT INTO users (id, email, password_hash, role, person_id) VALUES ($1, $2, $3, $4, $5)',
    [`u-${Date.now()}`, normalizedEmail, passwordHash, role, personId || null]
  );
  console.log(`Created user ${normalizedEmail} with role ${role}.`);
  await pool.end();
})().catch(err => {
  console.error('Failed to create user:', err.message);
  process.exit(1);
});
