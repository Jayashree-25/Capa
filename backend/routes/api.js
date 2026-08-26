const express = require('express');
const router = express.Router();
const { loadData, saveData } = require('../lib/store');
const { requireRole } = require('../middleware/auth');
const { getVisiblePersonIds } = require('../lib/scope');
const { getPool } = require('../lib/db');

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

// Task status workflow: Todo -> In Progress -> Completed
const TASK_STATUSES = ['todo', 'in_progress', 'completed'];
const statusIssue = (status) => {
  if (status === undefined || status === null) return null;
  if (!TASK_STATUSES.includes(status)) return 'Status must be todo, in_progress, or completed.';
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

    // Leads can only add members to their OWN team reporting directly to themselves
    if (req.user.role === 'lead') {
      const me = data.people.find(p => p.id === req.user.personId);
      const teamOk = me && typeof req.body.team === 'string' && req.body.team.trim() === me.team;
      if (role !== 'member' || managerId !== req.user.personId || !teamOk) {
        return res.status(403).json({ error: 'Leads can only add members to their own team reporting to themselves.' });
      }
    }

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

    // Self-protection: nobody deactivates their own record
    if (req.user.personId === req.params.id && req.body.status === 'inactive') {
      return res.status(400).json({ error: 'You cannot deactivate yourself.' });
    }

    // Leads can only manage people within their subtree
    const visible = await getVisiblePersonIds(req.user);
    if (visible && !visible.includes(req.params.id)) {
      return res.status(403).json({ error: 'You can only manage people within your team.' });
    }

    // Role, reporting line, and team are structural decisions — boss only.
    // (Boss team changes cascade to the target's subtree below.)
    if (req.user.role === 'lead') {
      const changingRole = req.body.role !== undefined && req.body.role !== data.people[index].role;
      const changingManager = req.body.managerId !== undefined &&
        (req.body.managerId ?? null) !== (data.people[index].managerId ?? null);
      const changingTeam = req.body.team !== undefined && req.body.team.trim() !== data.people[index].team;
      if (changingRole || changingManager || changingTeam) {
        return res.status(403).json({ error: 'Only the boss can change role, reporting line, or team.' });
      }
    }

    const merged = { ...data.people[index], ...req.body };
    const error = validatePersonInput(merged);
    if (error) return res.status(400).json({ error });

    const newRole = merged.role;
    const newManagerId = merged.managerId ?? null;
    const newStatus = merged.status === 'inactive' ? 'inactive' : 'active';

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

    const previousTeam = data.people[index].team;
    data.people[index] = {
      id: data.people[index].id,
      name: merged.name.trim(),
      team: merged.team.trim(),
      weeklyCapacity: merged.weeklyCapacity,
      managerId: newManagerId,
      role: newRole,
      status: newStatus
    };

    // Boss team changes cascade to the target's entire subtree,
    // keeping the invariant that a subtree shares its lead's team
    if (req.user.role === 'boss' && data.people[index].team !== previousTeam) {
      const newTeam = data.people[index].team;
      const affected = new Set([req.params.id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const p of data.people) {
          if (p.managerId && affected.has(p.managerId) && !affected.has(p.id)) {
            affected.add(p.id);
            grew = true;
          }
        }
      }
      for (const p of data.people) {
        if (affected.has(p.id)) p.team = newTeam;
      }
    }

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

    // Self-protection: nobody deletes their own record
    if (req.user.personId === req.params.id) {
      return res.status(400).json({ error: 'You cannot delete your own record.' });
    }

    // Leads can only delete people within their subtree
    const visible = await getVisiblePersonIds(req.user);
    if (visible && !visible.includes(req.params.id)) {
      return res.status(403).json({ error: 'You can only manage people within your team.' });
    }

    // A person with a login account must be removed via the Users page,
    // which deletes both deliberately instead of cascade-orphaning access
    const linked = await getPool().query('SELECT 1 FROM users WHERE person_id = $1', [req.params.id]);
    if (linked.rowCount > 0) {
      return res.status(409).json({ error: 'This person has a login account. Remove the account first from the Users page.' });
    }

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
    const data = await loadData();
    const peopleById = Object.fromEntries(data.people.map(p => [p.id, p]));
    let enriched = data.projects.map(p => ({
      ...p,
      ownerName: p.ownerId ? (peopleById[p.ownerId]?.name || null) : null,
      ownerRole: p.ownerId ? (peopleById[p.ownerId]?.role || null) : null,
      ownerTeam: p.ownerId ? (peopleById[p.ownerId]?.team || null) : null
    }));

    // Non-boss users only see projects they own or that are referenced
    // by tasks inside their visible scope, including unassigned tasks they created
    // (keeps Tasks/Dashboard names working)
    const visible = await getVisiblePersonIds(req.user);
    if (visible) {
      const scopedProjectIds = new Set(
        data.tasks
          .filter(t =>
            (t.assigneeId && visible.includes(t.assigneeId)) ||
            (!t.assigneeId && t.createdBy === req.user.personId)
          )
          .map(t => t.projectId)
      );
      enriched = enriched.filter(p =>
        p.ownerId === req.user.personId || scopedProjectIds.has(p.id)
      );
    }

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch projects: ${error.message}` });
  }
});

router.post('/projects', requireRole('boss', 'lead'), async (req, res) => {
  try {
    const { name, description, ownerId, status } = req.body || {};
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Project name is required and must be a non-empty string.' });
    }
    const validStatuses = ['active', 'on_hold', 'completed'];
    const projectStatus = status || 'active';
    if (!validStatuses.includes(projectStatus)) {
      return res.status(400).json({ error: 'Status must be active, on_hold, or completed.' });
    }
    const data = await loadData();

    // Leads can only create projects owned by themselves
    if (req.user.role === 'lead' && ownerId !== req.user.personId) {
      return res.status(403).json({ error: 'Leads can only create projects owned by themselves.' });
    }

    // Name uniqueness
    if (data.projects.some(p => p.name.toLowerCase() === name.trim().toLowerCase())) {
      return res.status(400).json({ error: 'A project with this name already exists.' });
    }

    // Validate owner if provided — must be a lead or a solo member (no manager)
    if (ownerId !== null && ownerId !== undefined) {
      const owner = data.people.find(p => p.id === ownerId);
      if (!owner) return res.status(400).json({ error: 'Owner does not exist.' });
      const isLead = owner.role === 'lead';
      const isSoloMember = owner.role === 'member' && !owner.managerId;
      if (!isLead && !isSoloMember) {
        return res.status(400).json({ error: 'A project can only be assigned to a lead or a solo member (a member who does not report to a lead).' });
      }
    }

    const newProject = {
      id: `pr-${Date.now()}`,
      name: name.trim(),
      description: (description || '').trim(),
      ownerId: ownerId ?? null,
      status: projectStatus
    };
    data.projects.push(newProject);
    await saveData(data);

    const peopleById = Object.fromEntries(data.people.map(p => [p.id, p]));
    const saved = data.projects[data.projects.length - 1];
    res.status(201).json({
      ...saved,
      ownerName: saved.ownerId ? (peopleById[saved.ownerId]?.name || null) : null,
      ownerRole: saved.ownerId ? (peopleById[saved.ownerId]?.role || null) : null,
      ownerTeam: saved.ownerId ? (peopleById[saved.ownerId]?.team || null) : null
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to add project: ${err.message}` });
  }
});

