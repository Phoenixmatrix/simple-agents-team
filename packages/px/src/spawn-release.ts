import { parseArgs } from "util";
import { $ } from "bun";
import { getSettingsPath } from "./personas-data";
import { detectRepos, resolveRepoPrefix } from "./workspace";
import { openDatabase, addWorker } from "db";

async function run(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
      repo: { type: "string" },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`px spawn-release - Spawn the release agent for a repo

Usage:
  px spawn-release [--repo <slug>]

Options:
  --repo <slug>  Target repo (required in multi-repo workspaces)
  -h, --help     Show this help message`);
    return;
  }

  const settingsPath = getSettingsPath("release");
  const workspace = process.env.PX_WORKSPACE || process.env.PX_CWD || process.cwd();

  // Resolve repo
  let repoSlug = values.repo || process.env.PX_REPO;
  let repoPath: string;

  const repos = detectRepos(workspace);
  if (repoSlug) {
    const found = repos.find((r) => r.slug === repoSlug);
    if (!found) {
      console.error(`Repo "${repoSlug}" not found in workspace. Available: ${repos.map((r) => r.slug).join(", ")}`);
      process.exit(1);
    }
    repoPath = found.path;
  } else if (repos.length === 1) {
    repoSlug = repos[0].slug;
    repoPath = repos[0].path;
  } else if (repos.length === 0) {
    console.error("No repos found in workspace: " + workspace);
    process.exit(1);
  } else {
    console.error("Multiple repos in workspace — specify --repo <slug>. Available: " + repos.map((r) => r.slug).join(", "));
    process.exit(1);
  }

  const repoPrefix = resolveRepoPrefix(repoPath);
  const workerName = `${repoPrefix}-release`;
  const sessionName = `${repoPrefix}-release`;

  // Create a new detached tmux session in the repo directory
  await $`tmux new-session -d -s ${sessionName} -c ${repoPath}`.quiet();

  // Get the tmux target
  const tmuxTarget = (await $`tmux display-message -p -t ${sessionName} '#{session_name}:#{window_index}.#{pane_index}'`.quiet()).text().trim();

  // Register the release worker with repo context
  {
    const db = openDatabase();
    addWorker(db, workerName, tmuxTarget, "release", "idle", repoPrefix, repoSlug, workspace);
    db.close();
  }

  // Configure status bar for this session
  await $`tmux set-option -t ${sessionName} status-left-length 25`.quiet();
  Bun.spawnSync(["tmux", "set-option", "-t", sessionName, "status-left", ` 🚀 ${workerName} `], { stdio: ["ignore", "ignore", "ignore"] });
  await $`tmux set-option -t ${sessionName} status-right ''`.quiet();
  await $`tmux set-option -t ${sessionName} automatic-rename off`.quiet();

  // Launch claude in the new session
  const claudeArgs = `--settings '${settingsPath}' --model claude-sonnet-4-6`;
  const envVars = `PX_AGENT_NAME='${workerName}' PX_SESSION_PREFIX='${repoPrefix}' PX_REPO='${repoSlug}' PX_WORKSPACE='${workspace}' PX_CWD='${repoPath}' CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`;
  const claudeCmd = `echo 'Wake up and initialize.' | ${envVars} claude ${claudeArgs}`;
  await $`tmux send-keys -t ${tmuxTarget} ${claudeCmd} Enter`.quiet();

  console.log(`Spawned ${workerName} in tmux session ${sessionName} (${tmuxTarget}) [repo: ${repoSlug}]`);
}

export const command = {
  name: "spawn-release",
  description: "Spawn the release agent",
  run,
};
