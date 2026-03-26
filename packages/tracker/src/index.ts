import { parseArgs } from "util";
import { resolve, dirname } from "path";
import {
  openDatabase,
  getTasks,
  getWorkers,
  addTask,
  deleteTask,
  clearTasks,
  completeTask,
  assignTask,
  unassignTask,
  addWorker,
  clearWorkers,
} from "./db";
import * as ui from "./ui";

const HELP = `tracker - SAT task and worker tracker

Usage:
  tracker <resource> [action] [arguments]

Commands:
  tasks                          List tasks (ready + in-progress)
  tasks ready                    List tasks in ready state only
  tasks add <id> <description>   Add a task (status: ready)
  tasks done <id>                Mark a task as done
  tasks assign <id> <worker>     Assign a task to a worker
  tasks unassign <id>            Unassign a task's worker
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
      ui.renderTasks(getTasks(db, ["ready", "in-progress"]));
    } else if (action === "ready") {
      ui.renderTasks(getTasks(db, "ready"));
    } else if (action === "done") {
      const taskId = positionals[2];
      if (!taskId) {
        ui.renderError("Usage: tracker tasks done <id>");
        process.exit(1);
      }
      if (completeTask(db, taskId)) {
        ui.renderSuccess(`Task ${taskId} marked as done`);
      } else {
        ui.renderError(`Task ${taskId} not found`);
        process.exit(1);
      }
    } else if (action === "assign") {
      const taskId = positionals[2];
      const workerName = positionals.slice(3).join(" ");
      if (!taskId || !workerName) {
        ui.renderError("Usage: tracker tasks assign <id> <worker>");
        process.exit(1);
      }
      if (assignTask(db, taskId, workerName)) {
        ui.renderSuccess(`Task ${taskId} assigned to ${workerName}`);
      } else {
        ui.renderError(`Task ${taskId} not found`);
        process.exit(1);
      }
    } else if (action === "unassign") {
      const taskId = positionals[2];
      if (!taskId) {
        ui.renderError("Usage: tracker tasks unassign <id>");
        process.exit(1);
      }
      if (unassignTask(db, taskId)) {
        ui.renderSuccess(`Task ${taskId} unassigned`);
      } else {
        ui.renderError(`Task ${taskId} not found`);
        process.exit(1);
      }
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
    ui.renderStatus(getTasks(db, ["ready", "in-progress"]), getWorkers(db));
    break;
  }

  default:
    ui.renderError(`Unknown command: ${resource}`);
    console.log(HELP);
    process.exit(1);
}

db.close();