router.put('/projects/:id', requireRole('boss', 'lead'), async (req, res) => {
  try {
    const { name, description, ownerId, status } = req.body || {};
    const validStatuses = ['active', 'on_hold', 'completed'];
    if (status !== undefined && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status must be active, on_hold, or completed.' });
    }
    const data = await loadData();
    const index = data.projects.findIndex(p => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Project not found.' });

    // Leads can only manage projects they own and cannot transfer ownership
    if (req.user.role === 'lead') {
      if (data.projects[index].ownerId !== req.user.personId) {
        return res.status(403).json({ error: 'You can only manage projects you own.' });
      }
      if (ownerId !== undefined && ownerId !== req.user.personId) {
        return res.status(403).json({ error: 'You cannot transfer ownership of your project.' });
      }
    }

    // Name uniqueness — allow keeping the same name
    if (name !== undefined && name.trim() !== '') {
      const trimmedName = name.trim();
      const existing = data.projects.find(p => p.id !== req.params.id && p.name.toLowerCase() === trimmedName.toLowerCase());
      if (existing) {
        return res.status(400).json({ error: 'A project with this name already exists.' });
      }
    }

    if (ownerId !== null && ownerId !== undefined) {
      const owner = data.people.find(p => p.id === ownerId);
      if (!owner) return res.status(400).json({ error: 'Owner does not exist.' });
      const isLead = owner.role === 'lead';
      const isSoloMember = owner.role === 'member' && !owner.managerId;
      if (!isLead && !isSoloMember) {
        return res.status(400).json({ error: 'A project can only be assigned to a lead or a solo member (a member who does not report to a lead).' });
      }
    }

    const existing = data.projects[index];
    data.projects[index] = {
      ...existing,
      name: name !== undefined ? name.trim() : existing.name,
      description: description !== undefined ? (description || '').trim() : (existing.description || ''),
      ownerId: ownerId !== undefined ? ownerId : existing.ownerId,
      status: status !== undefined ? status : (existing.status || 'active')
    };
    await saveData(data);

    const peopleById = Object.fromEntries(data.people.map(p => [p.id, p]));
    const updated = data.projects[index];
    res.json({
      ...updated,
      ownerName: updated.ownerId ? (peopleById[updated.ownerId]?.name || null) : null,
      ownerRole: updated.ownerId ? (peopleById[updated.ownerId]?.role || null) : null,
      ownerTeam: updated.ownerId ? (peopleById[updated.ownerId]?.team || null) : null
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to assign project: ${err.message}` });
  }
});

router.delete('/projects/:id', requireRole('boss', 'lead'), async (req, res) => {
  try {
    const data = await loadData();
    const index = data.projects.findIndex(p => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Project not found.' });

    // Leads can only delete projects they own
    if (req.user.role === 'lead' && data.projects[index].ownerId !== req.user.personId) {
      return res.status(403).json({ error: 'You can only delete projects you own.' });
    }

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
        // Leads see their subtree's tasks plus unassigned tasks they created themselves
        tasks = tasks.filter(t =>
          (t.assigneeId && visible.includes(t.assigneeId)) ||
          (!t.assigneeId && t.createdBy === req.user.personId)
        );
      }
    }
    const enriched = tasks.map(t => ({
      ...t,
      assigneeName: t.assigneeId ? (peopleById[t.assigneeId]?.name || null) : null,
      projectName: projectsById[t.projectId]?.name || null,
      parentTitle: t.parentId ? (tasksById[t.parentId]?.title || null) : null,
      parentAssigneeId: t.parentId ? (tasksById[t.parentId]?.assigneeId || null) : null
    }));
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch tasks: ${error.message}` });
  }
});

router.post('/tasks', requireRole('boss', 'lead'), async (req, res) => {
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
    } else if (req.user.role === 'lead' && assigneeId !== undefined && assigneeId !== null) {
      // Leads can only create top-level tasks inside their management scope
      const visible = await getVisiblePersonIds(req.user);
      if (!visible.includes(assigneeId)) {
        return res.status(403).json({ error: 'A lead can only assign tasks to themselves or their team.' });
      }
    }

    const statusError = statusIssue(req.body.status);
    if (statusError) return res.status(400).json({ error: statusError });

    const error = validateTaskInput({ ...req.body, projectId: resolvedProjectId }, data);
    if (error) return res.status(400).json({ error });

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
      parentId: chunkParentId,
      status: 'todo',
      createdBy: req.user.personId
    };
    data.tasks.push(newTask);
    await saveData(data);
    const creator = data.people.find(p => p.id === req.user.personId);
    res.status(201).json({ ...newTask, createdByName: creator ? creator.name : null });
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
    delete req.body.createdBy;

    const existing = data.tasks[index];

    const statusError = statusIssue(req.body.status);
    if (statusError) return res.status(400).json({ error: statusError });

    // Members may only update the status of their own tasks
    if (req.user.role === 'engineer') {
      if (existing.assigneeId !== req.user.personId) {
        return res.status(403).json({ error: 'Members can only update their own tasks.' });
      }
      const attempted = Object.keys(req.body).filter(k => k !== 'status');
      if (attempted.length > 0 || req.body.assigneeId !== undefined) {
        return res.status(403).json({ error: 'Members can only update the status of their tasks.' });
      }
      if (!req.body.status) {
        return res.status(400).json({ error: 'Nothing to update. Members can only change task status.' });
      }
      const updated = { ...existing, status: req.body.status };
      data.tasks[index] = updated;
      await saveData(data);
      const creator = data.people.find(p => p.id === updated.createdBy);
      res.json({ ...updated, createdByName: creator ? creator.name : null });
      return;
    }

    // Leads may only manage tasks within their management scope:
    // their subtree's tasks, chunks of parents assigned to them, or unassigned tasks they created
    if (req.user.role === 'lead') {
      if (existing.parentId) {
        const parent = data.tasks.find(t => t.id === existing.parentId);
        if (!parent || parent.assigneeId !== req.user.personId) {
          return res.status(403).json({ error: 'Only the lead assigned to a parent task can manage its chunks.' });
        }
      } else {
        const visible = await getVisiblePersonIds(req.user);
        const inScope =
          (existing.assigneeId && visible.includes(existing.assigneeId)) ||
          (!existing.assigneeId && existing.createdBy === req.user.personId);
        if (!inScope) {
          return res.status(403).json({ error: 'You can only manage tasks within your team.' });
        }
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
        // Leads cannot unassign tasks they didn't create (it would escape their scope)
        if (req.user.role === 'lead' && req.body.assigneeId === null && existing.createdBy !== req.user.personId) {
          return res.status(403).json({ error: 'Only the task creator or a boss can unassign a task.' });
        }
        if (req.user.role === 'lead' && req.body.assigneeId !== null) {
          const visible = await getVisiblePersonIds(req.user);
          if (!visible.includes(req.body.assigneeId)) {
            return res.status(403).json({ error: 'A lead can only reassign tasks to themselves or their team.' });
          }
        }
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
    if (merged.status === undefined || merged.status === null) merged.status = existing.status || 'todo';
    const error = validateTaskInput(merged, data);
    if (error) return res.status(400).json({ error });

    data.tasks[index] = merged;
    await saveData(data);
    const creator = data.people.find(p => p.id === merged.createdBy);
    res.json({ ...merged, createdByName: creator ? creator.name : null });
  } catch (err) {
    res.status(500).json({ error: `Failed to update task: ${err.message}` });
  }
});

router.delete('/tasks/:id', requireRole('boss', 'lead'), async (req, res) => {
  try {
    const data = await loadData();
    const index = data.tasks.findIndex(t => t.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Task not found.' });

    const existing = data.tasks[index];

    // Leads may only delete tasks within their management scope
    if (req.user.role === 'lead') {
      if (existing.parentId) {
        const parent = data.tasks.find(t => t.id === existing.parentId);
        if (!parent || parent.assigneeId !== req.user.personId) {
          return res.status(403).json({ error: 'You can only manage tasks within your team.' });
        }
      } else {
        const visible = await getVisiblePersonIds(req.user);
        const inScope =
          (existing.assigneeId && visible.includes(existing.assigneeId)) ||
          (!existing.assigneeId && existing.createdBy === req.user.personId);
        if (!inScope) {
          return res.status(403).json({ error: 'You can only manage tasks within your team.' });
        }
      }
    }

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
        status: p.status || 'active',
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