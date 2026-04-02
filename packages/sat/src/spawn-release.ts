import { $ } from "bun";
import { getSettingsPath } from "./personas-data";

async function run(_args: string[]) {
  const settingsPath = getSettingsPath("release");
  const cwd = process.env.SAT_CWD || process.cwd();

  const workerName = "release";
  const sessionName = `sat-${workerName}`;

  // Create a new detached tmux session in the caller's working directory
  await $`tmux new-session -d -s ${sessionName} -c ${cwd}`.quiet();

  // Get the tmux target
  const tmuxTarget = (await $`tmux display-message -p -t ${sessionName} '#{session_name}:#{window_index}.#{pane_index}'`.quiet()).text().trim();

  // Register the release worker
  await $`sat workers add ${workerName} ${tmuxTarget} release`.quiet();

  // Configure status bar for this session
  await $`tmux set-option -t ${sessionName} status-left-length 25`.quiet();
  Bun.spawnSync(["tmux", "set-option", "-t", sessionName, "status-left", ` 🚀 ${workerName} `], { stdio: ["ignore", "ignore", "ignore"] });
  await $`tmux set-option -t ${sessionName} status-right ''`.quiet();
  await $`tmux set-option -t ${sessionName} automatic-rename off`.quiet();

  // Launch claude in the new session
  const claudeArgs = `--settings '${settingsPath}' --model claude-sonnet-4-6`;
  const envVars = `SAT_AGENT_NAME='${workerName}' CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`;
  const claudeCmd = `echo 'Wake up and initialize.' | ${envVars} claude ${claudeArgs}`;
  await $`tmux send-keys -t ${tmuxTarget} ${claudeCmd} Enter`.quiet();

  console.log(`Spawned ${workerName} in tmux session ${sessionName} (${tmuxTarget})`);
}

export const command = {
  name: "spawn-release",
  description: "Spawn the release agent",
  run,
};
