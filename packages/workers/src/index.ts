import { parseArgs } from "util";
import { openDatabase, getWorkers, addWorker, updateWorkerStatus, clearWorkers, clearWorkersByPrefix } from "db";
import type { WorkerType } from "db";
import * as ui from "./ui";

const HELP = `px workers - Worker manager

Usage:
  px workers [action] [arguments]

Commands:
  (none)                               List all workers
  json                                 List all workers as JSON
  list                                 List workers (type=worker) for agent use
  add <name> <tmux_target> <type> [prefix]  Add a worker (type: coordinator, daemon, worker)
  status <name> <status>               Set a worker's status
  clear                                Delete all workers
  clear-prefix <prefix>                Delete workers with a given prefix

Options:
  -h, --help                           Show this help message`;

async function run(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(HELP);
    return;
  }

  if (positionals.length === 0) {
    const db = openDatabase();
    ui.renderWorkers(getWorkers(db));
    db.close();
    return;
  }

  const db = openDatabase();
  const action = positionals[0];

  try {
    switch (action) {
      case "json": {
        console.log(JSON.stringify(getWorkers(db)));
        break;
      }

      case "list": {
        const workers = getWorkers(db, "worker");
        if (workers.length === 0) {
          console.log("No workers available.");
        } else {
          for (const w of workers) {
            console.log(`${w.worker_name} [${w.status}]`);
          }
        }
        break;
      }

      case "add": {
        const name = positionals[1];
        const tmuxTarget = positionals[2];
        const type = positionals[3] as WorkerType;
        const prefix = positionals[4] || undefined;
        if (!name || !tmuxTarget || !type) {
          ui.renderError("Usage: px workers add <name> <tmux_target> <type> [prefix]");
          process.exit(1);
        }
        if (!["coordinator", "daemon", "worker", "release"].includes(type)) {
          ui.renderError(`Invalid type "${type}". Must be: coordinator, daemon, worker, release`);
          process.exit(1);
        }
        addWorker(db, name, tmuxTarget, type, "idle", prefix);
        ui.renderSuccess(`Added ${type} ${name} (tmux:${tmuxTarget})`);
        break;
      }

      case "status": {
        const name = positionals[1];
        const status = positionals.slice(2).join(" ");
        if (!name || !status) {
          ui.renderError("Usage: px workers status <name> <status>");
          process.exit(1);
        }
        updateWorkerStatus(db, name, status);
        ui.renderSuccess(`Worker ${name} set to "${status}"`);
        break;
      }

      case "clear": {
        clearWorkers(db);
        ui.renderSuccess("All workers cleared");
        break;
      }

      case "clear-prefix": {
        const pfx = positionals[1];
        if (!pfx) {
          ui.renderError("Usage: px workers clear-prefix <prefix>");
          process.exit(1);
        }
        clearWorkersByPrefix(db, pfx);
        ui.renderSuccess(`Workers with prefix "${pfx}" cleared`);
        break;
      }

      default:
        ui.renderError(`Unknown action: ${action}`);
        console.log(HELP);
        process.exit(1);
    }
  } finally {
    db.close();
  }
}

export const command = {
  name: "workers",
  description: "Worker manager",
  run,
};
