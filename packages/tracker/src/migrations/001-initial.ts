import type { Database } from "bun:sqlite";

export const version = 1;

export function up(db: Database) {
  db.run(`
    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      description TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_name TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'idle'
    )
  `);
}
