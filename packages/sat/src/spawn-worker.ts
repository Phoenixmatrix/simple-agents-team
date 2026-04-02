import { parseArgs } from "util";
import { resolve, dirname } from "path";
import { $ } from "bun";

async function run(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });

  if (values.help || positionals.length === 0) {
    console.log(`sat spawn-worker - Spawn a new SAT worker agent in a tmux session

Usage:
  sat spawn-worker <name> [prompt]

Options:
  -h, --help    Show this help message`);
    return;
  }

  const rootDir = resolve(dirname(Bun.main), "../../..");
  const settingsPath = resolve(rootDir, "personas/worker/settings.json");
  const cwd = process.env.SAT_CWD || process.cwd();

  const workerName = positionals[0];
  const initialPrompt = positionals.slice(1).join(" ") || undefined;
  const sessionName = `sat-${workerName}`;

  // Create a new detached tmux session in the caller's working directory
  await $`tmux new-session -d -s ${sessionName} -c ${cwd}`.quiet();

  // Get the tmux target
  const tmuxTarget = (await $`tmux display-message -p -t ${sessionName} '#{session_name}:#{window_index}.#{pane_index}'`.quiet()).text().trim();

  // Register the worker
  await $`sat workers add ${workerName} ${tmuxTarget} worker`.quiet();

  // Configure status bar for this session
  await $`tmux set-option -t ${sessionName} status-left-length 25`.quiet();
  Bun.spawnSync(["tmux", "set-option", "-t", sessionName, "status-left", ` 🤖 ${workerName} `], { stdio: ["ignore", "ignore", "ignore"] });
  await $`tmux set-option -t ${sessionName} status-right ''`.quiet();
  await $`tmux set-option -t ${sessionName} automatic-rename off`.quiet();

  // Launch claude in the new session
  const claudeArgs = `-w --settings '${settingsPath}' --model claude-sonnet-4-6`;
  const envVars = `SAT_AGENT_NAME='${workerName}' CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`;
  if (initialPrompt) {
    const escaped = initialPrompt.replace(/'/g, "'\\''");
    const claudeCmd = `echo '${escaped}' | ${envVars} claude ${claudeArgs}`;
    await $`tmux send-keys -t ${tmuxTarget} ${claudeCmd} Enter`.quiet();
  } else {
    const claudeCmd = `${envVars} claude ${claudeArgs}`;
    await $`tmux send-keys -t ${tmuxTarget} ${claudeCmd} Enter`.quiet();
  }

  console.log(`Spawned ${workerName} in tmux session ${sessionName} (${tmuxTarget})`);
}

export const command = {
  name: "spawn-worker",
  description: "Spawn a new worker agent",
  run,
};
