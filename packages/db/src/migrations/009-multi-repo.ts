import type { Database } from "bun:sqlite";

export const version = 9;

export function up(db: Database) {
  // --- Tasks: add repo column, change uniqueness to per-repo ---

  db.run(`CREATE TABLE tasks_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ready',
    assigned_to TEXT,
    blocked_by TEXT,
    portfolio TEXT,
    repo TEXT
  )`);
  db.run(`INSERT INTO tasks_new (id, task_id, description, status, assigned_to, blocked_by, portfolio)
    SELECT id, task_id, description, status, assigned_to, blocked_by, portfolio FROM tasks`);
  db.run(`DROP TABLE tasks`);
  db.run(`ALTER TABLE tasks_new RENAME TO tasks`);
  db.run(`CREATE UNIQUE INDEX idx_tasks_taskid_repo ON tasks(task_id, repo)`);

  // --- Workers: add repo + workspace columns, change uniqueness to per-repo ---

  db.run(`CREATE TABLE workers_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_name TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'idle',
    tmux_target TEXT,
    session_prefix TEXT,
    repo TEXT,
    workspace TEXT
  )`);
  db.run(`INSERT INTO workers_new (id, worker_name, type, status, tmux_target, session_prefix)
    SELECT id, worker_name, type, status, tmux_target, session_prefix FROM workers`);
  db.run(`DROP TABLE workers`);
  db.run(`ALTER TABLE workers_new RENAME TO workers`);
  db.run(`CREATE UNIQUE INDEX idx_workers_name_repo ON workers(worker_name, repo)`);
}
