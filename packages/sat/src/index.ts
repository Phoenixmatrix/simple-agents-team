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
  console.log(`sat - simple agents team CLI

Usage:
  sat [options]

Options:
  -h, --help    Show this help message`);
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
await $`bun workers clear`.quiet();
await $`bun workers add coordinator ${tmuxTarget}`.quiet();

// Configure tmux status bar for this session
await $`tmux set-option status-left-length 25`.quiet();
Bun.spawnSync(["tmux", "set-option", "status-left", " 🤖 coordinator "], { stdio: ["ignore", "ignore", "ignore"] });
await $`tmux set-option status-right ''`.quiet();

const initialPrompt = "Go through the initialization process";

const proc = Bun.spawn(["claude", "--settings", settingsPath, "--model", "claude-sonnet-4-6"], {
  stdin: new TextEncoder().encode(initialPrompt),
  stdout: "inherit",
  stderr: "inherit",
  env: { ...process.env, CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1", SAT_AGENT_NAME: "coordinator" },
});
await proc.exited;
