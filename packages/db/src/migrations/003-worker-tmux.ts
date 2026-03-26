import type { Database } from "bun:sqlite";

export const version = 3;

export function up(db: Database) {
  db.run(`ALTER TABLE workers ADD COLUMN tmux_target TEXT`);
}
