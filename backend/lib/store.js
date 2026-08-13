const { getPool } = require('./db');

const loadData = async () => {
  const pool = getPool();
  const [peopleRes, projectsRes, tasksRes] = await Promise.all([
    pool.query(`
      SELECT id, name, team, weekly_capacity AS "weeklyCapacity", manager_id AS "managerId"
      FROM people
      ORDER BY name
    `),
    pool.query('SELECT id, name FROM projects ORDER BY name'),
    pool.query(`
      SELECT id, title, project_id AS "projectId", assignee_id AS "assigneeId",
             estimated_hours AS "estimatedHours", to_char(week, 'YYYY-MM-DD') AS week
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
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM tasks');
    await client.query('DELETE FROM people');
    await client.query('DELETE FROM projects');

    for (const p of data.people || []) {
      await client.query(`
        INSERT INTO people (id, name, team, weekly_capacity, manager_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          team = EXCLUDED.team,
          weekly_capacity = EXCLUDED.weekly_capacity,
          manager_id = EXCLUDED.manager_id
      `, [p.id, p.name, p.team, p.weeklyCapacity, p.managerId ?? null]);
    }

    for (const pr of data.projects || []) {
      await client.query(`
        INSERT INTO projects (id, name)
        VALUES ($1, $2)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
      `, [pr.id, pr.name]);
    }

    for (const t of data.tasks || []) {
      await client.query(`
        INSERT INTO tasks (id, title, project_id, assignee_id, estimated_hours, week)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [t.id, t.title, t.projectId, t.assigneeId ?? null, t.estimatedHours, t.week]);
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
