const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { Pool } = require('pg');

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
    { id: 'p-2', name: 'Bob', team: 'Beta', weeklyCapacity: 40 }
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

const app = require('../app');

let server;
let base;

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

  server = app.listen(0);
  await new Promise(resolve => server.on('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  server.close();
  await getPool().end();

  const admin = new Pool({ connectionString: ADMIN_URL });
  await admin.query('DROP DATABASE IF EXISTS capa_test WITH (FORCE)');
  await admin.end();
});

const api = (pathname, opts) => fetch(`${base}${pathname}`, opts);
const json = (method, pathname, body) => api(pathname, {
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

// ---------- People ----------
test('GET /api/people returns seeded people', async () => {
  const res = await api('/people');
  assert.strictEqual(res.status, 200);
  const people = await res.json();
  assert.strictEqual(people.length, 2);
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

test('DELETE /api/people/:id blocks deletion while tasks are assigned', async () => {
  const blocked = await api('/people/p-1', { method: 'DELETE' });
  assert.strictEqual(blocked.status, 409);

  const ok = await json('POST', '/people', { name: 'Tmp', team: 'Tmp' });
  const tmp = await ok.json();
  const deleted = await api(`/people/${tmp.id}`, { method: 'DELETE' });
  assert.strictEqual(deleted.status, 200);

  const again = await api(`/people/${tmp.id}`, { method: 'DELETE' });
  assert.strictEqual(again.status, 404);
});

// ---------- Projects ----------
test('GET /api/projects and POST create; DELETE rules', async () => {
  const list = await api('/projects');
  assert.strictEqual((await list.json()).length, 2);

  const created = await json('POST', '/projects', { name: 'New Site' });
  assert.strictEqual(created.status, 201);
  const project = await created.json();

  const missingName = await json('POST', '/projects', { name: '' });
  assert.strictEqual(missingName.status, 400);

  const unused = await api(`/projects/${project.id}`, { method: 'DELETE' });
  assert.strictEqual(unused.status, 200);

  const inUse = await api('/projects/pr-1', { method: 'DELETE' });
  assert.strictEqual(inUse.status, 409);
});

// ---------- Tasks ----------
test('GET /api/tasks joins assignee and project names', async () => {
  const res = await api('/tasks');
  const tasks = await res.json();
  const t1 = tasks.find(t => t.id === 't-1');
  assert.strictEqual(t1.assigneeName, 'Alice');
  assert.strictEqual(t1.projectName, 'Web App');
});

test('POST /api/tasks validates and normalizes the week to Monday', async () => {
  const res = await json('POST', '/tasks', {
    title: 'Landing page',
    projectId: 'pr-1',
    assigneeId: 'p-2',
    estimatedHours: 12,
    week: '2026-08-16'
  });
  assert.strictEqual(res.status, 201);
  const task = await res.json();
  assert.strictEqual(task.week, '2026-08-10');
  await api(`/tasks/${task.id}`, { method: 'DELETE' });

  assert.strictEqual((await json('POST', '/tasks', { title: 'X', projectId: 'pr-1', assigneeId: 'p-2', estimatedHours: 0, week: '2026-08-10' })).status, 400);
  assert.strictEqual((await json('POST', '/tasks', { title: 'X', projectId: 'pr-1', assigneeId: 'p-2', estimatedHours: 4, week: 'not-a-date' })).status, 400);
  assert.strictEqual((await json('POST', '/tasks', { title: 'X', projectId: 'missing', assigneeId: 'p-2', estimatedHours: 4, week: '2026-08-10' })).status, 400);
  assert.strictEqual((await json('POST', '/tasks', { title: 'X', projectId: 'pr-1', assigneeId: 'missing', estimatedHours: 4, week: '2026-08-10' })).status, 400);
});

test('GET /api/reports/load computes weekly hours vs capacity and filters', async () => {
  const res = await api('/reports/load?granularity=week&from=2026-08-03&to=2026-08-17');
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

  const teamFiltered = await (await api('/reports/load?from=2026-08-03&to=2026-08-17&team=Alpha')).json();
  assert.strictEqual(teamFiltered.people.length, 1);
  assert.strictEqual(teamFiltered.people[0].name, 'Alice');

  const projectFiltered = await (await api('/reports/load?from=2026-08-03&to=2026-08-17&project=pr-1')).json();
  const aliceFiltered = projectFiltered.people.find(p => p.name === 'Alice');
  assert.deepStrictEqual(aliceFiltered.buckets.map(b => b.assignedHours), [10, 45, 0]);
  assert.strictEqual(aliceFiltered.totalAssignedHours, 55);
});

test('GET /api/reports/load month granularity uses weekly capacity x weeks', async () => {
  const res = await api('/reports/load?granularity=month&from=2026-08&to=2026-08');
  const report = await res.json();
  assert.deepStrictEqual(report.buckets, ['2026-08']);
  const alice = report.people.find(p => p.name === 'Alice');
  assert.strictEqual(alice.buckets[0].assignedHours, 61);
  assert.strictEqual(alice.buckets[0].capacityHours, 200); // 5 Mondays in Aug 2026 x 40h
  assert.strictEqual(alice.overloaded, false);
});

test('PUT /api/tasks/:id reassigns tasks between people', async () => {
  const res = await json('PUT', '/tasks/t-1', { assigneeId: 'p-2' });
  assert.strictEqual(res.status, 200);
  const updated = await (await api('/tasks')).json();
  assert.strictEqual(updated.find(t => t.id === 't-1').assigneeName, 'Bob');

  const missing = await json('PUT', '/tasks/nope', { assigneeId: 'p-2' });
  assert.strictEqual(missing.status, 404);

  const invalid = await json('PUT', '/tasks/t-1', { assigneeId: 'ghost' });
  assert.strictEqual(invalid.status, 400);
});

test('DELETE /api/tasks/:id and teams endpoint', async () => {
  const created = await json('POST', '/tasks', { title: 'Temp', projectId: 'pr-2', assigneeId: null, estimatedHours: 2, week: '2026-08-10' });
  const task = await created.json();
  const deleted = await api(`/tasks/${task.id}`, { method: 'DELETE' });
  assert.strictEqual(deleted.status, 200);

  const teams = await (await api('/teams')).json();
  assert.deepStrictEqual(teams, ['Alpha', 'Beta', 'Gamma']);

  const unknown = await api('/nope');
  assert.strictEqual(unknown.status, 404);
});

test('DELETE /api/people allows deletion once tasks are unassigned', async () => {
  await json('PUT', '/tasks/t-2', { assigneeId: null });
  await json('PUT', '/tasks/t-4', { assigneeId: null });
  const deleted = await api('/people/p-1', { method: 'DELETE' });
  assert.strictEqual(deleted.status, 200);
  const people = await (await api('/people')).json();
  assert.ok(!people.some(p => p.id === 'p-1'));
});
