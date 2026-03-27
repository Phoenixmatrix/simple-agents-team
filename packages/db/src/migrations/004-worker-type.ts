import type { Database } from "bun:sqlite";

export const version = 4;

export function up(db: Database) {
  db.run(`ALTER TABLE workers ADD COLUMN type TEXT NOT NULL DEFAULT 'worker'`);
}
