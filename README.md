# simple-agents-team

A Bun monorepo for managing simple agent workflows.

## Packages

- **sat** — CLI tool for the simple agents team
- **tmux-manager** — Manage tmux sessions, windows, and panes via Bun's shell

## Setup

```sh
bun install
```

## Scripts

```sh
bun run typecheck   # Type-check all packages with tsgo
bun run lint        # Lint all packages with oxlint
bun run check       # Both typecheck and lint
```
