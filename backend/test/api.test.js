const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';

const ADMIN_URL = 'postgres://capa:capa@localhost:5432/capa';
const TEST_URL = process.env.TEST_DATABASE_URL || 'postgres://capa:capa@localhost:5432/capa_test';
process.env.DATABASE_URL = TEST_URL;

const { setPool, getPool } = require('../lib/db');
const { runMigrations } = require('../db/migrate');
const { saveData } = require('../lib/store');

const seed = {
  people: [
    { id: 'p-1', name: 'Alice', team: 'Alpha', weeklyCapacity: 40 },
    { id: 'p-2', name: 'Bob', team: 'Beta', weeklyCapacity: 40 },
    { id: 'p-9', name: 'Zara', team: 'Alpha', weeklyCapacity: 40 }
  ],
  projects: [
    { id: 'pr-1', name: 'Web App' },
    { id: 'pr-2', name: 'API' }
  ],
  tasks: [
    { id: 't-1', title: 'Fix checkout', projectId: 'pr-1', assigneeId: 'p-1', estimatedHours: 10, week: '2026-08-03' },
    { id: 't-2', title: 'Payment gateway', projectId: 'pr-1', assigneeId: 'p-1', estimatedHours: 45, week: '2026-08-10' },
    { id: 't-3', title: 'API docs', projectId: 'pr-2', assigneeId: 'p-2', estimatedHours: 8, week: '2026-08-10' },
    { id: 't-4', title: 'Support backlog', projectId: 'pr-2', assigneeId: 'p-1', estimatedHours: 6, week: '2026-08-17' }
  ]
};

const BOSS_EMAIL = 'boss@capa.test';
const BOSS_PASSWORD = 'boss-password-123';

const app = require('../app');

let server;
let base;
let token;

before(async () => {
  const admin = new Pool({ connectionString: ADMIN_URL });
  try {
    await admin.query('CREATE DATABASE capa_test');
  } catch (err) {
    if (err.code !== '42P04') throw err;
  }
  await admin.end();

  const pool = new Pool({ connectionString: TEST_URL });
  setPool(pool);
  await runMigrations(pool);
  await saveData(seed);

  const bossHash = await bcrypt.hash(BOSS_PASSWORD, 10);
  await pool.query(
    'INSERT INTO users (id, email, password_hash, role, person_id) VALUES ($1, $2, $3, $4, $5)',
    ['u-boss', BOSS_EMAIL, bossHash, 'boss', 'p-9']
  );

  server = app.listen(0);
  await new Promise(resolve => server.on('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;

  const loginRes = await apiFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: BOSS_EMAIL, password: BOSS_PASSWORD })
  });
  assert.strictEqual(loginRes.status, 200);
  token = (await loginRes.json()).token;
});

after(async () => {
  server.close();
  await getPool().end();

  const admin = new Pool({ connectionString: ADMIN_URL });
  await admin.query('DROP DATABASE IF EXISTS capa_test WITH (FORCE)');
  await admin.end();
});

const apiFetch = (pathname, opts = {}) => fetch(`${base}${pathname}`, opts);

const request = (pathname, opts = {}) => {
  const headers = { ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return apiFetch(pathname, { ...opts, headers });
};

const json = (method, pathname, body) => request(pathname, {
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

// ---------- Auth & RBAC ----------
test('requests without a token are rejected', async () => {
  const res = await apiFetch('/people');
  assert.strictEqual(res.status, 401);
});

test('POST /api/auth/login rejects invalid credentials', async () => {
  const bad = await apiFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: BOSS_EMAIL, password: 'wrong-password' })
  });
  assert.strictEqual(bad.status, 401);
});

test('GET /api/auth/me returns the authenticated user', async () => {
  const res = await request('/auth/me');
  assert.strictEqual(res.status, 200);
  const me = await res.json();
  assert.strictEqual(me.email, BOSS_EMAIL);
  assert.strictEqual(me.role, 'boss');
  assert.strictEqual(me.personId, 'p-9');
  assert.strictEqual(me.personName, 'Zara');
});

test('POST /api/auth/register creates users (boss only)', async () => {
  const created = await json('POST', '/auth/register', {
    email: 'engineer@capa.test',
    password: 'engineer-pass-123',
    role: 'engineer',
    personId: 'p-2'
  });
  assert.strictEqual(created.status, 201);
  const body = await created.json();
  assert.strictEqual(body.role, 'engineer');
  assert.strictEqual(body.personId, 'p-2');

  assert.strictEqual((await json('POST', '/auth/register', { email: 'engineer@capa.test', password: 'engineer-pass-123' })).status, 409);
  assert.strictEqual((await json('POST', '/auth/register', { email: 'x@capa.test', password: 'engineer-pass-123', role: 'admin' })).status, 400);
  assert.strictEqual((await json('POST', '/auth/register', { email: 'y@capa.test', password: 'short' })).status, 400);
  assert.strictEqual((await json('POST', '/auth/register', { email: 'engineer2@capa.test', password: 'engineer-pass-123', personId: 'missing' })).status, 400);
});

test('role restrictions: engineers cannot list users, bosses can', async () => {
  const loginRes = await apiFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'engineer@capa.test', password: 'engineer-pass-123' })
  });
  const engineerToken = (await loginRes.json()).token;

  const forbidden = await apiFetch('/auth/users', { headers: { Authorization: `Bearer ${engineerToken}` } });
  assert.strictEqual(forbidden.status, 403);

  const meRes = await apiFetch('/auth/me', { headers: { Authorization: `Bearer ${engineerToken}` } });
  assert.strictEqual(meRes.status, 200);
  const me = await meRes.json();
  assert.strictEqual(me.personRole, 'member');
  assert.strictEqual(me.personTeam, 'Beta');

  const allowed = await request('/auth/users');
  assert.strictEqual(allowed.status, 200);
  const users = await allowed.json();
  assert.strictEqual(users.length, 2);
  assert.ok(users.every(u => !('password_hash' in u)));
});

// ---------- People ----------
test('GET /api/people returns seeded people', async () => {
  const res = await request('/people');
  assert.strictEqual(res.status, 200);
  const people = await res.json();
  assert.strictEqual(people.length, 3);
  assert.strictEqual(people[0].name, 'Alice');
});

test('POST /api/people creates and validates', async () => {
  const created = await json('POST', '/people', { name: 'Carol', team: 'Beta', weeklyCapacity: 32 });
  assert.strictEqual(created.status, 201);
  const body = await created.json();
  assert.strictEqual(body.weeklyCapacity, 32);

  const noName = await json('POST', '/people', { name: ' ', team: 'Beta' });
  assert.strictEqual(noName.status, 400);

  const badCap = await json('POST', '/people', { name: 'Dan', team: 'Beta', weeklyCapacity: 0 });
  assert.strictEqual(badCap.status, 400);

  const defaultCap = await json('POST', '/people', { name: 'Dan', team: 'Beta' });
  assert.strictEqual(defaultCap.status, 201);
  assert.strictEqual((await defaultCap.json()).weeklyCapacity, 40);
});

test('PUT /api/people/:id updates and rejects unknown ids', async () => {
  const res = await json('PUT', '/people/p-2', { weeklyCapacity: 30, team: 'Gamma' });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.weeklyCapacity, 30);
  assert.strictEqual(body.team, 'Gamma');
  assert.strictEqual(body.name, 'Bob');

  const missing = await json('PUT', '/people/nope', { name: 'X', team: 'Y' });
  assert.strictEqual(missing.status, 404);
});

