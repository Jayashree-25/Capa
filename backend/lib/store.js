const { getPool } = require('./db');

const loadData = async () => {
  const pool = getPool();
  const [peopleRes, projectsRes, tasksRes] = await Promise.all([
    pool.query(`
      SELECT id, name, team, weekly_capacity AS "weeklyCapacity", manager_id AS "managerId", role
      FROM people
      ORDER BY name
    `),
    pool.query(`
      SELECT pr.id, pr.name, pr.owner_id AS "ownerId", p.name AS "ownerName"
      FROM projects pr
      LEFT JOIN people p ON p.id = pr.owner_id
      ORDER BY pr.name
    `),
    pool.query(`
      SELECT id, title, project_id AS "projectId", assignee_id AS "assigneeId",
             estimated_hours AS "estimatedHours", to_char(week, 'YYYY-MM-DD') AS week,
             parent_id AS "parentId"
      FROM tasks
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
        INSERT INTO people (id, name, team, weekly_capacity, manager_id, role)
        VALUES ($1, $2, $3, $4, NULL, $5)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          team = EXCLUDED.team,
          weekly_capacity = EXCLUDED.weekly_capacity,
          manager_id = NULL,
          role = EXCLUDED.role
      `, [p.id, p.name, p.team, p.weeklyCapacity, p.role || 'member']);
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
        INSERT INTO projects (id, name, owner_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, owner_id = EXCLUDED.owner_id
      `, [pr.id, pr.name, pr.ownerId ?? null]);
    }

    for (const t of data.tasks || []) {
      await client.query(`
        INSERT INTO tasks (id, title, project_id, assignee_id, estimated_hours, week, parent_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          project_id = EXCLUDED.project_id,
          assignee_id = EXCLUDED.assignee_id,
          estimated_hours = EXCLUDED.estimated_hours,
          week = EXCLUDED.week,
          parent_id = EXCLUDED.parent_id
      `, [t.id, t.title, t.projectId, t.assigneeId ?? null, t.estimatedHours, t.week, t.parentId ?? null]);
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
