-- Lead delegation: parent tasks can be broken into chunks (one level deep)
ALTER TABLE tasks ADD COLUMN parent_id TEXT REFERENCES tasks(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks (parent_id);