test('PUT /api/people/:id sets a manager and rejects invalid ones', async () => {
  await json('PUT', '/people/p-9', { role: 'lead' });
  const res = await json('PUT', '/people/p-2', { managerId: 'p-9' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).managerId, 'p-9');

  assert.strictEqual((await json('PUT', '/people/p-2', { managerId: 'p-2' })).status, 400);
  assert.strictEqual((await json('PUT', '/people/p-2', { managerId: 'nope' })).status, 400);
});

test('DELETE /api/people/:id blocks deletion while tasks are assigned', async () => {
  const blocked = await request('/people/p-1', { method: 'DELETE' });
  assert.strictEqual(blocked.status, 409);

  const ok = await json('POST', '/people', { name: 'Tmp', team: 'Tmp' });
  const tmp = await ok.json();
  const deleted = await request(`/people/${tmp.id}`, { method: 'DELETE' });
  assert.strictEqual(deleted.status, 200);

  const again = await request(`/people/${tmp.id}`, { method: 'DELETE' });
  assert.strictEqual(again.status, 404);
});

// ---------- Projects ----------
test('GET /api/projects and POST create; DELETE rules', async () => {
  const list = await request('/projects');
  assert.strictEqual((await list.json()).length, 2);

  const created = await json('POST', '/projects', { name: 'New Site' });
  assert.strictEqual(created.status, 201);
  const project = await created.json();

  const missingName = await json('POST', '/projects', { name: '' });
  assert.strictEqual(missingName.status, 400);

  const unused = await request(`/projects/${project.id}`, { method: 'DELETE' });
  assert.strictEqual(unused.status, 200);

  const inUse = await request('/projects/pr-1', { method: 'DELETE' });
  assert.strictEqual(inUse.status, 409);
});

test('PUT /api/projects/:id assigns a project to a lead (Project -> Lead)', async () => {
  const lead = await (await json('POST', '/people', { name: 'Assign Lead', team: 'AssignCo', role: 'lead' })).json();
  const member = await (await json('POST', '/people', { name: 'Assign Member', team: 'AssignCo', role: 'member', managerId: lead.id })).json();
  const project = await (await json('POST', '/projects', { name: 'Assignable Site' })).json();

  const tasksBefore = await (await request('/tasks')).json();

  // assign to a lead -> 200, ownerId + ownerName set
  const assigned = await json('PUT', `/projects/${project.id}`, { ownerId: lead.id });
  assert.strictEqual(assigned.status, 200);
  const assignedBody = await assigned.json();
  assert.strictEqual(assignedBody.ownerId, lead.id);
  assert.strictEqual(assignedBody.ownerName, 'Assign Lead');

  // GET /projects reflects the owner
  const list = await (await request('/projects')).json();
  const listed = list.find(p => p.id === project.id);
  assert.strictEqual(listed.ownerId, lead.id);
  assert.strictEqual(listed.ownerName, 'Assign Lead');

  // assignment never creates tasks or hours
  const tasksAfter = await (await request('/tasks')).json();
  assert.strictEqual(tasksAfter.length, tasksBefore.length);

  // assign to a member -> 400
  assert.strictEqual((await json('PUT', `/projects/${project.id}`, { ownerId: member.id })).status, 400);
  // unknown owner -> 400
  assert.strictEqual((await json('PUT', `/projects/${project.id}`, { ownerId: 'missing' })).status, 400);
  // unknown project -> 404
  assert.strictEqual((await json('PUT', '/projects/missing', { ownerId: lead.id })).status, 404);

  // unassign -> 200, owner cleared
  const unassigned = await json('PUT', `/projects/${project.id}`, { ownerId: null });
  assert.strictEqual(unassigned.status, 200);
  const unassignedBody = await unassigned.json();
  assert.strictEqual(unassignedBody.ownerId, null);

  const tasksUnassigned = await (await request('/tasks')).json();
  assert.strictEqual(tasksUnassigned.length, tasksBefore.length);

  // cleanup
  await request(`/projects/${project.id}`, { method: 'DELETE' });
  await request(`/people/${member.id}`, { method: 'DELETE' });
  await request(`/people/${lead.id}`, { method: 'DELETE' });
});

// ---------- Tasks ----------
test('GET /api/tasks joins assignee and project names', async () => {
  const res = await request('/tasks');
  const tasks = await res.json();
  const t1 = tasks.find(t => t.id === 't-1');
  assert.strictEqual(t1.assigneeName, 'Alice');
  assert.strictEqual(t1.projectName, 'Web App');
});

test('POST /api/tasks validates and normalizes the week to Monday', async () => {
  const res = await json('POST', '/tasks', {
    title: 'Landing page',
    projectId: 'pr-1',
    assigneeId: 'p-1',
    estimatedHours: 12,
    week: '2026-08-16'
  });
  assert.strictEqual(res.status, 201);
  const task = await res.json();
  assert.strictEqual(task.week, '2026-08-10');
  await request(`/tasks/${task.id}`, { method: 'DELETE' });

  assert.strictEqual((await json('POST', '/tasks', { title: 'X', projectId: 'pr-1', assigneeId: 'p-2', estimatedHours: 0, week: '2026-08-10' })).status, 400);
  assert.strictEqual((await json('POST', '/tasks', { title: 'X', projectId: 'pr-1', assigneeId: 'p-2', estimatedHours: 4, week: 'not-a-date' })).status, 400);
  assert.strictEqual((await json('POST', '/tasks', { title: 'X', projectId: 'missing', assigneeId: 'p-2', estimatedHours: 4, week: '2026-08-10' })).status, 400);
  assert.strictEqual((await json('POST', '/tasks', { title: 'X', projectId: 'pr-1', assigneeId: 'missing', estimatedHours: 4, week: '2026-08-10' })).status, 400);
});

test('GET /api/reports/load computes weekly hours vs capacity and filters', async () => {
  const res = await request('/reports/load?granularity=week&from=2026-08-03&to=2026-08-17');
  assert.strictEqual(res.status, 200);
  const report = await res.json();
  assert.deepStrictEqual(report.buckets, ['2026-08-03', '2026-08-10', '2026-08-17']);
  assert.strictEqual(report.granularity, 'week');

  const alice = report.people.find(p => p.name === 'Alice');
  assert.deepStrictEqual(alice.buckets.map(b => b.assignedHours), [10, 45, 6]);
  assert.deepStrictEqual(alice.buckets.map(b => b.overloaded), [false, true, false]);
  assert.strictEqual(alice.totalAssignedHours, 61);
  assert.strictEqual(alice.totalCapacityHours, 120);
  assert.strictEqual(alice.overloaded, true);

  const bob = report.people.find(p => p.name === 'Bob');
  assert.strictEqual(bob.totalAssignedHours, 8);
  assert.strictEqual(bob.overloaded, false);

  const teamRow = report.teamTotals.find(b => b.key === '2026-08-10');
  assert.strictEqual(teamRow.assignedHours, 53);
  assert.strictEqual(teamRow.overloaded, false);

  const teamFiltered = await (await request('/reports/load?from=2026-08-03&to=2026-08-17&team=Alpha')).json();
  assert.strictEqual(teamFiltered.people.length, 2);
  assert.ok(teamFiltered.people.some(p => p.name === 'Alice'));

  const projectFiltered = await (await request('/reports/load?from=2026-08-03&to=2026-08-17&project=pr-1')).json();
  const aliceFiltered = projectFiltered.people.find(p => p.name === 'Alice');
  assert.deepStrictEqual(aliceFiltered.buckets.map(b => b.assignedHours), [10, 45, 0]);
  assert.strictEqual(aliceFiltered.totalAssignedHours, 55);
});

