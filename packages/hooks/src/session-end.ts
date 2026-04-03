import { $ } from "bun";

const prefix = process.env.PX_SESSION_PREFIX;

// Get all workers and kill tmux sessions for non-coordinator workers matching our prefix
try {
  const output = (await $`px workers json`.quiet()).text().trim();
  const workers = JSON.parse(output) as { worker_name: string; tmux_target: string | null; session_prefix: string | null }[];

  for (const worker of workers) {
    if (worker.worker_name === "coordinator") continue;
    if (!worker.tmux_target) continue;
    // Only kill workers belonging to this session's prefix
    if (prefix && worker.session_prefix !== prefix) continue;

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

if (prefix) {
  await $`px workers clear-prefix ${prefix}`.quiet();
} else {
  await $`px workers clear`.quiet();
}
