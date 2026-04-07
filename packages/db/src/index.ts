import { Database, type SQLQueryBindings } from "bun:sqlite";
import { resolve, dirname } from "path";
import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
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
import * as m009 from "./migrations/009-multi-repo";
import * as m010 from "./migrations/010-worker-heartbeat";

const migrations: Migration[] = [m001, m002, m003, m004, m005, m006, m007, m008, m009, m010];

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

function resolvePrefix(dirPath: string): string {
  const basename = dirPath.split("/").pop() || "repo";
  const base = abbreviate(basename);

  // Check if we already have workers registered with this prefix in the global DB
  try {
    const dbPath = getDbPath();
    if (existsSync(dbPath)) {
      const db = new Database(dbPath);
      db.run("PRAGMA journal_mode = WAL");
      db.run("PRAGMA busy_timeout = 5000");
      // Look for workers that have this prefix and are in this directory's workspace
      const row = db.query("SELECT session_prefix FROM workers WHERE session_prefix IS NOT NULL AND session_prefix LIKE ? LIMIT 1").get(`${base}%`) as { session_prefix: string } | null;
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

export function getSessionPrefix(): string {
  if (process.env.PX_SESSION_PREFIX) {
    return process.env.PX_SESSION_PREFIX;
  }
  return resolvePrefix(getGitRepoRoot());
}

const PX_DIR = resolve(process.env.HOME ?? "~", ".px");

export function getDbPath(): string {
  return resolve(PX_DIR, DB_FILENAME);
}

export function openDatabase(path?: string): Database {
  const dbPath = path ?? getDbPath();
  if (!path) {
    mkdirSync(PX_DIR, { recursive: true });
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
  repo: string | null;
}

export type WorkerType = "coordinator" | "daemon" | "worker" | "release";

export interface Worker {
  id: number;
  worker_name: string;
  type: WorkerType;
  status: string;
  tmux_target: string | null;
  session_prefix: string | null;
  repo: string | null;
  workspace: string | null;
  last_heartbeat: number | null;
}

// --- Task queries ---

const TASK_COLS = "id, task_id, description, status, assigned_to, blocked_by, portfolio, repo";

export function getTasks(db: Database, statusFilter?: string | string[], repo?: string): Task[] {
  const params: SQLQueryBindings[] = [];
  const conditions: string[] = [];

  if (statusFilter) {
    const statuses = Array.isArray(statusFilter) ? statusFilter : [statusFilter];
    conditions.push(`status IN (${statuses.map(() => "?").join(", ")})`);
    params.push(...statuses);
  }
  if (repo !== undefined) {
    conditions.push("repo = ?");
    params.push(repo);
  }

  const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
  return db.query(`SELECT ${TASK_COLS} FROM tasks${where}`).all(...params) as Task[];
}

export function getTasksForWorker(db: Database, workerName: string, repo?: string): Task[] {
  if (repo !== undefined) {
    return db.query(`SELECT ${TASK_COLS} FROM tasks WHERE assigned_to = ? AND repo = ? AND status IN ('assigned', 'in-progress')`).all(workerName, repo) as Task[];
  }
  return db.query(`SELECT ${TASK_COLS} FROM tasks WHERE assigned_to = ? AND status IN ('assigned', 'in-progress')`).all(workerName) as Task[];
}

export function getTask(db: Database, taskId: string, repo?: string): Task | null {
  if (repo !== undefined) {
    return (db.query(`SELECT ${TASK_COLS} FROM tasks WHERE task_id = ? AND repo = ?`).get(taskId, repo) as Task) ?? null;
  }
  return (db.query(`SELECT ${TASK_COLS} FROM tasks WHERE task_id = ?`).get(taskId) as Task) ?? null;
}

export function addTask(db: Database, taskId: string, description: string, blockedBy?: string, portfolio?: string, repo?: string): boolean {
  const existing = getTask(db, taskId, repo);
  if (existing) return false;
  db.run("INSERT INTO tasks (task_id, description, status, blocked_by, portfolio, repo) VALUES (?, ?, 'ready', ?, ?, ?)", [taskId, description, blockedBy ?? null, portfolio ?? null, repo ?? null]);
  return true;
}

export function createTask(db: Database, prefix: string, description: string, blockedBy?: string, portfolio?: string, repo?: string): string {
  // Auto-increment scoped by repo
  let rows: { task_id: string }[];
  if (repo !== undefined) {
    rows = db.query("SELECT task_id FROM tasks WHERE task_id LIKE ? AND repo = ? ORDER BY id DESC LIMIT 1").all(`${prefix}-%`, repo) as { task_id: string }[];
  } else {
    rows = db.query("SELECT task_id FROM tasks WHERE task_id LIKE ? AND repo IS NULL ORDER BY id DESC LIMIT 1").all(`${prefix}-%`) as { task_id: string }[];
  }
  let next = 1;
  if (rows.length > 0) {
    const last = rows[0].task_id.slice(prefix.length + 1);
    const num = parseInt(last, 10);
    if (!isNaN(num)) next = num + 1;
  }
  const taskId = `${prefix}-${next}`;
  db.run("INSERT INTO tasks (task_id, description, status, blocked_by, portfolio, repo) VALUES (?, ?, 'ready', ?, ?, ?)", [taskId, description, blockedBy ?? null, portfolio ?? null, repo ?? null]);
  return taskId;
}

export function completeTask(db: Database, taskId: string, repo?: string): boolean {
  if (repo !== undefined) {
    const result = db.run("UPDATE tasks SET status = 'done' WHERE task_id = ? AND repo = ?", [taskId, repo]);
    return result.changes > 0;
  }
  const result = db.run("UPDATE tasks SET status = 'done' WHERE task_id = ?", [taskId]);
  return result.changes > 0;
}

export function assignTask(db: Database, taskId: string, workerName: string, repo?: string): boolean {
  if (repo !== undefined) {
    const result = db.run("UPDATE tasks SET status = 'assigned', assigned_to = ? WHERE task_id = ? AND repo = ?", [workerName, taskId, repo]);
    return result.changes > 0;
  }
  const result = db.run("UPDATE tasks SET status = 'assigned', assigned_to = ? WHERE task_id = ?", [workerName, taskId]);
  return result.changes > 0;
}

export function startTask(db: Database, taskId: string, repo?: string): { ok: boolean; blocked?: string } {
  const task = getTask(db, taskId, repo);
  if (!task) return { ok: false };
  if (task.blocked_by) {
    const blocker = getTask(db, task.blocked_by, repo);
    if (!blocker || blocker.status !== "done") {
      return { ok: false, blocked: task.blocked_by };
    }
  }
  if (repo !== undefined) {
    const result = db.run("UPDATE tasks SET status = 'in-progress' WHERE task_id = ? AND repo = ?", [taskId, repo]);
    return { ok: result.changes > 0 };
  }
  const result = db.run("UPDATE tasks SET status = 'in-progress' WHERE task_id = ?", [taskId]);
  return { ok: result.changes > 0 };
}

export function unassignTask(db: Database, taskId: string, repo?: string): boolean {
  if (repo !== undefined) {
    const result = db.run("UPDATE tasks SET status = 'ready', assigned_to = NULL WHERE task_id = ? AND repo = ?", [taskId, repo]);
    return result.changes > 0;
  }
  const result = db.run("UPDATE tasks SET status = 'ready', assigned_to = NULL WHERE task_id = ?", [taskId]);
  return result.changes > 0;
}

export function deleteTask(db: Database, taskId: string, repo?: string): boolean {
  if (repo !== undefined) {
    const result = db.run("DELETE FROM tasks WHERE task_id = ? AND repo = ?", [taskId, repo]);
    return result.changes > 0;
  }
  const result = db.run("DELETE FROM tasks WHERE task_id = ?", [taskId]);
  return result.changes > 0;
}

export function clearTasks(db: Database) {
  db.run("DELETE FROM tasks");
}

// --- Worker queries ---

const WORKER_COLS = "id, worker_name, type, status, tmux_target, session_prefix, repo, workspace, last_heartbeat";

export function getWorkers(db: Database, type?: WorkerType, repo?: string): Worker[] {
  const conditions: string[] = [];
  const params: SQLQueryBindings[] = [];
  if (type) { conditions.push("type = ?"); params.push(type); }
  if (repo !== undefined) { conditions.push("repo = ?"); params.push(repo); }
  const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
  return db.query(`SELECT ${WORKER_COLS} FROM workers${where}`).all(...params) as Worker[];
}

export function getWorkersByPrefix(db: Database, prefix: string): Worker[] {
  return db.query(`SELECT ${WORKER_COLS} FROM workers WHERE session_prefix = ?`).all(prefix) as Worker[];
}

export function getWorkersByWorkspace(db: Database, workspace: string): Worker[] {
  return db.query(`SELECT ${WORKER_COLS} FROM workers WHERE workspace = ?`).all(workspace) as Worker[];
}

export function clearWorkersByPrefix(db: Database, prefix: string) {
  db.run("DELETE FROM workers WHERE session_prefix = ?", [prefix]);
}

export function clearWorkersByWorkspace(db: Database, workspace: string) {
  db.run("DELETE FROM workers WHERE workspace = ?", [workspace]);
}

export function addWorker(db: Database, workerName: string, tmuxTarget: string, type: WorkerType, status: string = "idle", prefix?: string, repo?: string, workspace?: string) {
  db.run(
    `INSERT INTO workers (worker_name, tmux_target, type, status, session_prefix, repo, workspace) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(worker_name, repo) DO UPDATE SET tmux_target = ?, type = ?, status = ?, session_prefix = ?, workspace = ?`,
    [workerName, tmuxTarget, type, status, prefix ?? null, repo ?? null, workspace ?? null, tmuxTarget, type, status, prefix ?? null, workspace ?? null],
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

// --- Heartbeat queries ---

export function setHeartbeat(db: Database, workerName: string) {
  db.run("UPDATE workers SET last_heartbeat = ? WHERE worker_name = ?", [Date.now(), workerName]);
}

export function clearHeartbeat(db: Database, workerName: string) {
  db.run("UPDATE workers SET last_heartbeat = NULL WHERE worker_name = ?", [workerName]);
}

export function getStaleWorkers(db: Database, thresholdMs: number): Worker[] {
  const cutoff = Date.now() - thresholdMs;
  return db.query(`SELECT ${WORKER_COLS} FROM workers WHERE last_heartbeat IS NOT NULL AND last_heartbeat < ?`).all(cutoff) as Worker[];
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

// --- Utility exports ---

export { abbreviate, resolvePrefix };
