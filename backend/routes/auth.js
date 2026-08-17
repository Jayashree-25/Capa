const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../lib/db');
const { requireAuth, requireRole, getJwtSecret } = require('../middleware/auth');

const router = express.Router();

const ROLES = ['boss', 'lead', 'engineer'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const signToken = (user) => jwt.sign(
  { sub: user.id, email: user.email, role: user.role, personId: user.person_id },
  getJwtSecret(),
  { expiresIn: '7d' }
);

const toPublicUser = (row) => ({
  id: row.id,
  email: row.email,
  role: row.role,
  personId: row.person_id,
  personName: row.person_name,
  personRole: row.person_role || null,
  personTeam: row.person_team || null,
  createdAt: row.created_at
});

const USER_SELECT = `
  SELECT u.id, u.email, u.role, u.person_id, u.created_at, p.name AS person_name,
         p.role AS person_role, p.team AS person_team
  FROM users u
  LEFT JOIN people p ON p.id = u.person_id
`;

const findUserById = async (id) => {
  const { rows } = await getPool().query(`${USER_SELECT} WHERE u.id = $1`, [id]);
  return rows[0] || null;
};

// POST /api/auth/register — create a user (boss only; bootstrapped via `npm run create:user`)
router.post('/register', requireAuth, requireRole('boss'), async (req, res) => {
  try {
    const { email, password, role = 'engineer', personId = null } = req.body || {};

    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${ROLES.join(', ')}.` });
    }

    const pool = getPool();
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await pool.query('SELECT 1 FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }

    let finalRole = role;
    if (personId) {
      const person = await pool.query('SELECT id, role FROM people WHERE id = $1', [personId]);
      if (person.rowCount === 0) {
        return res.status(400).json({ error: 'Person does not exist.' });
      }
      if (person.rows[0].role === 'lead') {
        finalRole = 'lead';
      } else if (role === 'lead') {
        return res.status(400).json({ error: 'A member cannot have a lead account. Mark this person as a lead first.' });
      }
      const linked = await pool.query('SELECT 1 FROM users WHERE person_id = $1', [personId]);
      if (linked.rowCount > 0) {
        return res.status(409).json({ error: 'That person already has a user account.' });
      }
    }

    const id = `u-${Date.now()}`;
    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (id, email, password_hash, role, person_id) VALUES ($1, $2, $3, $4, $5)',
      [id, normalizedEmail, passwordHash, finalRole, personId || null]
    );
    res.status(201).json(toPublicUser(await findUserById(id)));
  } catch (err) {
    res.status(500).json({ error: `Failed to create user: ${err.message}` });
  }
});

// POST /api/auth/login — public, returns a token
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const { rows } = await getPool().query(`
      SELECT u.*, p.name AS person_name, p.role AS person_role, p.team AS person_team
      FROM users u
      LEFT JOIN people p ON p.id = u.person_id
      WHERE lower(u.email) = lower($1)
    `, [email.trim()]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    res.json({ token: signToken(user), user: toPublicUser(user) });
  } catch (err) {
    res.status(500).json({ error: `Failed to log in: ${err.message}` });
  }
});

// GET /api/auth/me — current user (any authenticated user)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await findUserById(req.user.sub);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json(toPublicUser(user));
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch user: ${err.message}` });
  }
});

// GET /api/auth/users — list users (boss only)
router.get('/users', requireAuth, requireRole('boss'), async (req, res) => {
  try {
    const { rows } = await getPool().query(`${USER_SELECT} ORDER BY u.email`);
    res.json(rows.map(toPublicUser));
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch users: ${err.message}` });
  }
});

module.exports = router;
