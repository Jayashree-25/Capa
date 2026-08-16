// Builds the ordered row descriptors for the Boss Dashboard capacity table.
//
// Hierarchy rules are enforced by the backend:
//   - leads have managerId = null (they report to the Boss)
//   - members (non-leads) may have managerId pointing to a lead
//   - solo members have managerId = null
//
// Ordering: leads (with their visible members underneath), then solo members.
// A member whose manager is not in the visible set (e.g. filtered out by the
// team filter) becomes a temporary top-level row so real people are never
// hidden by the filter.

export const buildHierarchyRows = (visiblePeople) => {
  const leads = [];
  const solo = [];

  for (const person of visiblePeople) {
    if (person.role === 'lead') {
      leads.push({ kind: 'lead', person, members: [] });
    }
  }

  for (const person of visiblePeople) {
    if (person.role === 'lead') continue;
    const lead = person.managerId ? leads.find(l => l.person.id === person.managerId) : null;
    if (lead) {
      lead.members.push(person);
    } else {
      solo.push({ kind: 'solo', person });
    }
  }

  return [...leads, ...solo];
};