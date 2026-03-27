import { $ } from "bun";

// Get all workers and kill tmux sessions for non-coordinator workers
try {
  const output = (await $`bun workers json`.quiet()).text().trim();
  const workers = JSON.parse(output) as { worker_name: string; tmux_target: string | null }[];

  for (const worker of workers) {
    if (worker.worker_name === "coordinator") continue;
    if (!worker.tmux_target) continue;

    const sessionName = worker.tmux_target.split(":")[0];
    try {
      await $`tmux kill-session -t ${sessionName}`.quiet();
    } catch {
      // Session may already be gone
    }
  }
} catch {
  // Workers command may fail if db doesn't exist yet
}

await $`bun workers clear`.quiet();
