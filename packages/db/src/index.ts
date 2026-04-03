import { Database } from "bun:sqlite";
import { resolve, dirname } from "path";
import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import type { Migration } from "./migrate";
import { migrate } from "./migrate";

import * as m001 from "./migrations/001-initial";
import * as m002 from "./migrations/002-task-status";
import * as m003 from "./migrations/003-worker-tmux";
import * as m004 from "./migrations/004-worker-type";
import * as m005 from "./migrations/005-task-blocked-by";
import * as m006 from "./migrations/006-task-portfolio";
import * as m007 from "./migrations/007-worker-prefix";
import * as m008 from "./migrations/008-portfolios";

const migrations: Migration[] = [m001, m002, m003, m004, m005, m006, m007, m008];

const DB_FILENAME = "px.db";

function abbreviate(name: string): string {
  // Split on hyphens, underscores, dots, camelCase, and uppercase runs
  const parts = name
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2") // ABCWidget → ABC-Widget
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")     // camelCase → camel-Case
    .split(/[-_.]+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(0, 3).map((p) => p[0].toLowerCase()).join("");
  }
  // Single word: take first 2 chars
  return name.slice(0, 2).toLowerCase();
}

function getTmuxSessionNames(): Set<string> {
  try {
    const output = execSync("tmux list-sessions -F '#{session_name}'", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return new Set(output.split("\n").filter(Boolean));
  } catch {
    return new Set();
  }
}

function resolvePrefix(repoRoot: string): string {
  const basename = repoRoot.split("/").pop() || "repo";
  const base = abbreviate(basename);

  // Check if we already have workers registered with a prefix in our DB
  try {
    const dbPath = resolve(repoRoot, DB_FILENAME);
    if (existsSync(dbPath)) {
      const db = new Database(dbPath);
      db.run("PRAGMA journal_mode = WAL");
      db.run("PRAGMA busy_timeout = 5000");
      const row = db.query("SELECT session_prefix FROM workers WHERE session_prefix IS NOT NULL LIMIT 1").get() as { session_prefix: string } | null;
      db.close();
      if (row) return row.session_prefix;
    }
  } catch {
    // DB may not exist yet or lack the column
  }

  // No existing prefix — check tmux sessions for conflicts
  const sessions = getTmuxSessionNames();
  let candidate = base;
  // A prefix is "taken" if a tmux session starts with it (e.g., "fbb-daemon")
  const isTaken = (pfx: string) => {
    for (const s of sessions) {
      if (s === pfx || s.startsWith(`${pfx}-`)) return true;
    }
    return false;
  };

  if (!isTaken(candidate)) return candidate;

  let i = 0;
  do {
    candidate = `${base}${i}`;
    i++;
  } while (isTaken(candidate));

  return candidate;
}

export function getGitRepoRoot(): string {
  // Use PX_CWD as the working directory because bin/px cds to the px repo
  // root before running bun, so process.cwd() is always the px repo itself.
  const cwd = process.env.PX_CWD || process.cwd();
  // Use --git-common-dir so worktrees resolve to the main repo's .git
  const gitCommonDir = execSync("git rev-parse --git-common-dir", {
    encoding: "utf-8",
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
  // --git-common-dir returns a path relative to cwd (or absolute).
  // The repo root is the parent of the .git directory.
  return dirname(resolve(cwd, gitCommonDir));
}

function ensureGitignored(repoRoot: string) {
  const gitignorePath = resolve(repoRoot, ".gitignore");
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, "utf-8");
    const lines = content.split("\n");
    if (lines.some((line) => line.trim() === DB_FILENAME || line.trim() === `/${DB_FILENAME}`)) {
      return; // already ignored
    }
    // Also covered if *.db is already in gitignore
    if (lines.some((line) => line.trim() === "*.db")) {
      return;
    }
    writeFileSync(gitignorePath, content.trimEnd() + "\n" + DB_FILENAME + "\n");
  } else {
    writeFileSync(gitignorePath, DB_FILENAME + "\n");
  }
}

export function getSessionPrefix(): string {
  if (process.env.PX_SESSION_PREFIX) {
    return process.env.PX_SESSION_PREFIX;
  }
  return resolvePrefix(getGitRepoRoot());
}

export function getDbPath(): string {
  const repoRoot = getGitRepoRoot();
  return resolve(repoRoot, DB_FILENAME);
}

export function openDatabase(path?: string): Database {
  const dbPath = path ?? getDbPath();
  if (!path) {
    // Only auto-check gitignore when using the default repo-scoped path
    ensureGitignored(dirname(dbPath));
  }
  const db = new Database(dbPath);
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
  blocked_by: string | null;
  portfolio: string | null;
}

export type WorkerType = "coordinator" | "daemon" | "worker" | "release";

export interface Worker {
  id: number;
  worker_name: string;
  type: WorkerType;
  status: string;
  tmux_target: string | null;
  session_prefix: string | null;
}

// --- Task queries ---

export function getTasks(db: Database, statusFilter?: string | string[]): Task[] {
  if (statusFilter) {
    const statuses = Array.isArray(statusFilter) ? statusFilter : [statusFilter];
    const placeholders = statuses.map(() => "?").join(", ");
    return db.query(`SELECT id, task_id, description, status, assigned_to, blocked_by, portfolio FROM tasks WHERE status IN (${placeholders})`).all(...statuses) as Task[];
  }
  return db.query("SELECT id, task_id, description, status, assigned_to, blocked_by, portfolio FROM tasks").all() as Task[];
}

export function getTasksForWorker(db: Database, workerName: string): Task[] {
  return db.query("SELECT id, task_id, description, status, assigned_to, blocked_by, portfolio FROM tasks WHERE assigned_to = ? AND status IN ('assigned', 'in-progress')").all(workerName) as Task[];
}

export function getTask(db: Database, taskId: string): Task | null {
  return (db.query("SELECT id, task_id, description, status, assigned_to, blocked_by, portfolio FROM tasks WHERE task_id = ?").get(taskId) as Task) ?? null;
}

export function addTask(db: Database, taskId: string, description: string, blockedBy?: string, portfolio?: string): boolean {
  const existing = getTask(db, taskId);
  if (existing) return false;
  db.run("INSERT INTO tasks (task_id, description, status, blocked_by, portfolio) VALUES (?, ?, 'ready', ?, ?)", [taskId, description, blockedBy ?? null, portfolio ?? null]);
  return true;
}

export function createTask(db: Database, prefix: string, description: string, blockedBy?: string, portfolio?: string): string {
  const rows = db.query("SELECT task_id FROM tasks WHERE task_id LIKE ? ORDER BY id DESC LIMIT 1").all(`${prefix}-%`) as { task_id: string }[];
  let next = 1;
  if (rows.length > 0) {
    const last = rows[0].task_id.slice(prefix.length + 1);
    const num = parseInt(last, 10);
    if (!isNaN(num)) next = num + 1;
  }
  const taskId = `${prefix}-${next}`;
  db.run("INSERT INTO tasks (task_id, description, status, blocked_by, portfolio) VALUES (?, ?, 'ready', ?, ?)", [taskId, description, blockedBy ?? null, portfolio ?? null]);
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

export function startTask(db: Database, taskId: string): { ok: boolean; blocked?: string } {
  const task = getTask(db, taskId);
  if (!task) return { ok: false };
  if (task.blocked_by) {
    const blocker = getTask(db, task.blocked_by);
    if (!blocker || blocker.status !== "done") {
      return { ok: false, blocked: task.blocked_by };
    }
  }
  const result = db.run("UPDATE tasks SET status = 'in-progress' WHERE task_id = ?", [taskId]);
  return { ok: result.changes > 0 };
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
    return db.query("SELECT id, worker_name, type, status, tmux_target, session_prefix FROM workers WHERE type = ?").all(type) as Worker[];
  }
  return db.query("SELECT id, worker_name, type, status, tmux_target, session_prefix FROM workers").all() as Worker[];
}

export function getWorkersByPrefix(db: Database, prefix: string): Worker[] {
  return db.query("SELECT id, worker_name, type, status, tmux_target, session_prefix FROM workers WHERE session_prefix = ?").all(prefix) as Worker[];
}

export function clearWorkersByPrefix(db: Database, prefix: string) {
  db.run("DELETE FROM workers WHERE session_prefix = ?", [prefix]);
}

export function addWorker(db: Database, workerName: string, tmuxTarget: string, type: WorkerType, status: string = "idle", prefix?: string) {
  db.run(
    "INSERT INTO workers (worker_name, tmux_target, type, status, session_prefix) VALUES (?, ?, ?, ?, ?) ON CONFLICT(worker_name) DO UPDATE SET tmux_target = ?, type = ?, status = ?, session_prefix = ?",
    [workerName, tmuxTarget, type, status, prefix ?? null, tmuxTarget, type, status, prefix ?? null],
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

// --- Portfolio queries ---

export function getPortfolio(db: Database, agentName: string): string | null {
  const row = db.query("SELECT name FROM portfolios WHERE agent_name = ?").get(agentName) as { name: string } | null;
  return row?.name ?? null;
}

export function setPortfolio(db: Database, agentName: string, name: string) {
  db.run(
    "INSERT INTO portfolios (agent_name, name) VALUES (?, ?) ON CONFLICT(agent_name) DO UPDATE SET name = ?",
    [agentName, name, name],
  );
}

export function clearPortfolio(db: Database, agentName: string) {
  db.run("DELETE FROM portfolios WHERE agent_name = ?", [agentName]);
}