test('GET /api/reports/load month granularity uses weekly capacity x weeks', async () => {
  const res = await request('/reports/load?granularity=month&from=2026-08&to=2026-08');
  const report = await res.json();
  assert.deepStrictEqual(report.buckets, ['2026-08']);
  const alice = report.people.find(p => p.name === 'Alice');
  assert.strictEqual(alice.buckets[0].assignedHours, 61);
  assert.strictEqual(alice.buckets[0].capacityHours, 200); // 5 Mondays in Aug 2026 x 40h
  assert.strictEqual(alice.overloaded, false);
});

test('PUT /api/tasks/:id reassigns tasks between people', async () => {
  const res = await json('PUT', '/tasks/t-1', { assigneeId: 'p-9' });
  assert.strictEqual(res.status, 200);
  const updated = await (await request('/tasks')).json();
  assert.strictEqual(updated.find(t => t.id === 't-1').assigneeName, 'Zara');

  const missing = await json('PUT', '/tasks/nope', { assigneeId: 'p-2' });
  assert.strictEqual(missing.status, 404);

  const invalid = await json('PUT', '/tasks/t-1', { assigneeId: 'ghost' });
  assert.strictEqual(invalid.status, 400);
});

test('DELETE /api/tasks/:id and teams endpoint', async () => {
  const created = await json('POST', '/tasks', { title: 'Temp', projectId: 'pr-2', assigneeId: null, estimatedHours: 2, week: '2026-08-10' });
  const task = await created.json();
  const deleted = await request(`/tasks/${task.id}`, { method: 'DELETE' });
  assert.strictEqual(deleted.status, 200);

  const teams = await (await request('/teams')).json();
  assert.deepStrictEqual(teams, ['Alpha', 'Beta', 'Gamma']);

  const unknown = await request('/nope');
  assert.strictEqual(unknown.status, 404);
});

test('DELETE /api/people allows deletion once tasks are unassigned', async () => {
  await json('PUT', '/tasks/t-2', { assigneeId: null });
  await json('PUT', '/tasks/t-4', { assigneeId: null });
  const deleted = await request('/people/p-1', { method: 'DELETE' });
  assert.strictEqual(deleted.status, 200);
  const people = await (await request('/people')).json();
  assert.ok(!people.some(p => p.id === 'p-1'));
});

test('scoped views: lead sees their subtree, engineer sees only themselves', async () => {
  const mgr = await (await json('POST', '/people', { name: 'Mgr', team: 'Omega', weeklyCapacity: 40, role: 'lead' })).json();
  const empA = await (await json('POST', '/people', { name: 'EmpA', team: 'Omega', weeklyCapacity: 40, managerId: mgr.id })).json();
  const empB = await (await json('POST', '/people', { name: 'EmpB', team: 'Omega', weeklyCapacity: 40, managerId: mgr.id })).json();

  const pool = getPool();
  const hash = await bcrypt.hash('scope-pass-123', 10);
  await pool.query(
    'INSERT INTO users (id, email, password_hash, role, person_id) VALUES ($1,$2,$3,$4,$5)',
    ['u-lead', 'lead@capa.test', hash, 'lead', mgr.id]
  );
  await pool.query(
    'INSERT INTO users (id, email, password_hash, role, person_id) VALUES ($1,$2,$3,$4,$5)',
    ['u-eng', 'eng@capa.test', hash, 'engineer', empA.id]
  );

  const loginAs = async (email) => {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'scope-pass-123' })
    });
    assert.strictEqual(res.status, 200);
    return (await res.json()).token;
  };
  const leadToken = await loginAs('lead@capa.test');
  const engToken = await loginAs('eng@capa.test');
  const authed = (t) => (pathname, opts = {}) => fetch(`${base}${pathname}`, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: `Bearer ${t}` }
  });
  const leadReq = authed(leadToken);
  const engReq = authed(engToken);

  await leadReq('/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'EmpA task', projectId: 'pr-1', assigneeId: empA.id, estimatedHours: 5, week: '2026-08-10' }) });
  const empBtask = await (await leadReq('/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'EmpB task', projectId: 'pr-1', assigneeId: empB.id, estimatedHours: 6, week: '2026-08-10' }) })).json();

  const leadPeople = await (await leadReq('/people')).json();
  assert.deepStrictEqual(leadPeople.map(p => p.id).sort(), [empA.id, empB.id, mgr.id].sort());

  const engPeople = await (await engReq('/people')).json();
  // Member visibility: self + Lead + teammates (subtree), intentionally wider than before
  assert.deepStrictEqual(engPeople.map(p => p.id).sort(), [empA.id, empB.id, mgr.id].sort());

  const engTasks = await (await engReq('/tasks')).json();
  assert.strictEqual(engTasks.length, 2);
  assert.ok(engTasks.some(t => t.title === 'EmpA task'));
  assert.ok(engTasks.some(t => t.title === 'EmpB task'));

  // Engineer project reads are scoped to own-task-referenced projects
  const engProjects = await (await engReq('/projects')).json();
  assert.deepStrictEqual(engProjects.map(p => p.id), ['pr-1']);

  const leadReport = await (await leadReq('/reports/load?granularity=week&from=2026-08-10&to=2026-08-10')).json();
  assert.deepStrictEqual(leadReport.people.map(p => p.id).sort(), [empA.id, empB.id, mgr.id].sort());
  const empArow = leadReport.people.find(p => p.id === empA.id);
  assert.strictEqual(empArow.buckets[0].assignedHours, 5);

  const leadTeams = await (await leadReq('/teams')).json();
  assert.deepStrictEqual(leadTeams, ['Omega']);

  assert.strictEqual((await engReq(`/tasks/${empBtask.id}`, { method: 'DELETE' })).status, 403);
  // Member now SEES teammate tasks (visibility widened); delete above still denied
  assert.strictEqual((await engReq('/people', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Hacked', team: 'Omega' }) })).status, 403);
  assert.strictEqual((await engReq(`/people/${mgr.id}`, { method: 'DELETE' })).status, 403);
  assert.strictEqual((await engReq('/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Hacked' }) })).status, 403);

  // Members cannot create tasks (boss/lead only) — neither for themselves nor others
  assert.strictEqual((await engReq('/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Own', projectId: 'pr-1', assigneeId: empA.id, estimatedHours: 2, week: '2026-08-10' }) })).status, 403);
  assert.strictEqual((await engReq('/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Other', projectId: 'pr-1', assigneeId: empB.id, estimatedHours: 2, week: '2026-08-10' }) })).status, 403);
  assert.strictEqual((await engReq(`/tasks/${empBtask.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assigneeId: empB.id }) })).status, 403);

  // Members can update ONLY the status of their own tasks
  const engOwned = (await (await engReq('/tasks')).json()).find(t => t.title === 'EmpA task');
  const statusRes = await engReq(`/tasks/${engOwned.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'in_progress' }) });
  assert.strictEqual(statusRes.status, 200);
  assert.strictEqual((await statusRes.json()).status, 'in_progress');
  assert.strictEqual((await engReq(`/tasks/${engOwned.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Hacked title' }) })).status, 403);
  assert.strictEqual((await engReq(`/tasks/${engOwned.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'bogus' }) })).status, 400);
});

