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
  assert.deepStrictEqual(engPeople.map(p => p.id), [empA.id]);

  const engTasks = await (await engReq('/tasks')).json();
  assert.strictEqual(engTasks.length, 1);
  assert.strictEqual(engTasks[0].title, 'EmpA task');

  const leadReport = await (await leadReq('/reports/load?granularity=week&from=2026-08-10&to=2026-08-10')).json();
  assert.deepStrictEqual(leadReport.people.map(p => p.id).sort(), [empA.id, empB.id, mgr.id].sort());
  const empArow = leadReport.people.find(p => p.id === empA.id);
  assert.strictEqual(empArow.buckets[0].assignedHours, 5);

  const leadTeams = await (await leadReq('/teams')).json();
  assert.deepStrictEqual(leadTeams, ['Omega']);

  assert.strictEqual((await engReq(`/tasks/${empBtask.id}`, { method: 'DELETE' })).status, 403);
  const engTasksAfter = await (await engReq('/tasks')).json();
  assert.ok(!engTasksAfter.some(t => t.id === empBtask.id));
  assert.strictEqual((await engReq(`/people/${mgr.id}`, { method: 'DELETE' })).status, 403);
  assert.strictEqual((await engReq('/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Hacked' }) })).status, 403);

  const ownTask = await engReq('/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Own', projectId: 'pr-1', assigneeId: empA.id, estimatedHours: 2, week: '2026-08-10' }) });
  assert.strictEqual(ownTask.status, 201);
  assert.strictEqual((await engReq('/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Other', projectId: 'pr-1', assigneeId: empB.id, estimatedHours: 2, week: '2026-08-10' }) })).status, 403);
  assert.strictEqual((await engReq(`/tasks/${empBtask.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assigneeId: empB.id }) })).status, 403);
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
