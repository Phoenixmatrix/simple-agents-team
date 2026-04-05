import { parseArgs } from "util";

async function run(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`px dashboard - Interactive workspace dashboard

Usage:
  px dashboard

  Shows all agents in the current workspace with live status updates.
  Use arrow keys to navigate, Enter to switch to an agent's tmux session.

Options:
  -h, --help    Show this help message`);
    return;
  }

  await import("./app");
}

export const command = {
  name: "dashboard",
  description: "Interactive workspace dashboard",
  run,
};
