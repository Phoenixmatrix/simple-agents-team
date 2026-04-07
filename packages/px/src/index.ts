import { $ } from "bun";
import type { Command } from "./command";
import { getSettingsPath } from "./personas-data";
import { getSessionPrefix, openDatabase, clearWorkersByWorkspace, addWorker } from "db";
import { detectRepos, resolveRepoPrefix } from "./workspace";

import { command as tracker } from "tracker";
import { command as workers } from "workers";
import { command as hooks } from "hooks";
import { command as daemon } from "daemon";

// Inline commands defined in the px package
import { command as spawnWorker } from "./spawn-worker";
import { command as spawnRelease } from "./spawn-release";
import { command as getAgentName } from "./get-agent-name";
import { command as personas } from "./personas";
import { command as repo } from "./repo";
import { command as dashboard } from "dashboard";
import { command as heartbeat } from "./heartbeat";

const commands: Command[] = [
  tracker,
  workers,
  hooks,
  daemon,
  spawnWorker,
  spawnRelease,
  getAgentName,
  personas,
  repo,
  dashboard,
  heartbeat,
];

const commandMap = new Map(commands.map((c) => [c.name, c]));

function printHelp() {
  const lines = [
    "px - px CLI",
    "",
    "Usage:",
    "  px <command> [arguments]",
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
  lines.push("Run 'px <command> --help' for more information on a command.");
  console.log(lines.join("\n"));
}

// Compute and cache session prefix — for non-start commands, use the existing logic.
// For "start", the prefix is derived from the workspace dir (handled below).
if (!process.env.PX_SESSION_PREFIX) {
  const isStart = Bun.argv[2] === "start";
  if (!isStart) {
    try {
      process.env.PX_SESSION_PREFIX = getSessionPrefix();
    } catch {
      // getSessionPrefix() fails if not in a git repo (e.g., workspace directory).
      // That's fine — commands like dashboard/repo work without it.
    }
  }
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
  const cwd = process.env.PX_CWD || process.cwd();

  // Workspace = the directory we're starting from
  const workspace = cwd;

  // Derive workspace prefix for coordinator/daemon session naming
  const wsPrefix = resolveRepoPrefix(workspace);
  process.env.PX_SESSION_PREFIX = wsPrefix;
  process.env.PX_WORKSPACE = workspace;

  // If not inside tmux, create a new tmux session and re-exec inside it
  if (!process.env.TMUX) {
    const SESSION_NAME = wsPrefix;
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
      const proc = Bun.spawnSync(["tmux", "new-session", "-c", cwd, "-s", SESSION_NAME, "--", "px", "start"], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
        env: { ...process.env, PX_WORKSPACE: workspace, PX_SESSION_PREFIX: wsPrefix },
      });
      process.exit(proc.exitCode);
    }
  }

  // Running inside tmux — stay in the current pane
  const tmuxTarget = (await $`tmux display-message -p '#{session_name}:#{window_index}.#{pane_index}'`.quiet()).text().trim();

  // Clear workers scoped to this workspace and register coordinator
  {
    const db = openDatabase();
    clearWorkersByWorkspace(db, workspace);
    addWorker(db, "coordinator", tmuxTarget, "coordinator", "idle", wsPrefix, undefined, workspace);
    db.close();
  }

  // Configure tmux status bar for this pane's window
  await $`tmux set-option status-left-length 25`.quiet();
  Bun.spawnSync(["tmux", "set-option", "status-left", ` 🤖 coordinator (${wsPrefix}) `], { stdio: ["ignore", "ignore", "ignore"] });
  await $`tmux set-option status-right ''`.quiet();

  // Detect repos in workspace and spawn a release agent for each
  const repos = detectRepos(workspace);
  for (const repo of repos) {
    try {
      await $`px spawn-release --repo ${repo.slug}`.quiet();
    } catch (e) {
      console.error(`Failed to spawn release agent for ${repo.slug}:`, e);
    }
  }

  const repoSummary = repos.length > 0
    ? repos.map((r) => r.slug).join(", ")
    : "(no repos found)";

  const initialPrompt = `Go through the initialization process. Workspace: ${workspace}. Repos: ${repoSummary}`;

  const proc = Bun.spawn(["claude", "--settings", settingsPath], {
    cwd,
    stdin: new TextEncoder().encode(initialPrompt),
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1", PX_AGENT_NAME: "coordinator", PX_WORKSPACE: workspace },
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
