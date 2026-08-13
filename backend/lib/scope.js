const { getPool } = require('./db');

// Returns the person IDs a user is allowed to see.
// - boss: everything (returns null = "no restriction")
// - lead: themselves + everyone below them in the manager tree
// - engineer: themselves only
const getVisiblePersonIds = async (user) => {
  if (user.role === 'boss') return null;
  if (!user.personId) return [];

  const { rows } = await getPool().query('SELECT id, manager_id AS "managerId" FROM people');

  const visible = new Set([user.personId]);
  if (user.role === 'lead') {
    let changed = true;
    while (changed) {
      changed = false;
      for (const p of rows) {
        if (p.managerId && visible.has(p.managerId) && !visible.has(p.id)) {
          visible.add(p.id);
          changed = true;
        }
      }
    }
  }
  return [...visible];
};

module.exports = { getVisiblePersonIds };
