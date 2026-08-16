-- Org hierarchy foundation: person-level role + hierarchy rules
ALTER TABLE people ADD COLUMN role TEXT NOT NULL DEFAULT 'member'
  CHECK (role IN ('lead', 'member'));

-- Backfill: a person becomes a Lead if they already have direct reports
-- or already hold a lead account. Boss accounts are protected — a person
-- holding a boss account stays the Boss even if they have direct reports.
UPDATE people SET role = 'lead'
WHERE (
  id IN (SELECT manager_id FROM people WHERE manager_id IS NOT NULL)
  OR id IN (SELECT person_id FROM users WHERE role = 'lead' AND person_id IS NOT NULL)
)
AND id NOT IN (SELECT person_id FROM users WHERE role = 'boss' AND person_id IS NOT NULL);

-- Account sync: a person marked as Lead must not keep an engineer account.
-- Boss accounts are never touched.
UPDATE users SET role = 'lead'
WHERE role = 'engineer'
  AND person_id IN (SELECT id FROM people WHERE role = 'lead');