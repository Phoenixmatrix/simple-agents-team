import { $ } from "bun";
import type { Command } from "./command";
import { getSettingsPath } from "./personas-data";

import { command as tracker } from "tracker";
import { command as workers } from "workers";
import { command as hooks } from "hooks";
import { command as daemon } from "daemon";

// Inline commands defined in the sat package
import { command as spawnWorker } from "./spawn-worker";
import { command as spawnRelease } from "./spawn-release";
import { command as getAgentName } from "./get-agent-name";
import { command as personas } from "./personas";

const commands: Command[] = [
  tracker,
  workers,
  hooks,
  daemon,
  spawnWorker,
  spawnRelease,
  getAgentName,
  personas,
];

const commandMap = new Map(commands.map((c) => [c.name, c]));

function printHelp() {
  const lines = [
    "sat - Simple Agents Team CLI",
    "",
    "Usage:",
    "  sat <command> [arguments]",
    "",
    "Commands:",
  ];
  const maxName = Math.max(...commands.map((c) => c.name.length));
  for (const cmd of commands) {
    lines.push(`  ${cmd.name.padEnd(maxName + 2)} ${cmd.description}`);
  }
  lines.push("  start" + " ".repeat(maxName - 3) + "Start the coordinator");
  lines.push("");
  lines.push("Options:");
  lines.push("  -h, --help         Show this help message");
  lines.push("");
  lines.push("Run 'sat <command> --help' for more information on a command.");
  console.log(lines.join("\n"));
}

const args = Bun.argv.slice(2);
const subcommand = args[0];

if (!subcommand || subcommand === "-h" || subcommand === "--help") {
  printHelp();
  process.exit(0);
}

if (subcommand === "start") {
  // Start the coordinator — special case, not a subcommand
  const settingsPath = getSettingsPath("coordinator");
  const cwd = process.env.SAT_CWD || process.cwd();

  // If not inside tmux, create or attach to a tmux session
  const SESSION_NAME = "sat";
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
      const proc = Bun.spawnSync(["tmux", "new-session", "-c", cwd, "-s", SESSION_NAME, "--", "sat", "start"], {
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

  // Spawn the release agent
  await $`sat spawn-release`.quiet();

  const initialPrompt = "Go through the initialization process";

  const proc = Bun.spawn(["claude", "--settings", settingsPath], {
    cwd,
    stdin: new TextEncoder().encode(initialPrompt),
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1", SAT_AGENT_NAME: "coordinator" },
  });
  await proc.exited;
} else {
  const cmd = commandMap.get(subcommand);
  if (!cmd) {
    console.error(`Unknown command: ${subcommand}`);
    printHelp();
    process.exit(1);
  }
  await cmd.run(args.slice(1));
}
