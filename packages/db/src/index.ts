import { Database } from "bun:sqlite";
import { resolve } from "path";
import type { Migration } from "./migrate";
import { migrate } from "./migrate";

import * as m001 from "./migrations/001-initial";
import * as m002 from "./migrations/002-task-status";
import * as m003 from "./migrations/003-worker-tmux";
import * as m004 from "./migrations/004-worker-type";

const migrations: Migration[] = [m001, m002, m003, m004];

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

export type WorkerType = "coordinator" | "daemon" | "worker" | "release";

export interface Worker {
  id: number;
  worker_name: string;
  type: WorkerType;
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

export function getTask(db: Database, taskId: string): Task | null {
  return (db.query("SELECT id, task_id, description, status, assigned_to FROM tasks WHERE task_id = ?").get(taskId) as Task) ?? null;
}

export function addTask(db: Database, taskId: string, description: string): boolean {
  const existing = getTask(db, taskId);
  if (existing) return false;
  db.run("INSERT INTO tasks (task_id, description, status) VALUES (?, ?, 'ready')", [taskId, description]);
  return true;
}

export function createTask(db: Database, prefix: string, description: string): string {
  const rows = db.query("SELECT task_id FROM tasks WHERE task_id LIKE ? ORDER BY id DESC LIMIT 1").all(`${prefix}-%`) as { task_id: string }[];
  let next = 1;
  if (rows.length > 0) {
    const last = rows[0].task_id.slice(prefix.length + 1);
    const num = parseInt(last, 10);
    if (!isNaN(num)) next = num + 1;
  }
  const taskId = `${prefix}-${next}`;
  db.run("INSERT INTO tasks (task_id, description, status) VALUES (?, ?, 'ready')", [taskId, description]);
  return taskId;
}

export function completeTask(db: Database, taskId: string): boolean {
  const result = db.run("UPDATE tasks SET status = 'done' WHERE task_id = ?", [taskId]);
  return result.changes > 0;
}

export function assignTask(db: Database, taskId: string, workerName: string): boolean {
  const result = db.run("UPDATE tasks SET status = 'assigned', assigned_to = ? WHERE task_id = ?", [workerName, taskId]);
  return result.changes > 0;
}

export function startTask(db: Database, taskId: string): boolean {
  const result = db.run("UPDATE tasks SET status = 'in-progress' WHERE task_id = ?", [taskId]);
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

export function getWorkers(db: Database, type?: WorkerType): Worker[] {
  if (type) {
    return db.query("SELECT id, worker_name, type, status, tmux_target FROM workers WHERE type = ?").all(type) as Worker[];
  }
  return db.query("SELECT id, worker_name, type, status, tmux_target FROM workers").all() as Worker[];
}

export function addWorker(db: Database, workerName: string, tmuxTarget: string, type: WorkerType, status: string = "idle") {
  db.run(
    "INSERT INTO workers (worker_name, tmux_target, type, status) VALUES (?, ?, ?, ?) ON CONFLICT(worker_name) DO UPDATE SET tmux_target = ?, type = ?, status = ?",
    [workerName, tmuxTarget, type, status, tmuxTarget, type, status],
  );
}

export function updateWorkerStatus(db: Database, workerName: string, status: string) {
  db.run("UPDATE workers SET status = ? WHERE worker_name = ?", [status, workerName]);
}

export function removeWorker(db: Database, workerName: string): boolean {
  const result = db.run("DELETE FROM workers WHERE worker_name = ?", [workerName]);
  return result.changes > 0;
}

export function clearWorkers(db: Database) {
  db.run("DELETE FROM workers");
}
