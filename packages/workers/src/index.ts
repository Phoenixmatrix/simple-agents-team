import { parseArgs } from "util";
import { openDatabase, getWorkers, addWorker, updateWorkerStatus, clearWorkers } from "db";
import type { WorkerType } from "db";
import * as ui from "./ui";

const HELP = `sat workers - Worker manager

Usage:
  sat workers [action] [arguments]

Commands:
  (none)                               List all workers
  json                                 List all workers as JSON
  list                                 List workers (type=worker) for agent use
  add <name> <tmux_target> <type>      Add a worker (type: coordinator, daemon, worker)
  status <name> <status>               Set a worker's status
  clear                                Delete all workers

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
        if (!name || !tmuxTarget || !type) {
          ui.renderError("Usage: sat workers add <name> <tmux_target> <type>");
          process.exit(1);
        }
        if (!["coordinator", "daemon", "worker", "release"].includes(type)) {
          ui.renderError(`Invalid type "${type}". Must be: coordinator, daemon, worker, release`);
          process.exit(1);
        }
        addWorker(db, name, tmuxTarget, type);
        ui.renderSuccess(`Added ${type} ${name} (tmux:${tmuxTarget})`);
        break;
      }

      case "status": {
        const name = positionals[1];
        const status = positionals.slice(2).join(" ");
        if (!name || !status) {
          ui.renderError("Usage: sat workers status <name> <status>");
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
