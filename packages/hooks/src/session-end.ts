import { $ } from "bun";
import { openDatabase, getWorkersByWorkspace, getWorkers, clearWorkersByWorkspace, clearWorkers, type Worker } from "db";

const workspace = process.env.PX_WORKSPACE;

try {
  const db = openDatabase();

  // Get workers to kill — try workspace scoping, fall back to all
  let workers: Worker[] = [];
  if (workspace) {
    workers = getWorkersByWorkspace(db, workspace);
  }
  if (workers.length === 0) {
    workers = getWorkers(db);
  }

  for (const worker of workers) {
    if (worker.type === "coordinator") continue;
    if (!worker.tmux_target) continue;

    const sessionName = worker.tmux_target.split(":")[0];
    try {
      await $`tmux kill-session -t ${sessionName}`.quiet();
    } catch {
      // Session may already be gone
    }
  }

  // Clear workers from DB
  if (workspace) {
    clearWorkersByWorkspace(db, workspace);
  } else {
    clearWorkers(db);
  }
  db.close();
} catch {
  // DB may not exist yet
}
