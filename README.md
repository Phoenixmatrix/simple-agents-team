# px

> Pronounced "Pix".

> **Fair warning:** This entire project was vibe coded. The code works, but if you look under the hood expecting clean architecture and best practices, you're going to have a bad time. You've been warned.

A CLI tool that orchestrates multiple Claude Code agents using tmux, SQLite, and a task tracker. A coordinator agent dispatches work to worker agents, each running in its own tmux session. A release agent handles merging branches to main, and a daemon monitors the system.

## Install

Download the latest binary from [GitHub Releases](https://github.com/Phoenixmatrix/px/releases). Since this is a private repo, you need to be authenticated. The easiest way is with the `gh` CLI (which uses your existing `gh auth login` session).

**Linux (x64):**

```bash
gh release download --repo Phoenixmatrix/px --pattern 'px-linux-x64' && chmod +x px-linux-x64 && mv px-linux-x64 px
```

**macOS (Apple Silicon):**

```bash
gh release download --repo Phoenixmatrix/px --pattern 'px-darwin-arm64' && chmod +x px-darwin-arm64 && mv px-darwin-arm64 px
```

**Without `gh` CLI**, set a GitHub token with `repo` scope and use curl:

```bash
export GH_TOKEN="ghp_..."
```

```bash
curl -fsSL -H "Authorization: token $GH_TOKEN" -H "Accept: application/octet-stream" \
  "$(curl -fsSL -H "Authorization: token $GH_TOKEN" \
    https://api.github.com/repos/Phoenixmatrix/px/releases/latest \
    | grep -o '"url": "https://api.github.com/repos/.*/releases/assets/[0-9]*"' \
    | grep px-linux-x64 | head -1 | cut -d'"' -f4)" \
  -o px && chmod +x px
```

Move the binary somewhere in your PATH:

**bash / zsh:**

```bash
sudo mv px /usr/local/bin/
```

Or add a custom directory to your PATH in `~/.bashrc` / `~/.zshrc`:

```bash
mkdir -p ~/.local/bin
mv px ~/.local/bin/
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc  # or ~/.zshrc
```

**fish:**

```fish
mkdir -p ~/.local/bin
mv px ~/.local/bin/
fish_add_path ~/.local/bin
```

## Development setup

Requires [Bun](https://bun.sh).

```sh
bun install
```

In development, the `bin/px` wrapper runs everything through `bun` directly. Add the `bin/` directory to your PATH or use `bun run px`.

```sh
bun run typecheck   # Type-check all packages with tsgo
bun run lint        # Lint all packages with oxlint
bun run check       # Both typecheck and lint
```

## Commands

```
px <command> [arguments]
```

| Command | Description |
|---|---|
| `start` | Start the coordinator in a tmux session |
| `tracker` | Task and worker tracker |
| `workers` | Worker manager |
| `daemon` | Status dashboard |
| `spawn-worker` | Spawn a new worker agent |
| `spawn-release` | Spawn the release agent |
| `get-agent-name` | Generate a unique agent name |
| `hooks` | Run a lifecycle hook (used by settings.json) |
| `personas` | Get the path to a persona directory |

Run `px <command> --help` for detailed usage of any command.

### tracker

Manages the task board. Tasks have an auto-generated ID (e.g. `T-1`, `R-3`), a status (`ready`, `assigned`, `in-progress`, `done`), and an optional `blocked_by` dependency.

```sh
px tracker tasks                          # List active tasks
px tracker tasks json                     # Output active tasks as JSON
px tracker tasks json me                  # Output my assigned tasks as JSON
px tracker tasks create T "description"   # Create task, prints ID (e.g. T-1)
px tracker tasks create T "step 2" --blocked-by T-1  # Create with dependency
px tracker tasks create T "in portfolio" --portfolio feature-branch  # Create with portfolio
px tracker tasks assign T-1 worker-name   # Assign to a worker
px tracker tasks start T-1                # Mark in-progress
px tracker tasks done T-1                 # Mark complete
px tracker status                         # Show all tasks and workers
px tracker portfolio open feature-branch  # Set session portfolio
px tracker portfolio                      # Show current portfolio
px tracker portfolio close                # Clear session portfolio
```

### workers

Manages the worker registry. Workers are tracked in SQLite with their tmux session target.

```sh
px workers              # List all workers (table view)
px workers json         # List as JSON
px workers list         # List worker-type agents (for coordinator use)
```

### daemon

A dashboard that polls the database and displays worker status. Automatically nudges idle workers after 20 seconds.

```sh
px daemon               # Start in a tmux session (auto-managed)
```

## Workflow

### Starting a session

```sh
px start
```

This creates a tmux session called `px`, registers the coordinator, spawns the release agent, and launches Claude Code with the coordinator persona. The daemon starts automatically.

### Instructing the coordinator

The coordinator is your interface. Tell it what you want done — but be explicit about how to break work into tasks, which tasks to assign to workers, and what can be parallelized. Think of it like delegating to a team lead who needs clear direction on how to split the work.

> "We need to add authentication. Create three tasks: one for the login page UI, one for the auth API endpoints, and one for the session middleware. Spawn two workers — have one handle the login page and the other handle the API endpoints and session middleware in sequence."

The coordinator will:

1. Create tasks with `px tracker tasks create T "description"`
2. Generate unique worker names with `px get-agent-name`
3. Spawn workers with `px spawn-worker <name> "initial prompt"`
4. Assign tasks to workers with `px tracker tasks assign T-1 <name>`

If you just say "add auth" without specifying how to split the work, the coordinator may handle it all in a single task or make its own choices about parallelization. Being explicit about task breakdown and worker assignment gives you better results.

### How workers operate

Each worker runs in its own tmux session. Workers follow a loop:

1. Check for assigned tasks (`px tracker tasks me`)
2. Start the task (`px tracker tasks start T-1`)
3. Do the work — edit code, run tests, commit
4. Run quality gates (typecheck, lint) and fix any issues
5. Push the branch to remote
6. Create a release task, passing through the portfolio if the task has one (`px tracker tasks create R "Merge branch feature-x" --portfolio <name>`)
7. Assign it to `release`
8. Mark their task done (`px tracker tasks done T-1`)
9. Loop back to check for more tasks

Workers never merge branches themselves. They hand off to the release agent.

### The release agent

The release agent handles merging worker branches. Its behavior depends on whether the task has a portfolio.

**With a portfolio:** The release agent creates or updates a branch named after the portfolio, merges the worker's feature branch into it, runs quality checks, and pushes the portfolio branch. This lets you collect multiple related changes on one branch before merging to main.

**Without a portfolio:** The release agent merges the feature branch directly into main, runs quality checks, and pushes.

### Portfolios

A portfolio groups related tasks onto a named branch. The portfolio name must be a valid git branch name.

**Opening a portfolio** sets it for the current agent session. All tasks created in that session automatically get the portfolio:

```sh
px tracker portfolio open feature/auth
px tracker tasks create T "login page"       # gets portfolio "feature/auth"
px tracker tasks create T "auth endpoints"    # gets portfolio "feature/auth"
```

**Closing a portfolio** clears the session, so subsequent tasks go to main:

```sh
px tracker portfolio close
px tracker tasks create T "quick fix"         # no portfolio, merges to main
```

You can also set a portfolio per-task with the `--portfolio` flag, which overrides the session portfolio:

```sh
px tracker tasks create T "isolated change" --portfolio hotfix/urgent
```

Portfolios are scoped per agent — the coordinator opening a portfolio doesn't affect workers. Workers read the portfolio from their assigned task's JSON and pass it through when creating release tasks.

### The daemon

The daemon runs in a tmux session (`px-daemon`) and polls the database every 2 seconds. It displays all workers and their status. If a worker has been idle for more than 20 seconds, the daemon sends a nudge to wake it up and check for tasks.

## Navigating tmux

Each agent runs in a separate tmux session. Common commands:

```sh
tmux list-sessions              # See all sessions (px, px-release, px-worker-name, px-daemon)
tmux attach -t px               # Attach to coordinator
tmux attach -t px-release       # Attach to release agent
```

When attached to a tmux session:

| Key | Action |
|---|---|
| `Ctrl-b d` | Detach from session |
| `Ctrl-b s` | List and switch between sessions |
| `Ctrl-b w` | List and switch between windows |

## Data storage

px stores its SQLite database (`px.db`) at the root of your git repository. If you use git worktrees, all worktrees share the same database. The file is automatically added to `.gitignore` on first run if not already ignored.
