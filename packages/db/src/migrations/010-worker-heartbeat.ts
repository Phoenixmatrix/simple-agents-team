import type { Database } from "bun:sqlite";

export const version = 10;

export function up(db: Database) {
  db.run(`ALTER TABLE workers ADD COLUMN last_heartbeat INTEGER`);
}