test('lead permissions: strict subtree people, project ownership, unassign guard, boss-only attach', async () => {
  const leadA = await (await json('POST', '/people', { name: 'Lead A', team: 'AlphaL', weeklyCapacity: 40, role: 'lead' })).json();
  const leadB = await (await json('POST', '/people', { name: 'Lead B', team: 'BetaL', weeklyCapacity: 40, role: 'lead' })).json();
  const memA = await (await json('POST', '/people', { name: 'MemA', team: 'AlphaL', weeklyCapacity: 30, role: 'member', managerId: leadA.id })).json();
  await json('POST', '/people', { name: 'MemB', team: 'BetaL', weeklyCapacity: 30, role: 'member', managerId: leadB.id });

  const projA = await (await json('POST', '/projects', { name: 'Proj AlphaL', ownerId: leadA.id })).json();
  const projB = await (await json('POST', '/projects', { name: 'Proj BetaL', ownerId: leadB.id })).json();

  const pool = getPool();
  const hash = await bcrypt.hash('lead-pass-123', 10);
  await pool.query('INSERT INTO users (id, email, password_hash, role, person_id) VALUES ($1,$2,$3,$4,$5)', ['u-la', 'leadA@capa.test', hash, 'lead', leadA.id]);
  await pool.query('INSERT INTO users (id, email, password_hash, role, person_id) VALUES ($1,$2,$3,$4,$5)', ['u-lb', 'leadB@capa.test', hash, 'lead', leadB.id]);

  const loginAs = async (email) => {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'lead-pass-123' })
    });
    assert.strictEqual(res.status, 200);
    return (await res.json()).token;
  };
  const mkAuthed = (t) => (pathname, opts = {}) => fetch(`${base}${pathname}`, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: `Bearer ${t}` }
  });
  const aReq = mkAuthed(await loginAs('leadA@capa.test'));
  const aJson = (method, pathname, body) => aReq(pathname, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  // --- People scoping ---
  assert.strictEqual((await aJson('PUT', `/people/${memA.id}`, {})).status, 200); // sanity: in-scope touch
  const otherMember = await (await json('GET', '/people')).json(); // boss sees everyone
  const memBOwnerRow = otherMember.find(p => p.name === 'MemB');
  assert.strictEqual((await aJson('PUT', `/people/${memBOwnerRow.id}`, { weeklyCapacity: 99 })).status, 403);
  assert.strictEqual((await aJson('DELETE', `/people/${memBOwnerRow.id}`)).status, 403);
  assert.strictEqual((await aJson('DELETE', `/people/${leadB.id}`)).status, 403);

  // Lead creation constraints
  assert.strictEqual((await aJson('POST', '/people', { name: 'Evil Lead', team: 'AlphaL', role: 'lead', managerId: null })).status, 403);
  assert.strictEqual((await aJson('POST', '/people', { name: 'Poach', team: 'BetaL', role: 'member', managerId: leadB.id })).status, 403);
  assert.strictEqual((await aJson('POST', '/people', { name: 'WrongTeam', team: 'BetaL', role: 'member', managerId: leadA.id })).status, 403);
  const created = await aJson('POST', '/people', { name: 'New Member', team: 'AlphaL', role: 'member', managerId: leadA.id });
  assert.strictEqual(created.status, 201);

  // Role/reporting/team changes are boss-only; self-protection for every role
  assert.strictEqual((await aJson('PUT', `/people/${memA.id}`, { role: 'lead' })).status, 403);
  assert.strictEqual((await aJson('PUT', `/people/${memA.id}`, { managerId: leadB.id })).status, 403);
  assert.strictEqual((await aJson('PUT', `/people/${memA.id}`, { team: 'BetaL' })).status, 403);
  assert.strictEqual((await aJson('PUT', `/people/${leadA.id}`, { status: 'inactive' })).status, 400);
  assert.strictEqual((await aJson('DELETE', `/people/${leadA.id}`)).status, 400);
  assert.strictEqual((await aJson('PUT', `/people/${memA.id}`, { weeklyCapacity: 33, name: 'MemA Renamed' })).status, 200); // in-scope member edit OK
  assert.strictEqual((await aJson('PUT', `/people/${leadA.id}`, { weeklyCapacity: 41 })).status, 200); // self-edit OK

  // --- Project scoping ---
  const visibleProjects = await (await aReq('/projects')).json();
  assert.ok(visibleProjects.some(p => p.id === projA.id));
  assert.ok(!visibleProjects.some(p => p.id === projB.id)); // no scope tasks reference it yet

  assert.strictEqual((await aJson('PUT', `/projects/${projB.id}`, { description: 'hack' })).status, 403);
  assert.strictEqual((await aJson('DELETE', `/projects/${projB.id}`)).status, 403);
  assert.strictEqual((await aJson('PUT', `/projects/${projA.id}`, { ownerId: leadB.id })).status, 403);
  assert.strictEqual((await aJson('PUT', `/projects/${projA.id}`, { description: 'mine only' })).status, 200);
  assert.strictEqual((await aJson('POST', '/projects', { name: 'Not Mine', ownerId: leadB.id })).status, 403);
  assert.strictEqual((await aJson('POST', '/projects', { name: 'Unowned Attempt', ownerId: null })).status, 403);
  assert.strictEqual((await aJson('POST', '/projects', { name: 'My New Proj', ownerId: leadA.id })).status, 201);

  // Lead's own unassigned backlog task makes its project visible
  const backlog = await (await aJson('POST', '/tasks', { title: 'Backlog idea', projectId: projB.id, estimatedHours: 1, week: '2026-08-31' })).json();
  assert.strictEqual(backlog.assigneeId, null);
  const visibleAfterBacklog = await (await aReq('/projects')).json();
  assert.ok(visibleAfterBacklog.some(p => p.id === projB.id));

  // --- Unassign guard ---
  const bossTask = await (await json('POST', '/tasks', { title: 'Boss assigned', projectId: projA.id, assigneeId: leadA.id, estimatedHours: 4, week: '2026-08-10' })).json();
  assert.strictEqual(bossTask.assigneeId, leadA.id); // sanity: boss->lead assignment valid
  assert.strictEqual((await aJson('PUT', `/tasks/${bossTask.id}`, { assigneeId: null })).status, 403);

  const ownTaskRes = await aJson('POST', '/tasks', { title: 'Lead backlog', projectId: projA.id, estimatedHours: 2, week: '2026-08-17' });
  assert.strictEqual(ownTaskRes.status, 201);
  const ownTask = await ownTaskRes.json();
  assert.strictEqual((await aJson('PUT', `/tasks/${ownTask.id}`, { assigneeId: memA.id })).status, 200); // claim into team OK
  assert.strictEqual((await aJson('PUT', `/tasks/${ownTask.id}`, { assigneeId: null })).status, 200); // creator may unassign

  // --- Attach account is boss-only ---
  const bare = await (await json('POST', '/people', { name: 'Bare Person', team: 'AlphaL', role: 'member', managerId: leadA.id })).json();
  assert.strictEqual((await aJson('POST', '/auth/register', { email: 'sneaky@capa.test', personId: bare.id })).status, 403);
  assert.strictEqual((await json('POST', '/auth/register', { email: 'bare@capa.test', personId: bare.id })).status, 201);
  assert.strictEqual((await json('POST', '/auth/register', { email: 'bare2@capa.test', personId: bare.id })).status, 409);

  // Person with a linked account cannot be deleted via /people (must use Users page)
  assert.strictEqual((await json('DELETE', `/people/${bare.id}`)).status, 409);

  // Chunk scope: only the owning lead manages chunks
  const parentTask = await (await aJson('POST', '/tasks', { title: 'Parent for chunk', projectId: projA.id, assigneeId: leadA.id, estimatedHours: 8, week: '2026-08-24' })).json();
  const chunk = await (await aJson('POST', '/tasks', { title: 'Chunk one', parentId: parentTask.id, assigneeId: memA.id, estimatedHours: 3, week: '2026-08-24' })).json();
  assert.strictEqual(chunk.parentId, parentTask.id);
  const aTasksNow = await (await aReq('/tasks')).json();
  const chunkRow = aTasksNow.find(t => t.id === chunk.id);
  assert.strictEqual(chunkRow.parentAssigneeId, leadA.id); // enrichment drives UI permissions
  const lbReq = mkAuthed(await loginAs('leadB@capa.test'));
  assert.strictEqual((await lbReq(`/tasks/${chunk.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'completed' }) })).status, 403);
  assert.strictEqual((await aJson('PUT', `/tasks/${chunk.id}`, { status: 'in_progress' })).status, 200); // owning lead OK

  // Boss team change cascades to the target's subtree
  await json('PUT', `/people/${leadA.id}`, { team: 'AlphaL Renamed' });
  const everyone = await (await json('GET', '/people')).json();
  const memARow = everyone.find(p => p.id === memA.id);
  assert.strictEqual(memARow.team, 'AlphaL Renamed');
});

test('member visibility: team subtree, no backlog, cross-team isolation, solo member, write walls', async () => {
  const leadJ = await (await json('POST', '/people', { name: 'Lead J', team: 'TeamJ', weeklyCapacity: 40, role: 'lead' })).json();
  const aditi = await (await json('POST', '/people', { name: 'Aditi M', team: 'TeamJ', weeklyCapacity: 40, role: 'member', managerId: leadJ.id })).json();
  const bobM = await (await json('POST', '/people', { name: 'Bob M', team: 'TeamJ', weeklyCapacity: 40, role: 'member', managerId: leadJ.id })).json();
  const leadS = await (await json('POST', '/people', { name: 'Lead S', team: 'TeamS', weeklyCapacity: 40, role: 'lead' })).json();
  await json('POST', '/people', { name: 'Tom S', team: 'TeamS', weeklyCapacity: 30, role: 'member', managerId: leadS.id });
  const soloP = await (await json('POST', '/people', { name: 'Priya Solo', team: 'TeamSolo', weeklyCapacity: 25, role: 'member' })).json();

  const projJ = await (await json('POST', '/projects', { name: 'Proj J', ownerId: leadJ.id })).json();
  const projS = await (await json('POST', '/projects', { name: 'Proj S', ownerId: leadS.id })).json();

  const pool = getPool();
  const hash = await bcrypt.hash('member-pass-123', 10);
  await pool.query('INSERT INTO users (id, email, password_hash, role, person_id) VALUES ($1,$2,$3,$4,$5)', ['u-adi', 'aditi@capa.test', hash, 'engineer', aditi.id]);
  await pool.query('INSERT INTO users (id, email, password_hash, role, person_id) VALUES ($1,$2,$3,$4,$5)', ['u-solo2', 'priya@capa.test', hash, 'engineer', soloP.id]);
  await pool.query('INSERT INTO users (id, email, password_hash, role, person_id) VALUES ($1,$2,$3,$4,$5)', ['u-lj', 'leadj@capa.test', hash, 'lead', leadJ.id]);

  const loginAs = async (email) => {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'member-pass-123' })
    });
    assert.strictEqual(res.status, 200);
    return (await res.json()).token;
  };
  const mkAuthed = (t) => (pathname, opts = {}) => fetch(`${base}${pathname}`, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: `Bearer ${t}` }
  });
  const adi = mkAuthed(await loginAs('aditi@capa.test'));
  const adiJson = (method, pathname, body) => adi(pathname, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const solo = mkAuthed(await loginAs('priya@capa.test'));
  const lj = mkAuthed(await loginAs('leadj@capa.test'));
  const ljJson = (method, pathname, body) => lj(pathname, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  // Team data — Lead J assigns to their own members (boss cannot target managed members)
  const tA = await (await ljJson('POST', '/tasks', { title: 'Aditi task', projectId: projJ.id, assigneeId: aditi.id, estimatedHours: 5, week: '2026-09-07' })).json();
  const tB = await (await ljJson('POST', '/tasks', { title: 'Bob task', projectId: projJ.id, assigneeId: bobM.id, estimatedHours: 4, week: '2026-09-07' })).json();
  await json('POST', '/tasks', { title: 'Team backlog', projectId: projJ.id, assigneeId: null, estimatedHours: 2, week: '2026-09-07' });
  await json('POST', '/tasks', { title: 'Tom task', projectId: projS.id, assigneeId: leadS.id, estimatedHours: 1, week: '2026-09-07' });

  // People/teams scoping
  const adiPeople = await (await adi('/people')).json();
  assert.deepStrictEqual(adiPeople.map(p => p.id).sort(), [leadJ.id, aditi.id, bobM.id].sort());
  const adiTeams = await (await adi('/teams')).json();
  assert.deepStrictEqual(adiTeams, ['TeamJ']);

  // Tasks: own + teammates only; no backlog, no cross-team
  const adiTasks = await (await adi('/tasks')).json();
  const titles = adiTasks.map(t => t.title).sort();
  assert.deepStrictEqual(titles, ['Aditi task', 'Bob task']);

  // Projects: referenced-by-team + owned only
  const adiProjects = await (await adi('/projects')).json();
  assert.ok(adiProjects.some(p => p.id === projJ.id));
  assert.ok(!adiProjects.some(p => p.id === projS.id));

  // Write walls
  assert.strictEqual((await adiJson('POST', '/tasks', { title: 'Nope', projectId: projJ.id, assigneeId: aditi.id, estimatedHours: 1, week: '2026-09-07' })).status, 403);
  assert.strictEqual((await adiJson('DELETE', `/tasks/${tA.id}`)).status, 403);
  assert.strictEqual((await adiJson('PUT', `/tasks/${tB.id}`, { status: 'completed' })).status, 403); // teammate's task
  assert.strictEqual((await adiJson('PUT', `/tasks/${tA.id}`, { title: 'hack' })).status, 403); // non-status edit on own
  assert.strictEqual((await adiJson('PUT', `/people/${bobM.id}`, { weeklyCapacity: 99 })).status, 403);
  assert.strictEqual((await adiJson('DELETE', `/people/${bobM.id}`)).status, 403);
  assert.strictEqual((await adiJson('PUT', `/projects/${projJ.id}`, { description: 'x' })).status, 403);
  assert.strictEqual((await adiJson('DELETE', `/projects/${projJ.id}`)).status, 403);

  // Own-task status update + single-source sync to Lead and Boss
  assert.strictEqual((await adiJson('PUT', `/tasks/${tA.id}`, { status: 'in_progress' })).status, 200);
  const ljTasks = await (await lj('/tasks')).json();
  assert.strictEqual(ljTasks.find(t => t.id === tA.id).status, 'in_progress');
  const bossTasks = await (await json('GET', '/tasks')).json();
  assert.strictEqual(bossTasks.find(t => t.id === tA.id).status, 'in_progress');

  // Solo member: personal-only scope
  const soloPeople = await (await solo('/people')).json();
  assert.deepStrictEqual(soloPeople.map(p => p.id), [soloP.id]);
  await json('POST', '/tasks', { title: 'Priya own', projectId: projJ.id, assigneeId: soloP.id, estimatedHours: 2, week: '2026-09-14' });
  const soloTasks = await (await solo('/tasks')).json();
  assert.deepStrictEqual(soloTasks.map(t => t.title), ['Priya own']);
  const soloTeams = await (await solo('/teams')).json();
  assert.deepStrictEqual(soloTeams, ['TeamSolo']);
});

// ---------- Org hierarchy ----------
test('people roles: valid lead/member/solo hierarchies', async () => {
  const lead = await json('POST', '/people', { name: 'Lead One', team: 'Omega', weeklyCapacity: 40, role: 'lead' });
  assert.strictEqual(lead.status, 201);
  const leadBody = await lead.json();
  assert.strictEqual(leadBody.role, 'lead');
  assert.strictEqual(leadBody.managerId, null);

  const member = await json('POST', '/people', { name: 'Member One', team: 'Omega', weeklyCapacity: 40, role: 'member', managerId: leadBody.id });
  assert.strictEqual(member.status, 201);
  assert.strictEqual((await member.json()).managerId, leadBody.id);

  const solo = await json('POST', '/people', { name: 'Solo One', team: 'Omega', weeklyCapacity: 40 });
  assert.strictEqual(solo.status, 201);
  const soloBody = await solo.json();
  assert.strictEqual(soloBody.role, 'member');
  assert.strictEqual(soloBody.managerId, null);

  const people = await (await request('/people')).json();
  assert.strictEqual(people.find(p => p.id === leadBody.id).role, 'lead');
});

test('people roles: invalid hierarchies are rejected', async () => {
  const m1 = await (await json('POST', '/people', { name: 'Member A', team: 'Omega', weeklyCapacity: 40 })).json();
  const m2 = await (await json('POST', '/people', { name: 'Member B', team: 'Omega', weeklyCapacity: 40 })).json();

  assert.strictEqual((await json('POST', '/people', { name: 'Bad Lead', team: 'Omega', role: 'lead', managerId: m1.id })).status, 400);
  assert.strictEqual((await json('POST', '/people', { name: 'Bad Member', team: 'Omega', role: 'member', managerId: m2.id })).status, 400);
  assert.strictEqual((await json('POST', '/people', { name: 'Ghost Manager', team: 'Omega', role: 'member', managerId: 'nope' })).status, 400);
  assert.strictEqual((await json('POST', '/people', { name: 'Bad Role', team: 'Omega', role: 'admin' })).status, 400);
  assert.strictEqual((await json('PUT', `/people/${m1.id}`, { managerId: m2.id })).status, 400);
});

test('people roles: lead demotion and deletion are guarded', async () => {
  const lead = await (await json('POST', '/people', { name: 'Demote Lead', team: 'Omega', role: 'lead' })).json();
  const follower = await (await json('POST', '/people', { name: 'Follower', team: 'Omega', role: 'member', managerId: lead.id })).json();

  assert.strictEqual((await json('PUT', `/people/${lead.id}`, { role: 'member' })).status, 400);
  assert.strictEqual((await request(`/people/${lead.id}`, { method: 'DELETE' })).status, 409);

  await json('PUT', `/people/${follower.id}`, { managerId: null });
  assert.strictEqual((await request(`/people/${lead.id}`, { method: 'DELETE' })).status, 200);
});

test('register syncs the account role to the person role', async () => {
  const lead = await (await json('POST', '/people', { name: 'Account Lead', team: 'Omega', role: 'lead' })).json();
  const created = await json('POST', '/auth/register', {
    email: 'accountlead@capa.test',
    password: 'account-lead-123',
    role: 'engineer',
    personId: lead.id
  });
  assert.strictEqual(created.status, 201);
  assert.strictEqual((await created.json()).role, 'lead');

  const member = await (await json('POST', '/people', { name: 'Account Member', team: 'Omega' })).json();
  assert.strictEqual((await json('POST', '/auth/register', { email: 'accountmember@capa.test', password: 'account-member-123', role: 'lead', personId: member.id })).status, 400);
});

// ---------- Boss delegation rules ----------
test('boss delegation: tasks can be assigned to leads and solo members only', async () => {
  const lead = await (await json('POST', '/people', { name: 'Delegation Lead', team: 'Omega', role: 'lead' })).json();
  const member = await (await json('POST', '/people', { name: 'Delegation Member', team: 'Omega', role: 'member', managerId: lead.id })).json();
  const solo = await (await json('POST', '/people', { name: 'Delegation Solo', team: 'Omega' })).json();

  const toLead = await json('POST', '/tasks', { title: 'To lead', projectId: 'pr-1', assigneeId: lead.id, estimatedHours: 5, week: '2026-08-10' });
  assert.strictEqual(toLead.status, 201);

  const toSolo = await json('POST', '/tasks', { title: 'To solo', projectId: 'pr-1', assigneeId: solo.id, estimatedHours: 5, week: '2026-08-10' });
  assert.strictEqual(toSolo.status, 201);

  const toMember = await json('POST', '/tasks', { title: 'To member', projectId: 'pr-1', assigneeId: member.id, estimatedHours: 5, week: '2026-08-10' });
  assert.strictEqual(toMember.status, 403);

  const reassigned = await json('PUT', '/tasks/t-1', { assigneeId: member.id });
  assert.strictEqual(reassigned.status, 403);

  const reassignedOk = await json('PUT', '/tasks/t-1', { assigneeId: lead.id });
  assert.strictEqual(reassignedOk.status, 200);

  const metaOnly = await json('PUT', '/tasks/t-1', { title: 'Renamed by boss' });
  assert.strictEqual(metaOnly.status, 200);
});

// ---------- Lead delegation: parent tasks & chunks ----------
test('lead delegation: parent tasks can be broken into chunks (one level)', async () => {
  const lead = await (await json('POST', '/people', { name: 'Chunk Lead', team: 'Omega', role: 'lead' })).json();
  const m1 = await (await json('POST', '/people', { name: 'Chunk Member One', team: 'Omega', role: 'member', managerId: lead.id })).json();
  const otherLead = await (await json('POST', '/people', { name: 'Other Chunk Lead', team: 'Omega', role: 'lead' })).json();
  const otherMember = await (await json('POST', '/people', { name: 'Other Chunk Member', team: 'Omega', role: 'member', managerId: otherLead.id })).json();
  const solo = await (await json('POST', '/people', { name: 'Chunk Solo', team: 'Omega' })).json();

  const parentRes = await json('POST', '/tasks', { title: 'Build E-Commerce', projectId: 'pr-1', assigneeId: lead.id, estimatedHours: 30, week: '2026-08-10' });
  assert.strictEqual(parentRes.status, 201);
  const parent = await parentRes.json();

  const pool = getPool();
  const hash = await bcrypt.hash('chunk-pass-123', 10);
  await pool.query(
    'INSERT INTO users (id, email, password_hash, role, person_id) VALUES ($1,$2,$3,$4,$5)',
    ['u-chunk-lead', 'chunklead@capa.test', hash, 'lead', lead.id]
  );
  const login = await apiFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'chunklead@capa.test', password: 'chunk-pass-123' })
  });
  const leadToken = (await login.json()).token;
  const leadReq = (pathname, opts = {}) => fetch(`${base}${pathname}`, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: `Bearer ${leadToken}` }
  });
  const leadJson = (method, pathname, body) => leadReq(pathname, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const c1 = await leadJson('POST', '/tasks', { title: 'Login UI', parentId: parent.id, assigneeId: m1.id, estimatedHours: 8, week: '2026-08-10' });
  assert.strictEqual(c1.status, 201);
  const chunk1 = await c1.json();
  assert.strictEqual(chunk1.parentId, parent.id);
  assert.strictEqual(chunk1.projectId, 'pr-1');

  assert.strictEqual((await leadJson('POST', '/tasks', { title: 'API Integration', parentId: parent.id, assigneeId: lead.id, estimatedHours: 6, week: '2026-08-10' })).status, 201);

  assert.strictEqual((await leadJson('POST', '/tasks', { title: 'Bad other member', parentId: parent.id, assigneeId: otherMember.id, estimatedHours: 5, week: '2026-08-10' })).status, 403);
  assert.strictEqual((await leadJson('POST', '/tasks', { title: 'Bad other lead', parentId: parent.id, assigneeId: otherLead.id, estimatedHours: 5, week: '2026-08-10' })).status, 403);
  assert.strictEqual((await leadJson('POST', '/tasks', { title: 'Bad solo', parentId: parent.id, assigneeId: solo.id, estimatedHours: 5, week: '2026-08-10' })).status, 403);
  assert.strictEqual((await leadJson('POST', '/tasks', { title: 'Bad no assignee', parentId: parent.id, assigneeId: null, estimatedHours: 5, week: '2026-08-10' })).status, 400);
  assert.strictEqual((await leadJson('POST', '/tasks', { title: 'Bad grandchild', parentId: chunk1.id, assigneeId: m1.id, estimatedHours: 5, week: '2026-08-10' })).status, 400);
  assert.strictEqual((await leadJson('POST', '/tasks', { title: 'Bad parent owner', parentId: 't-1', assigneeId: m1.id, estimatedHours: 5, week: '2026-08-10' })).status, 403);
  assert.strictEqual((await json('POST', '/tasks', { title: 'Bad boss chunk', parentId: parent.id, assigneeId: lead.id, estimatedHours: 5, week: '2026-08-10' })).status, 403);

  const tasks = await (await leadReq('/tasks')).json();
  assert.strictEqual(tasks.find(t => t.id === chunk1.id).parentTitle, 'Build E-Commerce');

  assert.strictEqual((await leadJson('PUT', `/tasks/${chunk1.id}`, { assigneeId: otherMember.id })).status, 403);
  assert.strictEqual((await leadJson('PUT', `/tasks/${chunk1.id}`, { assigneeId: lead.id })).status, 200);
  assert.strictEqual((await json('PUT', `/tasks/${chunk1.id}`, { assigneeId: lead.id })).status, 403);
  assert.strictEqual((await json('PUT', `/tasks/${chunk1.id}`, { parentId: parent.id })).status, 400);

  assert.strictEqual((await request(`/tasks/${parent.id}`, { method: 'DELETE' })).status, 409);
  assert.strictEqual((await request(`/tasks/${chunk1.id}`, { method: 'DELETE' })).status, 200);

  const report = await (await request('/reports/load?granularity=week&from=2026-08-10&to=2026-08-10&team=Omega')).json();
  const leadRow = report.people.find(p => p.id === lead.id);
  assert.strictEqual(leadRow.totalAssignedHours, 6); // 30h parent suppressed (has chunks); only the 6h self-chunk counts
});

// ---------- Delegation-aware capacity & reporting ----------
test('delegated capacity: parent hours suppressed, chunks count once for their assignee', async () => {
  const lead = await (await json('POST', '/people', { name: 'Calc Lead', team: 'Delta', role: 'lead' })).json();
  const m1 = await (await json('POST', '/people', { name: 'Calc Member One', team: 'Delta', role: 'member', managerId: lead.id })).json();
  const m2 = await (await json('POST', '/people', { name: 'Calc Member Two', team: 'Delta', role: 'member', managerId: lead.id })).json();

  const pool = getPool();
  const hash = await bcrypt.hash('calc-pass-123', 10);
  await pool.query(
    'INSERT INTO users (id, email, password_hash, role, person_id) VALUES ($1,$2,$3,$4,$5)',
    ['u-calc-lead', 'calclead@capa.test', hash, 'lead', lead.id]
  );
  const login = await apiFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'calclead@capa.test', password: 'calc-pass-123' })
  });
  const leadToken = (await login.json()).token;
  const leadReq = (pathname, opts = {}) => fetch(`${base}${pathname}`, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: `Bearer ${leadToken}` }
  });
  const leadJson = (method, pathname, body) => leadReq(pathname, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const getReport = async (qs) => (await (await request(`/reports/load${qs}`)).json());
  const row = (report, id) => report.people.find(p => p.id === id);
  const W1 = '2026-08-10';
  const W2 = '2026-08-17';

  const normal = await (await leadJson('POST', '/tasks', { title: 'Calc normal', projectId: 'pr-1', assigneeId: m1.id, estimatedHours: 10, week: W1 })).json();
  const parent = await (await json('POST', '/tasks', { title: 'Calc parent', projectId: 'pr-1', assigneeId: lead.id, estimatedHours: 30, week: W1 })).json();

  // 1 + 2: normal task counts; parent without chunks counts
  let report = await getReport(`?granularity=week&from=${W1}&to=${W2}&team=Delta`);
  assert.strictEqual(row(report, m1.id).totalAssignedHours, 10);
  assert.strictEqual(row(report, lead.id).totalAssignedHours, 30);

  // 3 + 5 + 7: first chunk -> parent suppressed entirely, M1 sums
  const chunk1 = await (await leadJson('POST', '/tasks', { title: 'Calc chunk one', parentId: parent.id, assigneeId: m1.id, estimatedHours: 8, week: W1 })).json();
  report = await getReport(`?granularity=week&from=${W1}&to=${W2}&team=Delta`);
  assert.strictEqual(row(report, lead.id).totalAssignedHours, 0); // parent contributes 0h
  assert.strictEqual(row(report, m1.id).totalAssignedHours, 18); // 10 + 8

  // 4 + 6: lead-assigned chunk counts for the lead, never double-counted
  const chunk2 = await (await leadJson('POST', '/tasks', { title: 'Calc chunk two', parentId: parent.id, assigneeId: lead.id, estimatedHours: 6, week: W1 })).json();
  report = await getReport(`?granularity=week&from=${W1}&to=${W2}&team=Delta`);
  assert.strictEqual(row(report, lead.id).totalAssignedHours, 6);
  assert.strictEqual(row(report, m1.id).totalAssignedHours, 18);

  // 14: chunk in a different week lands only in that bucket
  const chunk3 = await (await leadJson('POST', '/tasks', { title: 'Calc chunk three', parentId: parent.id, assigneeId: m1.id, estimatedHours: 5, week: W2 })).json();
  report = await getReport(`?granularity=week&from=${W1}&to=${W2}&team=Delta`);
  const m1W1 = row(report, m1.id).buckets.find(b => b.key === W1);
  const m1W2 = row(report, m1.id).buckets.find(b => b.key === W2);
  assert.strictEqual(m1W1.assignedHours, 18);
  assert.strictEqual(m1W2.assignedHours, 5);
  assert.strictEqual(row(report, lead.id).buckets.find(b => b.key === W2).assignedHours, 0);

  // 15: project filtering respects chunks (inherited project)
  const pr1 = await (await request('/reports/load?granularity=week&from=' + W1 + '&to=' + W2 + '&team=Delta&project=pr-1')).json();
  assert.strictEqual(row(pr1, m1.id).totalAssignedHours, 23);
  assert.strictEqual(row(pr1, lead.id).totalAssignedHours, 6);
  const pr2 = await (await request('/reports/load?granularity=week&from=' + W1 + '&to=' + W2 + '&team=Delta&project=pr-2')).json();
  assert.strictEqual(row(pr2, m1.id).totalAssignedHours, 0);
  assert.strictEqual(row(pr2, lead.id).totalAssignedHours, 0);

  // 13: overload uses delegated hours (6 + 40 = 46 > 40)
  await json('POST', '/tasks', { title: 'Calc overload', projectId: 'pr-1', assigneeId: lead.id, estimatedHours: 40, week: W1 });
  report = await getReport(`?granularity=week&from=${W1}&to=${W2}&team=Delta`);
  const leadRow = row(report, lead.id);
  assert.strictEqual(leadRow.totalAssignedHours, 46);
  assert.strictEqual(leadRow.overloaded, true);

  // 16 + 17: team totals equal per-person bucket sums (dashboard reads the same payload)
  report = await getReport(`?granularity=week&from=${W1}&to=${W2}&team=Delta`);
  for (const bucket of report.buckets) {
    const perPerson = report.people.reduce((s, p) => s + (p.buckets.find(b => b.key === bucket)?.assignedHours || 0), 0);
    assert.strictEqual(perPerson, report.teamTotals.find(b => b.key === bucket).assignedHours);
  }
  const allAssigned = report.people.reduce((s, p) => s + p.totalAssignedHours, 0);
  const teamTotalsSum = report.teamTotals.reduce((s, b) => s + b.assignedHours, 0);
  assert.strictEqual(allAssigned, teamTotalsSum);

  // 10: deleting a chunk updates load immediately
  assert.strictEqual((await request(`/tasks/${chunk3.id}`, { method: 'DELETE' })).status, 200);
  report = await getReport(`?granularity=week&from=${W1}&to=${W2}&team=Delta`);
  assert.strictEqual(row(report, m1.id).buckets.find(b => b.key === W2).assignedHours, 0);
  assert.strictEqual(row(report, m1.id).totalAssignedHours, 18);

  // 11: parent with chunks still cannot be deleted
  assert.strictEqual((await request(`/tasks/${parent.id}`, { method: 'DELETE' })).status, 409);

  // 12: after all chunks are gone, the parent counts again
  assert.strictEqual((await request(`/tasks/${chunk1.id}`, { method: 'DELETE' })).status, 200);
  assert.strictEqual((await request(`/tasks/${chunk2.id}`, { method: 'DELETE' })).status, 200);
  report = await getReport(`?granularity=week&from=${W1}&to=${W2}&team=Delta`);
  assert.strictEqual(row(report, lead.id).totalAssignedHours, 70); // 30 parent revived + 40 overload

  // month granularity applies the same rule
  const month = await getReport(`?granularity=month&from=2026-08&to=2026-08&team=Delta`);
  assert.strictEqual(row(month, m1.id).totalAssignedHours, 10); // chunks were deleted; only the normal task remains
  assert.strictEqual(row(month, lead.id).totalAssignedHours, 70);
});

test('profile update: boss edits own name and email, role cannot be changed', async () => {
  const patch = (body) => request('/auth/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  // name update -> displayName set, person record untouched
  const nameRes = await patch({ name: 'Zara Nova' });
  assert.strictEqual(nameRes.status, 200);
  const afterName = await nameRes.json();
  assert.strictEqual(afterName.displayName, 'Zara Nova');
  assert.strictEqual(afterName.personName, 'Zara');

  const peopleRes = await request('/people');
  const zara = (await peopleRes.json()).find(p => p.id === 'p-9');
  assert.strictEqual(zara.name, 'Zara');

  // me reflects displayName
  const meRes = await request('/auth/me');
  const me = await meRes.json();
  assert.strictEqual(me.displayName, 'Zara Nova');

  // email update -> new email logs in, old email no longer works
  const emailRes = await patch({ email: 'boss2@capa.test' });
  assert.strictEqual(emailRes.status, 200);
  const afterEmail = await emailRes.json();
  assert.strictEqual(afterEmail.email, 'boss2@capa.test');

  const newLogin = await apiFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'boss2@capa.test', password: BOSS_PASSWORD })
  });
  assert.strictEqual(newLogin.status, 200);
  assert.strictEqual((await newLogin.json()).user.email, 'boss2@capa.test');

  const oldLogin = await apiFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: BOSS_EMAIL, password: BOSS_PASSWORD })
  });
  assert.strictEqual(oldLogin.status, 401);

  // duplicate email -> 409
  const dup = await patch({ email: 'engineer@capa.test' });
  assert.strictEqual(dup.status, 409);

  // role cannot be changed
  assert.strictEqual((await patch({ role: 'lead' })).status, 400);
  assert.strictEqual((await patch({ role: 'boss', name: 'X' })).status, 400);

  // validation
  assert.strictEqual((await patch({ name: '   ' })).status, 400);
  assert.strictEqual((await patch({ email: 'not-an-email' })).status, 400);
  assert.strictEqual((await patch({})).status, 400);

  // self-only: no other user is affected
  const usersRes = await request('/auth/users');
  const users = await usersRes.json();
  const engineer = users.find(u => u.email === 'engineer@capa.test');
  assert.strictEqual(engineer.displayName, null);
  assert.strictEqual(engineer.email, 'engineer@capa.test');
});

test('password change: verifies current password, hashes new one, never leaks the hash', async () => {
  const patchPass = (body) => request('/auth/password', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const loginAs = (email, password) => apiFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  // wrong current password -> rejected, login still works with the old password
  assert.strictEqual((await patchPass({ currentPassword: 'wrong-password', newPassword: 'new-secret-123' })).status, 400);
  const stillOld = await loginAs('boss2@capa.test', BOSS_PASSWORD);
  assert.strictEqual(stillOld.status, 200);

  // validation
  assert.strictEqual((await patchPass({ currentPassword: BOSS_PASSWORD, newPassword: 'short' })).status, 400);
  assert.strictEqual((await patchPass({})).status, 400);

  // successful change; new password works, old one no longer does
  const ok = await patchPass({ currentPassword: BOSS_PASSWORD, newPassword: 'new-secret-123' });
  assert.strictEqual(ok.status, 200);
  const body = await ok.json();
  assert.strictEqual(body.message, 'Password changed successfully.');
  assert.ok(!('password_hash' in body));

  const newLogin = await loginAs('boss2@capa.test', 'new-secret-123');
  assert.strictEqual(newLogin.status, 200);
  const newBody = await newLogin.json();
  assert.ok(!('password_hash' in newBody.user));

  const oldLogin = await loginAs('boss2@capa.test', BOSS_PASSWORD);
  assert.strictEqual(oldLogin.status, 401);

  // stored hash is a bcrypt hash, not plaintext
  const { rows } = await getPool().query('SELECT password_hash FROM users WHERE id = $1', ['u-boss']);
  assert.ok(rows[0].password_hash.startsWith('$2'));
  assert.notStrictEqual(rows[0].password_hash, 'new-secret-123');

  // other users unaffected
  const engLogin = await loginAs('engineer@capa.test', 'engineer-pass-123');
  assert.strictEqual(engLogin.status, 200);
});
