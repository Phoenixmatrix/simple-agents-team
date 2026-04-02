# SAT — Simple Agents Team

> **Fair warning:** This entire project was vibe coded. The code works, but if you look under the hood expecting clean architecture and best practices, you're going to have a bad time. You've been warned.

A CLI tool that orchestrates multiple Claude Code agents using tmux, SQLite, and a task tracker. A coordinator agent dispatches work to worker agents, each running in its own tmux session. A release agent handles merging branches to main, and a daemon monitors the system.

## Install

Download the latest binary from [GitHub Releases](https://github.com/Phoenixmatrix/simple-agents-team/releases) and place it in your PATH.

```bash
# Linux (x64)
curl -fsSL https://github.com/Phoenixmatrix/simple-agents-team/releases/latest/download/sat-linux-x64 -o sat
chmod +x sat

# macOS (Apple Silicon)
curl -fsSL https://github.com/Phoenixmatrix/simple-agents-team/releases/latest/download/sat-darwin-arm64 -o sat
chmod +x sat
```

Move the binary somewhere in your PATH:

**bash / zsh:**

```bash
sudo mv sat /usr/local/bin/
```

Or add a custom directory to your PATH in `~/.bashrc` / `~/.zshrc`:

```bash
mkdir -p ~/bin
mv sat ~/bin/
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc  # or ~/.zshrc
```

**fish:**

```fish
mkdir -p ~/bin
mv sat ~/bin/
fish_add_path ~/bin
```

## Development setup

Requires [Bun](https://bun.sh).

```sh
bun install
```

In development, the `bin/sat` wrapper runs everything through `bun` directly. Add the `bin/` directory to your PATH or use `bun run sat`.

```sh
bun run typecheck   # Type-check all packages with tsgo
bun run lint        # Lint all packages with oxlint
bun run check       # Both typecheck and lint
```

## Commands

```
sat <command> [arguments]
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

Run `sat <command> --help` for detailed usage of any command.

### tracker

Manages the task board. Tasks have an auto-generated ID (e.g. `T-1`, `R-3`), a status (`ready`, `assigned`, `in-progress`, `done`), and an optional `blocked_by` dependency.

```sh
sat tracker tasks                          # List active tasks
sat tracker tasks json                     # Output active tasks as JSON
sat tracker tasks json me                  # Output my assigned tasks as JSON
sat tracker tasks create T "description"   # Create task, prints ID (e.g. T-1)
sat tracker tasks create T "step 2" --blocked-by T-1  # Create with dependency
sat tracker tasks assign T-1 worker-name   # Assign to a worker
sat tracker tasks start T-1                # Mark in-progress
sat tracker tasks done T-1                 # Mark complete
sat tracker status                         # Show all tasks and workers
```

### workers

Manages the worker registry. Workers are tracked in SQLite with their tmux session target.

```sh
sat workers              # List all workers (table view)
sat workers json         # List as JSON
sat workers list         # List worker-type agents (for coordinator use)
```

### daemon

A dashboard that polls the database and displays worker status. Automatically nudges idle workers after 20 seconds.

```sh
sat daemon               # Start in a tmux session (auto-managed)
```

## Workflow

### Starting a session

```sh
sat start
```

This creates a tmux session called `sat`, registers the coordinator, spawns the release agent, and launches Claude Code with the coordinator persona. The daemon starts automatically.

### Instructing the coordinator

The coordinator is your interface. Tell it what you want done — but be explicit about how to break work into tasks, which tasks to assign to workers, and what can be parallelized. Think of it like delegating to a team lead who needs clear direction on how to split the work.

> "We need to add authentication. Create three tasks: one for the login page UI, one for the auth API endpoints, and one for the session middleware. Spawn two workers — have one handle the login page and the other handle the API endpoints and session middleware in sequence."

The coordinator will:

1. Create tasks with `sat tracker tasks create T "description"`
2. Generate unique worker names with `sat get-agent-name`
3. Spawn workers with `sat spawn-worker <name> "initial prompt"`
4. Assign tasks to workers with `sat tracker tasks assign T-1 <name>`

If you just say "add auth" without specifying how to split the work, the coordinator may handle it all in a single task or make its own choices about parallelization. Being explicit about task breakdown and worker assignment gives you better results.

### How workers operate

Each worker runs in its own tmux session. Workers follow a loop:

1. Check for assigned tasks (`sat tracker tasks me`)
2. Start the task (`sat tracker tasks start T-1`)
3. Do the work — edit code, run tests, commit
4. Push the branch to remote
5. Create a release task (`sat tracker tasks create R "Merge branch feature-x"`)
6. Assign it to `release`
7. Mark their task done (`sat tracker tasks done T-1`)
8. Loop back to check for more tasks

Workers never merge to main themselves. They hand off to the release agent.

### The release agent

The release agent handles merging branches to main:

1. Picks up assigned R-tasks
2. Checks out main, fetches latest
3. Merges the feature branch
4. Runs quality checks (typecheck, lint)
5. If checks pass, pushes to main
6. If checks fail, fixes issues before pushing
7. Marks the task done

### The daemon

The daemon runs in a tmux session (`sat-daemon`) and polls the database every 2 seconds. It displays all workers and their status. If a worker has been idle for more than 20 seconds, the daemon sends a nudge to wake it up and check for tasks.

## Navigating tmux

Each agent runs in a separate tmux session. Common commands:

```sh
tmux list-sessions              # See all sessions (sat, sat-release, sat-worker-name, sat-daemon)
tmux attach -t sat              # Attach to coordinator
tmux attach -t sat-release      # Attach to release agent
```

When attached to a tmux session:

| Key | Action |
|---|---|
| `Ctrl-b d` | Detach from session |
| `Ctrl-b s` | List and switch between sessions |
| `Ctrl-b w` | List and switch between windows |

## Data storage

SAT stores its SQLite database (`sat.db`) at the root of your git repository. If you use git worktrees, all worktrees share the same database. The file is automatically added to `.gitignore` on first run if not already ignored.
