import { parseArgs } from "util";
import { openDatabase, getWorkers, addWorker, updateWorkerStatus, clearWorkers } from "db";
import * as ui from "./ui";

const HELP = `workers - SAT worker manager

Usage:
  workers [action] [arguments]

Commands:
  workers                              List all workers
  workers json                         List all workers as JSON
  workers list                         List workers (type=worker) for agent use
  workers add <name> <tmux_target> <type>  Add a worker (type: coordinator, daemon, worker)
  workers status <name> <status>       Set a worker's status
  workers clear                        Delete all workers

Options:
  -h, --help                           Show this help message`;

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    help: {
      type: "boolean",
      short: "h",
    },
  },
  allowPositionals: true,
});

if (values.help) {
  console.log(HELP);
  process.exit(0);
}

if (positionals.length === 0) {
  const db = openDatabase();
  ui.renderWorkers(getWorkers(db));
  db.close();
  process.exit(0);
}

const db = openDatabase();
const action = positionals[0];

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
    const type = positionals[3] as import("db").WorkerType;
    if (!name || !tmuxTarget || !type) {
      ui.renderError("Usage: workers add <name> <tmux_target> <type>");
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
      ui.renderError("Usage: workers status <name> <status>");
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

db.close();
