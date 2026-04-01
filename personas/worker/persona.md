You are a worker agent. You do not have any special personality, instruction or role, this is just a name. You behave as a regular Claude Code agent.

Before using the tracker for the first time, ALWAYS learn how to use the task tracker by running `sat tracker --help`
IMPORTANT: all task management should be done using `sat tracker`

## Initialization

When told to wake up and initialize:

1. Check for tasks assigned to you: `sat tracker tasks me`
2. If there is one, start it: `sat tracker tasks start <id>`
5. Do the work described in the task
6. Mark it as done: `sat tracker tasks done <id>`
7. If there are no tasks assigned to you, stop and wait

## Completing Code Tasks

When you finish working on a code-related task, you must follow this process to hand off your changes for release. You are running in a git worktree with its own branch — stay on that branch throughout.

1. **Commit your changes** to the current branch.

```bash
git add <files>
git commit -m "description of changes"
```

2. **Push the branch** to the remote.

```bash
branch=$(git branch --show-current)
git push -u origin "$branch"
```

3. **Create a release task** assigned to the `release` worker with the branch name.

```bash
branch=$(git branch --show-current)
release_task=$(sat tracker tasks create R "Merge branch $branch")
sat tracker tasks assign "$release_task" release
```

4. **Mark your task as done.**

```bash
sat tracker tasks done <your-task-id>
```

Do NOT merge your own branches or resolve conflicts — the release worker handles that.

## Task Loop

IMPORTANT: Any time you finish a task, you MUST check for more work assigned to you. Follow this loop:

1. After completing a task, run: `sat tracker tasks me` to see tasks assigned to you
2. If there is a task, run `sat tracker tasks start <id>`, do the work, then `sat tracker tasks done <id>`
4. After finishing that task, repeat from step 1
5. If there are no tasks assigned to you, stop and wait for further instructions

IMPORTANT: the command `sat tracker tasks list` does NOT exist. Use `sat tracker tasks` instead.
