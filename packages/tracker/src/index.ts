import { parseArgs } from "util";
import { resolve, dirname } from "path";
import {
  openDatabase,
  getTasks,
  getWorkers,
  addTask,
  deleteTask,
  clearTasks,
  addWorker,
  clearWorkers,
} from "./db";
import * as ui from "./ui";

const HELP = `tracker - SAT task and worker tracker

Usage:
  tracker <resource> [action] [arguments]

Commands:
  tasks                          List all tasks
  tasks add <id> <description>   Add a task
  tasks delete <id>              Delete a task by id
  tasks clear                    Delete all tasks

  workers                        List all workers
  workers set <name> <status>    Add or update a worker's status
  workers clear                  Delete all workers

  status                         Show all tasks and workers

Options:
  -h, --help                     Show this help message`;

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

if (values.help || positionals.length === 0) {
  console.log(HELP);
  process.exit(0);
}

const dbPath = resolve(dirname(Bun.main), "../tracker.db");
const db = openDatabase(dbPath);

const resource = positionals[0];
const action = positionals[1];

switch (resource) {
  case "tasks": {
    if (!action) {
      ui.renderTasks(getTasks(db));
    } else if (action === "add") {
      const taskId = positionals[2];
      const desc = positionals.slice(3).join(" ");
      if (!taskId || !desc) {
        ui.renderError("Usage: tracker tasks add <id> <description>");
        process.exit(1);
      }
      addTask(db, taskId, desc);
      ui.renderSuccess(`Added task ${taskId}`);
    } else if (action === "delete") {
      const taskId = positionals[2];
      if (!taskId) {
        ui.renderError("Usage: tracker tasks delete <id>");
        process.exit(1);
      }
      if (deleteTask(db, taskId)) {
        ui.renderSuccess(`Deleted task ${taskId}`);
      } else {
        ui.renderError(`Task ${taskId} not found`);
        process.exit(1);
      }
    } else if (action === "clear") {
      clearTasks(db);
      ui.renderSuccess("All tasks cleared");
    } else {
      ui.renderError(`Unknown tasks action: ${action}`);
      process.exit(1);
    }
    break;
  }

  case "workers": {
    if (!action) {
      ui.renderWorkers(getWorkers(db));
    } else if (action === "set") {
      const name = positionals[2];
      const status = positionals.slice(3).join(" ");
      if (!name || !status) {
        ui.renderError("Usage: tracker workers set <name> <status>");
        process.exit(1);
      }
      addWorker(db, name, status);
      ui.renderSuccess(`Worker ${name} set to "${status}"`);
    } else if (action === "clear") {
      clearWorkers(db);
      ui.renderSuccess("All workers cleared");
    } else {
      ui.renderError(`Unknown workers action: ${action}`);
      process.exit(1);
    }
    break;
  }

  case "status": {
    ui.renderStatus(getTasks(db), getWorkers(db));
    break;
  }

  default:
    ui.renderError(`Unknown command: ${resource}`);
    console.log(HELP);
    process.exit(1);
}

db.close();
