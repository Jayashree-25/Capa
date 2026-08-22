-- Add status column to projects (active, on_hold, completed)
ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'active';
