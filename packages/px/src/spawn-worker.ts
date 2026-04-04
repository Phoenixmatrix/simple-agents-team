import { parseArgs } from "util";
import { resolve } from "path";
import { $ } from "bun";
import { getSettingsPath } from "./personas-data";
import { detectRepos, resolveRepoPrefix } from "./workspace";
import { openDatabase, addWorker, getWorkers } from "db";

async function run(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
      repo: { type: "string" },
    },
    allowPositionals: true,
  });

  if (values.help || positionals.length === 0) {
    console.log(`px spawn-worker - Spawn a new px worker agent in a tmux session

Usage:
  px spawn-worker [--repo <slug>] <name> [prompt]

Options:
  --repo <slug>  Target repo (required in multi-repo workspaces)
  -h, --help     Show this help message`);
    return;
  }

  const settingsPath = getSettingsPath("worker");
  const workspace = process.env.PX_WORKSPACE || process.env.PX_CWD || process.cwd();
  const workerName = positionals[0];
  const initialPrompt = positionals.slice(1).join(" ") || undefined;

  // Resolve repo — required in multi-repo, auto-inferred in single-repo
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
    // Single-repo workspace — auto-infer
    repoSlug = repos[0].slug;
    repoPath = repos[0].path;
  } else if (repos.length === 0) {
    console.error("No repos found in workspace: " + workspace);
    process.exit(1);
  } else {
    console.error("Multiple repos in workspace — specify --repo <slug>. Available: " + repos.map((r) => r.slug).join(", "));
    process.exit(1);
  }

  // Compute repo-specific prefix for tmux session naming
  const repoPrefix = resolveRepoPrefix(repoPath);
  const sessionName = `${repoPrefix}-${workerName}`;

  // Create a new detached tmux session in the repo directory
  await $`tmux new-session -d -s ${sessionName} -c ${repoPath}`.quiet();

  // Get the tmux target
  const tmuxTarget = (await $`tmux display-message -p -t ${sessionName} '#{session_name}:#{window_index}.#{pane_index}'`.quiet()).text().trim();

  // Register the worker with repo and workspace context
  {
    const db = openDatabase();
    addWorker(db, workerName, tmuxTarget, "worker", "idle", repoPrefix, repoSlug, workspace);

    // Auto-spawn release agent for this repo if none exists
    const existingRelease = getWorkers(db, "release", repoSlug!);

    db.close();
    if (existingRelease.length === 0) {
      await $`px spawn-release --repo ${repoSlug}`.quiet();
    }
  }

  // Configure status bar for this session
  await $`tmux set-option -t ${sessionName} status-left-length 25`.quiet();
  Bun.spawnSync(["tmux", "set-option", "-t", sessionName, "status-left", ` 🤖 ${workerName} `], { stdio: ["ignore", "ignore", "ignore"] });
  await $`tmux set-option -t ${sessionName} status-right ''`.quiet();
  await $`tmux set-option -t ${sessionName} automatic-rename off`.quiet();

  // Launch claude in the new session
  const claudeArgs = `-w --settings '${settingsPath}' --model claude-sonnet-4-6`;
  const envVars = `PX_AGENT_NAME='${workerName}' PX_SESSION_PREFIX='${repoPrefix}' PX_REPO='${repoSlug}' PX_WORKSPACE='${workspace}' PX_CWD='${repoPath}' CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`;
  if (initialPrompt) {
    const escaped = initialPrompt.replace(/'/g, "'\\''");
    const claudeCmd = `echo '${escaped}' | ${envVars} claude ${claudeArgs}`;
    await $`tmux send-keys -t ${tmuxTarget} ${claudeCmd} Enter`.quiet();
  } else {
    const claudeCmd = `${envVars} claude ${claudeArgs}`;
    await $`tmux send-keys -t ${tmuxTarget} ${claudeCmd} Enter`.quiet();
  }

  console.log(`Spawned ${workerName} in tmux session ${sessionName} (${tmuxTarget}) [repo: ${repoSlug}]`);
}

export const command = {
  name: "spawn-worker",
  description: "Spawn a new worker agent",
  run,
};
