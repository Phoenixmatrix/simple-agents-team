import type { Database } from "bun:sqlite";

export const version = 2;

export function up(db: Database) {
  db.run(`ALTER TABLE tasks ADD COLUMN status TEXT NOT NULL DEFAULT 'ready'`);
  db.run(`ALTER TABLE tasks ADD COLUMN assigned_to TEXT`);
}
