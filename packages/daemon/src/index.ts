import { parseArgs } from "util";
import { $ } from "bun";

const SESSION_NAME = "sat-daemon";

async function run(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
      app: { type: "boolean" },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`sat daemon - Status dashboard

Usage:
  sat daemon [options]

Options:
  -h, --help    Show this help message
  --app         Run the dashboard app directly (used internally)`);
    return;
  }

  // If --app, run the Ink app directly
  if (values.app) {
    await import("./app");
    // app.tsx takes over from here
  } else {
    // Check if daemon is already running
    let alreadyRunning = false;
    let sessionExists = false;

    // Step 1: Is daemon registered in workers?
    let daemonTarget: string | null = null;
    try {
      const output = (await $`sat workers json`.quiet()).text().trim();
      const workers = JSON.parse(output) as { worker_name: string; tmux_target: string | null }[];
      const daemon = workers.find((w) => w.worker_name === "daemon");
      daemonTarget = daemon?.tmux_target ?? null;
    } catch {
      // No workers db yet
    }

    // Step 2: If registered, check if the tmux session and process are alive
    if (daemonTarget) {
      try {
        await $`tmux has-session -t ${SESSION_NAME}`.quiet();
        sessionExists = true;
      } catch {
        // Session gone
      }

      if (sessionExists) {
        const panePid = (await $`tmux list-panes -t ${daemonTarget} -F '#{pane_pid}'`.quiet()).text().trim();
        const result = Bun.spawnSync(["pgrep", "-P", panePid]);
        if (result.exitCode === 0) {
          const stdout = result.stdout.toString().trim();
          const selfPids = new Set([String(process.pid), String(process.ppid)]);
          const childPids = stdout.split("\n").filter((pid) => pid && !selfPids.has(pid));
          if (childPids.length > 0) {
            alreadyRunning = true;
          }
        }
      }
    }

    if (alreadyRunning) {
      console.log(`Daemon is already running in tmux session ${SESSION_NAME}`);
      return;
    }

    // Reuse existing session or create a new one
    if (!sessionExists) {
      try {
        await $`tmux has-session -t ${SESSION_NAME}`.quiet();
        sessionExists = true;
      } catch {
        // No session
      }
    }

    if (!sessionExists) {
      await $`tmux new-session -d -s ${SESSION_NAME}`.quiet();
    }

    // Get the tmux target
    const tmuxTarget = (await $`tmux display-message -p -t ${SESSION_NAME} '#{session_name}:#{window_index}.#{pane_index}'`.quiet()).text().trim();

    // Register in workers
    await $`sat workers add daemon ${tmuxTarget} daemon`.quiet();

    // Configure status bar
    await $`tmux set-option -t ${SESSION_NAME} status-left-length 25`.quiet();
    Bun.spawnSync(["tmux", "set-option", "-t", SESSION_NAME, "status-left", " 📊 daemon "], { stdio: ["ignore", "ignore", "ignore"] });
    await $`tmux set-option -t ${SESSION_NAME} status-right ''`.quiet();
    await $`tmux set-option -t ${SESSION_NAME} automatic-rename off`.quiet();

    // Launch the daemon app in the tmux session
    await $`tmux send-keys -t ${tmuxTarget} 'sat daemon --app' Enter`.quiet();

    console.log(`Daemon started in tmux session ${SESSION_NAME} (${tmuxTarget})`);
  }
}

export const command = {
  name: "daemon",
  description: "Status dashboard",
  run,
};
