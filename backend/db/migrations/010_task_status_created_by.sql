-- Task status workflow + creator tracking
ALTER TABLE tasks ADD COLUMN status TEXT DEFAULT 'todo';
ALTER TABLE tasks ADD COLUMN created_by TEXT REFERENCES people(id) ON DELETE SET NULL;
