const express = require('express');
const router = express.Router();
const { loadData, saveData } = require('../lib/store');
const { requireRole } = require('../middleware/auth');
const { getVisiblePersonIds } = require('../lib/scope');

// ---------- Date helpers (week-based, ISO) ----------
const toISODate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Normalize any date to the Monday of its week
const getMonday = (d) => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
};

const addDays = (d, days) => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const addMonths = (d, months) => {
  const copy = new Date(d);
  copy.setMonth(copy.getMonth() + months, 1);
  return copy;
};

// Accepts an ISO date (YYYY-MM-DD) or week label; returns Monday's ISO date or null
const parseWeek = (weekStr) => {
  if (typeof weekStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(weekStr)) return null;
  const d = new Date(`${weekStr}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  return getMonday(d);
};

const monthKeyOfIso = (iso) => iso.slice(0, 7);

const parseMonth = (monthStr) => {
  if (typeof monthStr !== 'string' || !/^\d{4}-\d{2}(-\d{2})?$/.test(monthStr)) return null;
  return monthStr.slice(0, 7);
};

// Number of Mondays within a YYYY-MM month
const mondaysInMonth = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number);
  let count = 0;
  const first = new Date(year, month - 1, 1);
  let cursor = getMonday(first);
  while (cursor < first) cursor = addDays(cursor, 7);
  while (cursor.getFullYear() === year && cursor.getMonth() === month - 1) {
    count += 1;
    cursor = addDays(cursor, 7);
  }
  return count;
};

// ---------- Validators ----------
const validatePersonInput = (body) => {
  const { name, team, weeklyCapacity } = body || {};
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return 'Person name is required and must be a non-empty string.';
  }
  if (!team || typeof team !== 'string' || team.trim() === '') {
    return 'Team is required and must be a non-empty string.';
  }
  const capacity = weeklyCapacity === undefined ? 40 : weeklyCapacity;
  if (typeof capacity !== 'number' || !Number.isFinite(capacity) || capacity <= 0 || capacity > 168) {
    return 'Weekly capacity must be a positive number (hours per week, max 168).';
  }
  const role = body.role === undefined ? 'member' : body.role;
  if (role !== 'lead' && role !== 'member') {
    return 'Role must be either "lead" or "member".';
  }
  return null;
};

// Hierarchy rules: lead -> no manager (reports to Boss); member -> manager must be a lead; solo member -> valid
const validateHierarchy = (role, managerId, data) => {
  if (role === 'lead') {
    if (managerId) return 'Leads report directly to the Boss and cannot have a manager.';
  } else if (managerId) {
    const manager = data.people.find(p => p.id === managerId);
    if (!manager) return 'Manager does not exist.';
    if (manager.role !== 'lead') return 'A member can only report to a lead.';
  }
  return null;
};

const validateTaskInput = (body, data) => {
  const { title, projectId, assigneeId, estimatedHours, week } = body || {};
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return 'Task title is required and must be a non-empty string.';
  }
  if (typeof estimatedHours !== 'number' || !Number.isFinite(estimatedHours) || estimatedHours <= 0) {
    return 'Estimated hours must be a positive number.';
  }
  if (!data.projects.some(p => p.id === projectId)) {
    return 'Project does not exist.';
  }
  if (assigneeId !== null && assigneeId !== undefined && !data.people.some(p => p.id === assigneeId)) {
    return 'Assignee does not exist.';
  }
  const monday = parseWeek(week);
  if (!monday) {
    return 'Week must be a valid date (YYYY-MM-DD); it is normalized to the Monday of that week.';
  }
  return null;
};

// Boss delegation rule: a boss may only assign tasks to a lead or a solo member
// (a member who does not report to a lead). Members under a lead are off-limits.
const delegationError = (role, assigneeId, people) => {
  if (role !== 'boss' || assigneeId === null || assigneeId === undefined) return null;
  const assignee = people.find(p => p.id === assigneeId);
  if (!assignee || assignee.role === 'lead' || !assignee.managerId) return null;
  return 'A boss can only assign tasks to a lead or a solo member (a member who does not report to a lead).';
};

// Chunk assignee rule: a lead may assign chunks only to themselves or to members
// reporting directly to them. Returns { status, error } or null when valid.
const chunkAssigneeIssue = (assigneeId, leadPersonId, people) => {
  if (assigneeId === null || assigneeId === undefined) {
    return { status: 400, error: 'A chunk must have an assignee.' };
  }
  if (assigneeId === leadPersonId) return null;
  const assignee = people.find(p => p.id === assigneeId);
  if (!assignee) return null; // existence is validated elsewhere
  if (assignee.managerId === leadPersonId) return null;
  return { status: 403, error: 'A lead can only assign chunks to themselves or to members reporting directly to them.' };
};

// ---------- People ----------
router.get('/people', async (req, res) => {
  try {
    let people = (await loadData()).people;
    const visible = await getVisiblePersonIds(req.user);
    if (visible) people = people.filter(p => visible.includes(p.id));
    res.json(people);
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch people: ${error.message}` });
  }
});

