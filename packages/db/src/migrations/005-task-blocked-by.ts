import type { Database } from "bun:sqlite";

export const version = 5;

export function up(db: Database) {
  db.run("ALTER TABLE tasks ADD COLUMN blocked_by TEXT");
}
