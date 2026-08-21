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
  displayName: row.display_name || null,
  personRole: row.person_role || null,
  personTeam: row.person_team || null,
  needsPasswordSetup: row.password_set === false,
  createdAt: row.created_at
});

const USER_SELECT = `
  SELECT u.id, u.email, u.role, u.person_id, u.display_name, u.password_set, u.created_at, p.name AS person_name,
         p.role AS person_role, p.team AS person_team
  FROM users u
  LEFT JOIN people p ON p.id = u.person_id
`;

const findUserById = async (id) => {
  const { rows } = await getPool().query(`${USER_SELECT} WHERE u.id = $1`, [id]);
  return rows[0] || null;
};

// POST /api/auth/register — create a user + optional person (boss only)
router.post('/register', requireAuth, requireRole('boss'), async (req, res) => {
  try {
    const { email, password, role = 'engineer', personId = null,
            personName, personTeam, personWeeklyCapacity } = req.body || {};

    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }
    if (password !== undefined && password !== null && typeof password === 'string' && password.length > 0 && password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters if provided.' });
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

    // Resolve person: either link existing or create inline
    let finalPersonId = personId || null;
    let finalRole = role;

    if (finalPersonId) {
      // Link existing person
      const person = await pool.query('SELECT id, role FROM people WHERE id = $1', [finalPersonId]);
      if (person.rowCount === 0) {
        return res.status(400).json({ error: 'Person does not exist.' });
      }
      if (person.rows[0].role === 'lead') {
        finalRole = 'lead';
      } else if (role === 'lead') {
        return res.status(400).json({ error: 'A member cannot have a lead account. Mark this person as a lead first.' });
      }
      const linked = await pool.query('SELECT 1 FROM users WHERE person_id = $1', [finalPersonId]);
      if (linked.rowCount > 0) {
        return res.status(409).json({ error: 'That person already has a user account.' });
      }
    } else if (personName && personTeam) {
      // Create person inline
      if (typeof personName !== 'string' || personName.trim() === '') {
        return res.status(400).json({ error: 'Person name must be a non-empty string.' });
      }
      if (typeof personTeam !== 'string' || personTeam.trim() === '') {
        return res.status(400).json({ error: 'Team must be a non-empty string.' });
      }
      const capacity = personWeeklyCapacity === undefined ? 40 : personWeeklyCapacity;
      if (typeof capacity !== 'number' || !Number.isFinite(capacity) || capacity <= 0 || capacity > 168) {
        return res.status(400).json({ error: 'Weekly capacity must be a positive number (max 168).' });
      }
      const personRole = role === 'lead' ? 'lead' : 'member';
      const personIdNew = `p-${Date.now()}`;
      await pool.query(
        'INSERT INTO people (id, name, team, weekly_capacity, role) VALUES ($1, $2, $3, $4, $5)',
        [personIdNew, personName.trim(), personTeam.trim(), capacity, personRole]
      );
      finalPersonId = personIdNew;
      finalRole = role === 'lead' ? 'lead' : 'engineer';
    }

    // Create user account
    const id = `u-${Date.now()}`;
    let passwordHash;
    let passwordSet = true;

    if (password && typeof password === 'string' && password.length >= 8) {
      passwordHash = await bcrypt.hash(password, 10);
    } else {
      // No password provided — account needs password setup on first login
      passwordHash = await bcrypt.hash(`__pending_${id}_${Date.now()}`, 10);
      passwordSet = false;
    }

    await pool.query(
      'INSERT INTO users (id, email, password_hash, role, person_id, password_set) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, normalizedEmail, passwordHash, finalRole, finalPersonId, passwordSet]
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
    if (user.password_set === false) {
      // First-time login: require password setup before issuing token
      const setupToken = jwt.sign(
        { sub: user.id, email: user.email, purpose: 'password-setup' },
        getJwtSecret(),
        { expiresIn: '1h' }
      );
      return res.json({ needsPasswordSetup: true, setupToken, user: toPublicUser(user) });
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

// PATCH /api/auth/profile — update the authenticated user's own profile (name/email only)
router.patch('/profile', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const allowed = ['name', 'email'];
    const forbidden = Object.keys(body).filter(k => !allowed.includes(k));
    if (forbidden.length > 0) {
      return res.status(400).json({ error: `Field(s) cannot be changed: ${forbidden.join(', ')}.` });
    }
    if (body.name === undefined && body.email === undefined) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }

    const pool = getPool();
    const user = await findUserById(req.user.sub);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    let name = user.display_name || user.person_name || null;
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim() === '') {
        return res.status(400).json({ error: 'Name must be a non-empty string.' });
      }
      if (body.name.trim().length > 120) {
        return res.status(400).json({ error: 'Name must be at most 120 characters.' });
      }
      name = body.name.trim();
    }

    let email = user.email;
    if (body.email !== undefined) {
      if (typeof body.email !== 'string' || !EMAIL_RE.test(body.email.trim())) {
        return res.status(400).json({ error: 'A valid email is required.' });
      }
      email = body.email.trim().toLowerCase();
      if (email !== user.email) {
        const dup = await pool.query('SELECT 1 FROM users WHERE lower(email) = $1 AND id <> $2', [email, user.id]);
        if (dup.rowCount > 0) {
          return res.status(409).json({ error: 'A user with this email already exists.' });
        }
      }
    }

    await pool.query('UPDATE users SET display_name = $1, email = $2 WHERE id = $3', [name, email, user.id]);
    res.json(toPublicUser(await findUserById(user.id)));
  } catch (err) {
    res.status(500).json({ error: `Failed to update profile: ${err.message}` });
  }
});

// PATCH /api/auth/password — change the authenticated user's own password
router.patch('/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || typeof currentPassword !== 'string' || !newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'Current and new password are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    const pool = getPool();
    const { rows } = await pool.query('SELECT id, password_hash FROM users WHERE id = $1', [req.user.sub]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1, password_set = TRUE WHERE id = $2', [passwordHash, user.id]);
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ error: `Failed to change password: ${err.message}` });
  }
});

// POST /api/auth/set-password — first-time password setup (requires setupToken from login)
router.post('/set-password', async (req, res) => {
  try {
    const { setupToken, newPassword } = req.body || {};
    if (!setupToken || typeof setupToken !== 'string') {
      return res.status(400).json({ error: 'Setup token is required.' });
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    let payload;
    try {
      payload = jwt.verify(setupToken, getJwtSecret());
    } catch {
      return res.status(401).json({ error: 'Invalid or expired setup token.' });
    }
    if (payload.purpose !== 'password-setup') {
      return res.status(401).json({ error: 'Invalid token purpose.' });
    }

    const pool = getPool();
    const { rows } = await pool.query('SELECT id, password_set FROM users WHERE id = $1', [payload.sub]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user.password_set) {
      return res.status(400).json({ error: 'Password has already been set.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1, password_set = TRUE WHERE id = $2', [passwordHash, user.id]);

    // Find user and sign a real token
    const fullUser = await findUserById(user.id);
    res.json({ token: signToken(fullUser), user: toPublicUser(fullUser) });
  } catch (err) {
    res.status(500).json({ error: `Failed to set password: ${err.message}` });
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