router.post('/people', requireRole('boss', 'lead'), async (req, res) => {
  try {
    const error = validatePersonInput(req.body);
    if (error) return res.status(400).json({ error });

    const data = await loadData();
    const role = req.body.role === undefined ? 'member' : req.body.role;
    const managerId = req.body.managerId === undefined ? null : req.body.managerId;

    const hierarchyError = validateHierarchy(role, managerId, data);
    if (hierarchyError) return res.status(400).json({ error: hierarchyError });

    const newPerson = {
      id: `p-${Date.now()}`,
      name: req.body.name.trim(),
      team: req.body.team.trim(),
      weeklyCapacity: req.body.weeklyCapacity === undefined ? 40 : req.body.weeklyCapacity,
      managerId,
      role
    };
    data.people.push(newPerson);
    await saveData(data);
    res.status(201).json(newPerson);
  } catch (err) {
    res.status(500).json({ error: `Failed to add person: ${err.message}` });
  }
});

router.put('/people/:id', requireRole('boss', 'lead'), async (req, res) => {
  try {
    const data = await loadData();
    const index = data.people.findIndex(p => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Person not found.' });

    const merged = { ...data.people[index], ...req.body };
    const error = validatePersonInput(merged);
    if (error) return res.status(400).json({ error });

    const newRole = merged.role;
    const newManagerId = merged.managerId ?? null;

    if (newManagerId === req.params.id) {
      return res.status(400).json({ error: 'A person cannot be their own manager.' });
    }

    if (data.people[index].role === 'lead' && newRole === 'member') {
      const hasReports = data.people.some(p => p.managerId === data.people[index].id);
      if (hasReports) {
        return res.status(400).json({ error: 'This lead has team members reporting to them. Reassign those members to another lead first.' });
      }
    }

    const hierarchyError = validateHierarchy(newRole, newManagerId, data);
    if (hierarchyError) return res.status(400).json({ error: hierarchyError });

    data.people[index] = {
      id: data.people[index].id,
      name: merged.name.trim(),
      team: merged.team.trim(),
      weeklyCapacity: merged.weeklyCapacity,
      managerId: newManagerId,
      role: newRole
    };
    await saveData(data);
    res.json(data.people[index]);
  } catch (err) {
    res.status(500).json({ error: `Failed to update person: ${err.message}` });
  }
});

router.delete('/people/:id', requireRole('boss', 'lead'), async (req, res) => {
  try {
    const data = await loadData();
    const index = data.people.findIndex(p => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Person not found.' });

    if (data.tasks.some(t => t.assigneeId === req.params.id)) {
      return res.status(409).json({ error: 'Cannot delete: tasks are still assigned to this person. Reassign or delete those tasks first.' });
    }

    if (data.people.some(p => p.managerId === req.params.id)) {
      return res.status(409).json({ error: 'Cannot delete: people still report to this person. Reassign them to another lead first.' });
    }

    const deleted = data.people.splice(index, 1)[0];
    await saveData(data);
    res.json({ message: 'Person deleted successfully.', person: deleted });
  } catch (err) {
    res.status(500).json({ error: `Failed to delete person: ${err.message}` });
  }
});

// Distinct team names (for filter dropdowns)
router.get('/teams', async (req, res) => {
  try {
    let people = (await loadData()).people;
    const visible = await getVisiblePersonIds(req.user);
    if (visible) people = people.filter(p => visible.includes(p.id));
    const teams = [...new Set(people.map(p => p.team))].sort();
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch teams: ${err.message}` });
  }
});

// ---------- Projects ----------
router.get('/projects', async (req, res) => {
  try {
    res.json((await loadData()).projects);
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch projects: ${error.message}` });
  }
});

