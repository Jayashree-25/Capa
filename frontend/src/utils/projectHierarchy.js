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

export const buildProjectHierarchy = (perPersonData, projects, tasks, buckets, granularity) => {
  const projectMap = new Map();
  for (const p of projects) {
    projectMap.set(p.id, {
      id: p.id,
      name: p.name,
      description: p.description,
      ownerId: p.ownerId,
      ownerName: p.ownerName,
      peopleByTeam: new Map(),
      soloPeople: []
    });
  }

  const delegatedParentIds = new Set(tasks.filter(t => t.parentId).map(t => t.parentId));

  const personLookup = new Map(perPersonData.map(p => [p.id, p]));

  for (const t of tasks) {
    if (delegatedParentIds.has(t.id)) continue;
    if (!t.assigneeId || !t.projectId) continue;
    const person = personLookup.get(t.assigneeId);
    if (!person || !isActive(person)) continue;
    const proj = projectMap.get(t.projectId);
    if (!proj) continue;

    const taskBucket = granularity === 'week' ? t.week : (t.week ? t.week.slice(0, 7) : null);

    const teamName = person.team || 'No Team';
    if (!proj.peopleByTeam.has(teamName)) {
      proj.peopleByTeam.set(teamName, new Map());
    }
    const teamPeople = proj.peopleByTeam.get(teamName);
    if (!teamPeople.has(person.id)) {
      teamPeople.set(person.id, {
        person,
        totalAssigned: 0,
        bucketHours: {}
      });
    }
    const entry = teamPeople.get(person.id);
    entry.totalAssigned += t.estimatedHours;
    if (taskBucket) {
      entry.bucketHours[taskBucket] = (entry.bucketHours[taskBucket] || 0) + t.estimatedHours;
    }
  }

  const result = [];
  for (const [, proj] of projectMap) {
    const teams = [];
    for (const [teamName, peopleMap] of proj.peopleByTeam) {
      const people = [];
      for (const [, entry] of peopleMap) {
        people.push({
          ...entry.person,
          projectAssignedHours: entry.totalAssigned,
          projectBuckets: entry.bucketHours,
          displayRole: getDisplayRole(entry.person)
        });
      }
      people.sort((a, b) => {
        if (a.displayRole === 'Lead' && b.displayRole !== 'Lead') return -1;
        if (a.displayRole !== 'Lead' && b.displayRole === 'Lead') return 1;
        return a.name.localeCompare(b.name);
      });
      teams.push({
        name: teamName,
        people,
        capacity: people.reduce((s, p) => s + p.weeklyCapacity, 0),
        assigned: people.reduce((s, p) => s + p.projectAssignedHours, 0)
      });
    }
    teams.sort((a, b) => {
      if (a.name === 'Solo') return 1;
      if (b.name === 'Solo') return -1;
      return a.name.localeCompare(b.name);
    });

    const allProjectPeople = teams.flatMap(team => team.people);
    const totalCapacity = allProjectPeople.reduce((s, p) => s + p.weeklyCapacity, 0);
    const totalAssigned = allProjectPeople.reduce((s, p) => s + p.projectAssignedHours, 0);

    if (allProjectPeople.length > 0) {
      result.push({
        ...proj,
        teams,
        totalCapacity,
        totalAssigned,
        overloaded: totalAssigned > totalCapacity,
        utilization: totalCapacity > 0 ? Number((totalAssigned / totalCapacity).toFixed(3)) : 0
      });
    }
  }

  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
};
