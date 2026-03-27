import { parseArgs } from "util";
import { resolve, dirname } from "path";
import { $ } from "bun";

const rootDir = resolve(dirname(Bun.main), "../../..");
const settingsPath = resolve(rootDir, "personas/coordinator/settings.json");
const SESSION_NAME = "sat";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    help: {
      type: "boolean",
      short: "h",
    },
  },
  allowPositionals: true,
});

if (values.help) {
  console.log(`sat - Simple Agents Team CLI

Usage:
  sat <command> [arguments]

Commands:
  start              Start the coordinator
  tracker            Task tracker
  workers            Worker manager
  spawn-worker       Spawn a new worker agent
  get-agent-name     Generate a unique agent name
  daemon             Start the daemon
  hooks              Run a lifecycle hook
  personas           Get the path to a persona directory

Options:
  -h, --help         Show this help message

Run 'sat <command> --help' for more information on a command.`);
  process.exit(0);
}

// If not inside tmux, create or attach to a tmux session
if (!process.env.TMUX) {
  let hasSession = false;
  try {
    await $`tmux has-session -t ${SESSION_NAME}`.quiet();
    hasSession = true;
  } catch {}

  if (hasSession) {
    const proc = Bun.spawnSync(["tmux", "attach-session", "-t", SESSION_NAME], {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    process.exit(proc.exitCode);
  } else {
    const proc = Bun.spawnSync(["tmux", "new-session", "-s", SESSION_NAME, "--", "bun", "sat"], {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    process.exit(proc.exitCode);
  }
}

// Clear previous state and register coordinator worker
const tmuxTarget = (await $`tmux display-message -p '#{session_name}:#{window_index}.#{pane_index}'`.quiet()).text().trim();
await $`sat workers clear`.quiet();
await $`sat workers add coordinator ${tmuxTarget} coordinator`.quiet();

// Configure tmux status bar for this session
await $`tmux set-option status-left-length 25`.quiet();
Bun.spawnSync(["tmux", "set-option", "status-left", " 🤖 coordinator "], { stdio: ["ignore", "ignore", "ignore"] });
await $`tmux set-option status-right ''`.quiet();

const initialPrompt = "Go through the initialization process";

const proc = Bun.spawn(["claude", "--settings", settingsPath], {
  stdin: new TextEncoder().encode(initialPrompt),
  stdout: "inherit",
  stderr: "inherit",
  env: { ...process.env, CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1", SAT_AGENT_NAME: "coordinator" },
});
await proc.exited;
