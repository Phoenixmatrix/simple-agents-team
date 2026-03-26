import { Database } from "bun:sqlite";
import { resolve } from "path";
import type { Migration } from "./migrate";
import { migrate } from "./migrate";

import * as m001 from "./migrations/001-initial";
import * as m002 from "./migrations/002-task-status";
import * as m003 from "./migrations/003-worker-tmux";

const migrations: Migration[] = [m001, m002, m003];

export function getDbPath(): string {
  // Walk up from any package to find the project root data/ dir
  const rootDir = resolve(import.meta.dirname, "../../..");
  return resolve(rootDir, "data/sat.db");
}

export function openDatabase(path?: string): Database {
  const db = new Database(path ?? getDbPath());
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA busy_timeout = 5000");
  migrate(db, migrations);
  return db;
}

// --- Types ---

export interface Task {
  id: number;
  task_id: string;
  description: string;
  status: string;
  assigned_to: string | null;
}

export interface Worker {
  id: number;
  worker_name: string;
  status: string;
  tmux_target: string | null;
}

// --- Task queries ---

export function getTasks(db: Database, statusFilter?: string | string[]): Task[] {
  if (statusFilter) {
    const statuses = Array.isArray(statusFilter) ? statusFilter : [statusFilter];
    const placeholders = statuses.map(() => "?").join(", ");
    return db.query(`SELECT id, task_id, description, status, assigned_to FROM tasks WHERE status IN (${placeholders})`).all(...statuses) as Task[];
  }
  return db.query("SELECT id, task_id, description, status, assigned_to FROM tasks").all() as Task[];
}

export function addTask(db: Database, taskId: string, description: string) {
  db.run("INSERT INTO tasks (task_id, description, status) VALUES (?, ?, 'ready')", [taskId, description]);
}

export function completeTask(db: Database, taskId: string): boolean {
  const result = db.run("UPDATE tasks SET status = 'done' WHERE task_id = ?", [taskId]);
  return result.changes > 0;
}

export function assignTask(db: Database, taskId: string, workerName: string): boolean {
  const result = db.run("UPDATE tasks SET status = 'in-progress', assigned_to = ? WHERE task_id = ?", [workerName, taskId]);
  return result.changes > 0;
}

export function unassignTask(db: Database, taskId: string): boolean {
  const result = db.run("UPDATE tasks SET status = 'ready', assigned_to = NULL WHERE task_id = ?", [taskId]);
  return result.changes > 0;
}

export function deleteTask(db: Database, taskId: string): boolean {
  const result = db.run("DELETE FROM tasks WHERE task_id = ?", [taskId]);
  return result.changes > 0;
}

export function clearTasks(db: Database) {
  db.run("DELETE FROM tasks");
}

// --- Worker queries ---

export function getWorkers(db: Database): Worker[] {
  return db.query("SELECT id, worker_name, status, tmux_target FROM workers").all() as Worker[];
}

export function addWorker(db: Database, workerName: string, tmuxTarget: string, status: string = "idle") {
  db.run(
    "INSERT INTO workers (worker_name, tmux_target, status) VALUES (?, ?, ?) ON CONFLICT(worker_name) DO UPDATE SET tmux_target = ?, status = ?",
    [workerName, tmuxTarget, status, tmuxTarget, status],
  );
}

export function updateWorkerStatus(db: Database, workerName: string, status: string) {
  db.run("UPDATE workers SET status = ? WHERE worker_name = ?", [status, workerName]);
}

export function clearWorkers(db: Database) {
  db.run("DELETE FROM workers");
}
