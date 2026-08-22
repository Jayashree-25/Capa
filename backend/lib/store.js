const { getPool } = require('./db');

const loadData = async () => {
  const pool = getPool();
  const [peopleRes, projectsRes, tasksRes] = await Promise.all([
    pool.query(`
      SELECT id, name, team, weekly_capacity AS "weeklyCapacity", manager_id AS "managerId", role, status
      FROM people
      ORDER BY name
    `),
    pool.query(`
      SELECT pr.id, pr.name, pr.description, pr.owner_id AS "ownerId", pr.status,
             p.name AS "ownerName", p.role AS "ownerRole", p.team AS "ownerTeam"
      FROM projects pr
      LEFT JOIN people p ON p.id = pr.owner_id
      ORDER BY pr.name
    `),
    pool.query(`
      SELECT t.id, t.title, t.project_id AS "projectId", t.assignee_id AS "assigneeId",
             t.estimated_hours AS "estimatedHours", to_char(t.week, 'YYYY-MM-DD') AS week,
             t.parent_id AS "parentId", t.status,
             t.created_by AS "createdBy", c.name AS "createdByName"
      FROM tasks t
      LEFT JOIN people c ON c.id = t.created_by
    `)
  ]);
  return {
    people: peopleRes.rows,
    projects: projectsRes.rows,
    tasks: tasksRes.rows
  };
};

const saveData = async (data) => {
  const pool = getPool();
  const client = await pool.connect();
  const ids = (arr, key) => (arr || [])
    .map(item => item[key])
    .filter(id => id !== undefined && id !== null);
  const taskIds = ids(data.tasks, 'id');
  const peopleIds = ids(data.people, 'id');
  const projectIds = ids(data.projects, 'id');

  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM tasks WHERE id <> ALL($1::text[])', [taskIds]);
    await client.query('DELETE FROM people WHERE id <> ALL($1::text[])', [peopleIds]);
    await client.query('DELETE FROM projects WHERE id <> ALL($1::text[])', [projectIds]);

    for (const p of data.people || []) {
      await client.query(`
        INSERT INTO people (id, name, team, weekly_capacity, manager_id, role, status)
        VALUES ($1, $2, $3, $4, NULL, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          team = EXCLUDED.team,
          weekly_capacity = EXCLUDED.weekly_capacity,
          manager_id = NULL,
          role = EXCLUDED.role,
          status = EXCLUDED.status
      `, [p.id, p.name, p.team, p.weeklyCapacity, p.role || 'member', p.status || 'active']);
    }

    for (const p of data.people || []) {
      if (!p.managerId) continue;
      await client.query(
        'UPDATE people SET manager_id = $1 WHERE id = $2',
        [p.managerId, p.id]
      );
    }

    for (const pr of data.projects || []) {
      await client.query(`
        INSERT INTO projects (id, name, description, owner_id, status)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, owner_id = EXCLUDED.owner_id, status = EXCLUDED.status
      `, [pr.id, pr.name, pr.description ?? '', pr.ownerId ?? null, pr.status || 'active']);
    }

    for (const t of data.tasks || []) {
      await client.query(`
        INSERT INTO tasks (id, title, project_id, assignee_id, estimated_hours, week, parent_id, status, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          project_id = EXCLUDED.project_id,
          assignee_id = EXCLUDED.assignee_id,
          estimated_hours = EXCLUDED.estimated_hours,
          week = EXCLUDED.week,
          parent_id = EXCLUDED.parent_id,
          status = EXCLUDED.status,
          created_by = EXCLUDED.created_by
      `, [t.id, t.title, t.projectId, t.assigneeId ?? null, t.estimatedHours, t.week, t.parentId ?? null, t.status || 'todo', t.createdBy ?? null]);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { loadData, saveData };
