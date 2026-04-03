import type { Database } from "bun:sqlite";

export const version = 8;

export function up(db: Database) {
  db.run(`CREATE TABLE IF NOT EXISTS portfolios (
    agent_name TEXT PRIMARY KEY,
    name TEXT NOT NULL
  )`);
}
