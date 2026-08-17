-- Project ownership: a project is assigned to a lead (Project -> Lead)
ALTER TABLE projects ADD COLUMN owner_id TEXT REFERENCES people(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects (owner_id);