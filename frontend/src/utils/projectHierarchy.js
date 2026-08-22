import { mondaysInMonth } from './dateUtils';

export const calcPersonBuckets = (person, tasks, buckets, granularity, projectFilter) => {
  const delegatedParentIds = new Set(tasks.filter(t => t.parentId).map(t => t.parentId));

  const bucketsData = buckets.map(key => {
    let assignedHours = 0;
    for (const t of tasks) {
      if (delegatedParentIds.has(t.id)) continue;
      if (t.assigneeId !== person.id) continue;
      if (projectFilter && t.projectId !== projectFilter) continue;
      const taskBucket = granularity === 'week' ? t.week : (t.week ? t.week.slice(0, 7) : null);
      if (taskBucket === key) assignedHours += t.estimatedHours;
    }
    const capacityHours = granularity === 'week'
      ? person.weeklyCapacity
      : person.weeklyCapacity * mondaysInMonth(key);
    const utilization = capacityHours > 0 ? assignedHours / capacityHours : (assignedHours > 0 ? 1 : 0);
    return {
      key,
      assignedHours,
      capacityHours,
      utilization: Number(utilization.toFixed(3)),
      overloaded: assignedHours > capacityHours
    };
  });

  const totalAssignedHours = bucketsData.reduce((s, b) => s + b.assignedHours, 0);
  const totalCapacityHours = bucketsData.reduce((s, b) => s + b.capacityHours, 0);

  return {
    id: person.id,
    name: person.name,
    team: person.team,
    role: person.role,
    status: person.status || 'active',
    managerId: person.managerId,
    weeklyCapacity: person.weeklyCapacity,
    buckets: bucketsData,
    totalAssignedHours,
    totalCapacityHours,
    utilization: totalCapacityHours > 0 ? Number((totalAssignedHours / totalCapacityHours).toFixed(3)) : 0,
    overloaded: bucketsData.some(b => b.overloaded)
  };
};

export const getDisplayRole = (person) => {
  if (person.role === 'lead') return 'Lead';
  return person.managerId ? 'Member' : 'Solo';
};

export const isActive = (person) => person.status !== 'inactive';

const capacityForKey = (person, key, granularity) =>
  person.weeklyCapacity * (granularity === 'week' ? 1 : mondaysInMonth(key));

// PROJECT-FIRST hierarchy:
// projects -> project owner -> owner's reports -> task assignees -> workload/capacity
export const buildProjectHierarchy = (people, projects, tasks, buckets, granularity, teamFilter) => {
  const activePeople = people.filter(isActive);
  const personLookup = new Map(activePeople.map(p => [p.id, p]));

  // Seed an entry for EVERY project — visibility never depends on tasks
  const projectMap = new Map();
  for (const p of projects) {
    projectMap.set(p.id, {
      id: p.id,
      name: p.name,
      description: p.description,
      ownerId: p.ownerId,
      ownerName: p.ownerName,
      status: p.status || 'active',
      peopleById: new Map()
    });
  }

  // 1+2. Owner first, then their reports if the owner is a lead
  for (const [, proj] of projectMap) {
    if (!proj.ownerId) continue;
    const owner = personLookup.get(proj.ownerId);
    if (!owner) continue;
    proj.peopleById.set(owner.id, { person: owner, totalAssigned: 0, bucketHours: {} });
    if (owner.role === 'lead') {
      for (const r of activePeople) {
        if (r.managerId === owner.id && !proj.peopleById.has(r.id)) {
          proj.peopleById.set(r.id, { person: r, totalAssigned: 0, bucketHours: {} });
        }
      }
    }
  }

  // 3. Task assignees on the project (delegation-aware: chunks count, delegated parents do not)
  const delegatedParentIds = new Set(tasks.filter(t => t.parentId).map(t => t.parentId));
  for (const t of tasks) {
    if (delegatedParentIds.has(t.id)) continue;
    if (!t.assigneeId || !t.projectId) continue;
    const proj = projectMap.get(t.projectId);
    if (!proj) continue;
    const person = personLookup.get(t.assigneeId);
    if (!person) continue;
    if (!proj.peopleById.has(person.id)) {
      proj.peopleById.set(person.id, { person, totalAssigned: 0, bucketHours: {} });
    }
    const entry = proj.peopleById.get(person.id);
    entry.totalAssigned += t.estimatedHours;
    const taskBucket = granularity === 'week' ? t.week : (t.week ? t.week.slice(0, 7) : null);
    if (taskBucket) {
      entry.bucketHours[taskBucket] = (entry.bucketHours[taskBucket] || 0) + t.estimatedHours;
    }
  }

  const result = [];
  for (const [, proj] of projectMap) {
    let entries = [...proj.peopleById.values()];

    if (teamFilter) {
      entries = entries.filter(e => e.person.team === teamFilter);
    }

    const isOwnerRow = (e) => e.person.id === proj.ownerId;
    const isReportRow = (e) => !isOwnerRow(e) && !!e.person.managerId && e.person.managerId === proj.ownerId;
    entries.sort((a, b) => {
      const oa = isOwnerRow(a) ? 0 : (isReportRow(a) ? 1 : 2);
      const ob = isOwnerRow(b) ? 0 : (isReportRow(b) ? 1 : 2);
      if (oa !== ob) return oa - ob;
      return a.person.name.localeCompare(b.person.name);
    });

    const peopleRows = entries.map(e => {
      const personBuckets = buckets.map(key => {
        const assignedHours = e.bucketHours[key] || 0;
        const capacityHours = capacityForKey(e.person, key, granularity);
        return {
          key,
          assignedHours,
          capacityHours,
          utilization: capacityHours > 0 ? Number((assignedHours / capacityHours).toFixed(3)) : 0,
          overloaded: assignedHours > capacityHours
        };
      });
      return {
        id: e.person.id,
        name: e.person.name,
        team: e.person.team,
        role: e.person.role,
        displayRole: e.person.role === 'lead' ? 'Lead' : 'Member',
        weeklyCapacity: e.person.weeklyCapacity,
        totalAssigned: e.totalAssigned,
        buckets: personBuckets,
        overloaded: personBuckets.some(b => b.overloaded)
      };
    });

    const bucketCells = buckets.map(key => {
      const assignedHours = peopleRows.reduce((s, p) => s + (p.buckets.find(b => b.key === key)?.assignedHours || 0), 0);
      const capacityHours = peopleRows.reduce((s, p) => s + (p.buckets.find(b => b.key === key)?.capacityHours || 0), 0);
      return {
        key,
        assignedHours,
        capacityHours,
        utilization: capacityHours > 0 ? Number((assignedHours / capacityHours).toFixed(3)) : 0,
        overloaded: assignedHours > capacityHours
      };
    });

    const totalCapacity = bucketCells.reduce((s, b) => s + b.capacityHours, 0);
    const totalAssigned = bucketCells.reduce((s, b) => s + b.assignedHours, 0);

    result.push({
      id: proj.id,
      name: proj.name,
      description: proj.description,
      status: proj.status,
      ownerId: proj.ownerId,
      ownerName: proj.ownerName,
      people: peopleRows,
      bucketCells,
      totalCapacity,
      totalAssigned,
      overloaded: totalAssigned > totalCapacity,
      utilization: totalCapacity > 0 ? Number((totalAssigned / totalCapacity).toFixed(3)) : 0
    });
  }

  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
};
