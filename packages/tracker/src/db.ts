import { Database } from "bun:sqlite";
import type { Migration } from "./migrate";
import { migrate } from "./migrate";

import * as m001 from "./migrations/001-initial";

const migrations: Migration[] = [m001];

export function openDatabase(path: string): Database {
  const db = new Database(path);
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA busy_timeout = 5000");
  migrate(db, migrations);
  return db;
}

export interface Task {
  id: number;
  task_id: string;
  description: string;
}

export interface Worker {
  id: number;
  worker_name: string;
  status: string;
}

export function getTasks(db: Database): Task[] {
  return db.query("SELECT id, task_id, description FROM tasks").all() as Task[];
}

export function getWorkers(db: Database): Worker[] {
  return db.query("SELECT id, worker_name, status FROM workers").all() as Worker[];
}

export function addTask(db: Database, taskId: string, description: string) {
  db.run("INSERT INTO tasks (task_id, description) VALUES (?, ?)", [taskId, description]);
}

export function addWorker(db: Database, workerName: string, status: string = "idle") {
  db.run(
    "INSERT INTO workers (worker_name, status) VALUES (?, ?) ON CONFLICT(worker_name) DO UPDATE SET status = ?",
    [workerName, status, status],
  );
}

export function updateWorkerStatus(db: Database, workerName: string, status: string) {
  db.run("UPDATE workers SET status = ? WHERE worker_name = ?", [status, workerName]);
}

export function deleteTask(db: Database, taskId: string): boolean {
  const result = db.run("DELETE FROM tasks WHERE task_id = ?", [taskId]);
  return result.changes > 0;
}

export function clearTasks(db: Database) {
  db.run("DELETE FROM tasks");
}

export function clearWorkers(db: Database) {
  db.run("DELETE FROM workers");
}
