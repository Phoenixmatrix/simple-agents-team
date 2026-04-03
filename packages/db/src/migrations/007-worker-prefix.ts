import type { Database } from "bun:sqlite";

export const version = 7;

export function up(db: Database) {
  db.run(`ALTER TABLE workers ADD COLUMN session_prefix TEXT`);
}
