-- Core domain tables (phase 1: JSON file store -> Postgres)
CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  team TEXT NOT NULL,
  weekly_capacity DOUBLE PRECISION NOT NULL DEFAULT 40
    CHECK (weekly_capacity > 0 AND weekly_capacity <= 168),
  manager_id TEXT REFERENCES people(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  assignee_id TEXT REFERENCES people(id) ON DELETE RESTRICT,
  estimated_hours DOUBLE PRECISION NOT NULL CHECK (estimated_hours > 0),
  week DATE NOT NULL
);

-- RBAC-ready tables (phase 2: auth + roles; not wired into the API yet)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'engineer'
    CHECK (role IN ('boss', 'lead', 'engineer')),
  person_id TEXT UNIQUE REFERENCES people(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_assignee_week ON tasks (assignee_id, week);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks (project_id);