router.post('/projects', requireRole('boss', 'lead'), async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Project name is required and must be a non-empty string.' });
    }
    const data = await loadData();
    const newProject = { id: `pr-${Date.now()}`, name: name.trim() };
    data.projects.push(newProject);
    await saveData(data);
    res.status(201).json(newProject);
  } catch (err) {
    res.status(500).json({ error: `Failed to add project: ${err.message}` });
  }
});

router.delete('/projects/:id', requireRole('boss', 'lead'), async (req, res) => {
  try {
    const data = await loadData();
    const index = data.projects.findIndex(p => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Project not found.' });

    if (data.tasks.some(t => t.projectId === req.params.id)) {
      return res.status(409).json({ error: 'Cannot delete: tasks still reference this project.' });
    }

    const deleted = data.projects.splice(index, 1)[0];
    await saveData(data);
    res.json({ message: 'Project deleted successfully.', project: deleted });
  } catch (err) {
    res.status(500).json({ error: `Failed to delete project: ${err.message}` });
  }
});

// ---------- Tasks ----------
router.get('/tasks', async (req, res) => {
  try {
    const data = await loadData();
    const peopleById = Object.fromEntries(data.people.map(p => [p.id, p]));
    const projectsById = Object.fromEntries(data.projects.map(p => [p.id, p]));
    const tasksById = Object.fromEntries(data.tasks.map(t => [t.id, t]));
    let tasks = data.tasks;
    const visible = await getVisiblePersonIds(req.user);
    if (visible) {
      if (req.user.role === 'engineer') {
        tasks = tasks.filter(t => t.assigneeId === req.user.personId);
      } else {
        tasks = tasks.filter(t => !t.assigneeId || visible.includes(t.assigneeId));
      }
    }
    const enriched = tasks.map(t => ({
      ...t,
      assigneeName: t.assigneeId ? (peopleById[t.assigneeId]?.name || null) : null,
      projectName: projectsById[t.projectId]?.name || null,
      parentTitle: t.parentId ? (tasksById[t.parentId]?.title || null) : null
    }));
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch tasks: ${error.message}` });
  }
});

router.post('/tasks', async (req, res) => {
  try {
    const data = await loadData();
    const { title, projectId, assigneeId, estimatedHours, week, parentId } = req.body;

    let resolvedProjectId = projectId;
    let chunkParentId = null;
    if (parentId !== undefined && parentId !== null) {
      if (req.user.role !== 'lead') {
        return res.status(403).json({ error: 'Only a lead can create delegated chunks.' });
      }
      const parent = data.tasks.find(t => t.id === parentId);
      if (!parent) {
        return res.status(400).json({ error: 'Parent task does not exist.' });
      }
      if (parent.parentId) {
        return res.status(400).json({ error: 'A chunk cannot be a parent task (only one level of delegation is allowed).' });
      }
      if (parent.assigneeId !== req.user.personId) {
        return res.status(403).json({ error: 'Only the lead assigned to a parent task can delegate it into chunks.' });
      }
      const chunkIssue = chunkAssigneeIssue(assigneeId, req.user.personId, data.people);
      if (chunkIssue) {
        return res.status(chunkIssue.status).json({ error: chunkIssue.error });
      }
      resolvedProjectId = parent.projectId;
      chunkParentId = parentId;
    }

    const error = validateTaskInput({ ...req.body, projectId: resolvedProjectId }, data);
    if (error) return res.status(400).json({ error });

    if (req.user.role === 'engineer' && assigneeId !== req.user.personId) {
      return res.status(403).json({ error: 'Engineers can only assign tasks to themselves.' });
    }

    const delegationErrorMsg = delegationError(req.user.role, assigneeId, data.people);
    if (delegationErrorMsg) {
      return res.status(403).json({ error: delegationErrorMsg });
    }

    const newTask = {
      id: `t-${Date.now()}`,
      title: title.trim(),
      projectId: resolvedProjectId,
      assigneeId: assigneeId === undefined ? null : assigneeId,
      estimatedHours,
      week: toISODate(parseWeek(week)),
      parentId: chunkParentId
    };
    data.tasks.push(newTask);
    await saveData(data);
    res.status(201).json(newTask);
  } catch (err) {
    res.status(500).json({ error: `Failed to add task: ${err.message}` });
  }
});

router.put('/tasks/:id', async (req, res) => {
  try {
    const data = await loadData();
    const index = data.tasks.findIndex(t => t.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Task not found.' });

    if (req.body.parentId !== undefined) {
      return res.status(400).json({ error: 'A task\'s parent cannot be changed.' });
    }

    const existing = data.tasks[index];
    if (req.user.role === 'engineer') {
      if (existing.assigneeId !== req.user.personId) {
        return res.status(403).json({ error: 'Engineers can only update their own tasks.' });
      }
      if (req.body.assigneeId !== undefined && req.body.assigneeId !== req.user.personId) {
        return res.status(403).json({ error: 'Engineers can only keep tasks assigned to themselves.' });
      }
    }

    if (req.body.assigneeId !== undefined) {
      if (existing.parentId) {
        const parent = data.tasks.find(t => t.id === existing.parentId);
        if (!parent || req.user.role !== 'lead' || parent.assigneeId !== req.user.personId) {
          return res.status(403).json({ error: 'Only the lead assigned to a parent task can reassign its chunks.' });
        }
        const chunkIssue = chunkAssigneeIssue(req.body.assigneeId, req.user.personId, data.people);
        if (chunkIssue) {
          return res.status(chunkIssue.status).json({ error: chunkIssue.error });
        }
      } else {
        const delegationErrorMsg = delegationError(req.user.role, req.body.assigneeId, data.people);
        if (delegationErrorMsg) {
          return res.status(403).json({ error: delegationErrorMsg });
        }
      }
    }

    const merged = { ...existing, ...req.body };
    if (merged.week !== undefined) {
      const parsed = parseWeek(merged.week);
      if (!parsed) {
        return res.status(400).json({ error: 'Week must be a valid date (YYYY-MM-DD).' });
      }
      merged.week = toISODate(parsed);
    }
    const error = validateTaskInput(merged, data);
    if (error) return res.status(400).json({ error });

    data.tasks[index] = merged;
    await saveData(data);
    res.json(merged);
  } catch (err) {
    res.status(500).json({ error: `Failed to update task: ${err.message}` });
  }
});

router.delete('/tasks/:id', requireRole('boss', 'lead'), async (req, res) => {
  try {
    const data = await loadData();
    const index = data.tasks.findIndex(t => t.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Task not found.' });

    if (data.tasks.some(t => t.parentId === req.params.id)) {
      return res.status(409).json({ error: 'This task has delegated chunks. Delete those chunks first.' });
    }

    const deleted = data.tasks.splice(index, 1)[0];
    await saveData(data);
    res.json({ message: 'Task deleted successfully.', task: deleted });
  } catch (err) {
    res.status(500).json({ error: `Failed to delete task: ${err.message}` });
  }
});

// ---------- Capacity report ----------
// GET /api/reports/load?granularity=week|month&from=YYYY-MM-DD|YYYY-MM&to=...&team=&project=
router.get('/reports/load', async (req, res) => {
  try {
    const data = await loadData();
    const granularity = req.query.granularity === 'month' ? 'month' : 'week';
    const teamFilter = req.query.team ? String(req.query.team) : null;
    const projectFilter = req.query.project ? String(req.query.project) : null;

    const now = new Date();
    let from, to, buckets = [];

    if (granularity === 'week') {
      const fromMonday = parseWeek(req.query.from) || getMonday(addDays(now, -7 * 5));
      const toMonday = parseWeek(req.query.to) || getMonday(now);
      from = toISODate(fromMonday);
      to = toISODate(toMonday);
      let cursor = new Date(fromMonday);
      while (cursor <= toMonday) {
        buckets.push(toISODate(cursor));
        cursor = addDays(cursor, 7);
      }
    } else {
      const fromMonth = parseMonth(req.query.from) || new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 7);
      const toMonth = parseMonth(req.query.to) || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 7);
      if (fromMonth > toMonth) {
        return res.status(400).json({ error: '`from` must not be after `to`.' });
      }
      from = fromMonth;
      to = toMonth;
      let cursor = new Date(`${fromMonth}-01T00:00:00`);
      const end = new Date(`${toMonth}-01T00:00:00`);
      while (cursor <= end) {
        buckets.push(toISODate(cursor).slice(0, 7));
        cursor = addMonths(cursor, 1);
      }
    }

    let people = data.people;
    const visible = await getVisiblePersonIds(req.user);
    if (visible) {
      people = people.filter(p => visible.includes(p.id));
    }
    if (teamFilter) {
      people = people.filter(p => (p.team || '').toLowerCase() === teamFilter.toLowerCase());
    }

    // A top-level task that has chunks is fully delegated: its own hours never
    // count toward the parent assignee's load — only the chunks count, once.
    const delegatedParentIds = new Set(data.tasks.filter(t => t.parentId).map(t => t.parentId));

    const bucketTaskHours = (p, bucketKey) => {
      let total = 0;
      for (const t of data.tasks) {
        if (delegatedParentIds.has(t.id)) continue;
        if (t.assigneeId !== p.id) continue;
        if (projectFilter && t.projectId !== projectFilter) continue;
        if (granularity === 'week') {
          if (t.week === bucketKey) total += t.estimatedHours;
        } else {
          if (t.week && monthKeyOfIso(t.week) === bucketKey) total += t.estimatedHours;
        }
      }
      return total;
    };

    const reportPeople = people.map(p => {
      const bucketsReport = buckets.map(key => {
        const assignedHours = bucketTaskHours(p, key);
        const capacityHours = granularity === 'week'
          ? p.weeklyCapacity
          : p.weeklyCapacity * mondaysInMonth(key);
        const utilization = capacityHours > 0 ? assignedHours / capacityHours : (assignedHours > 0 ? 1 : 0);
        return {
          key,
          assignedHours,
          capacityHours,
          utilization: Number(utilization.toFixed(3)),
          overloaded: assignedHours > capacityHours
        };
      });
      const totalAssignedHours = bucketsReport.reduce((s, b) => s + b.assignedHours, 0);
      const totalCapacityHours = bucketsReport.reduce((s, b) => s + b.capacityHours, 0);
      return {
        id: p.id,
        name: p.name,
        team: p.team,
        role: p.role,
        managerId: p.managerId,
        weeklyCapacity: p.weeklyCapacity,
        buckets: bucketsReport,
        totalAssignedHours,
        totalCapacityHours,
        utilization: totalCapacityHours > 0 ? Number((totalAssignedHours / totalCapacityHours).toFixed(3)) : 0,
        overloaded: bucketsReport.some(b => b.overloaded)
      };
    });

    const teamTotals = buckets.map(key => {
      const assigned = reportPeople.reduce((s, p) => s + (p.buckets.find(b => b.key === key)?.assignedHours || 0), 0);
      const capacity = reportPeople.reduce((s, p) => s + (p.buckets.find(b => b.key === key)?.capacityHours || 0), 0);
      return {
        key,
        assignedHours: assigned,
        capacityHours: capacity,
        overloaded: assigned > capacity
      };
    });

    res.json({ granularity, from, to, buckets, people: reportPeople, teamTotals });
  } catch (error) {
    res.status(500).json({ error: `Failed to calculate load report: ${error.message}` });
  }
});

module.exports = router;