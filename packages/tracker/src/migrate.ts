import type { Database } from "bun:sqlite";

export interface Migration {
  version: number;
  up: (db: Database) => void;
}

export function migrate(db: Database, migrations: Migration[]) {
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  const currentVersion = db.query("PRAGMA user_version").get() as { user_version: number };

  for (const migration of sorted) {
    if (migration.version > currentVersion.user_version) {
      db.transaction(() => {
        migration.up(db);
        db.run(`PRAGMA user_version = ${migration.version}`);
      })();
    }
  }
}
