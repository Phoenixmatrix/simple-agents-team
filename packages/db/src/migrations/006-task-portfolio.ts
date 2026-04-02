import type { Database } from "bun:sqlite";

export const version = 6;

export function up(db: Database) {
  db.run("ALTER TABLE tasks ADD COLUMN portfolio TEXT");
}
