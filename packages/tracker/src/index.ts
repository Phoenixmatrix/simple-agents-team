import { parseArgs } from "util";
import {
  openDatabase,
  getTask,
  getTasks,
  getTasksForWorker,
  getWorkers,
  addTask,
  createTask,
  deleteTask,
  clearTasks,
  completeTask,
  assignTask,
  startTask,
  unassignTask,
} from "./db";
import * as ui from "./ui";

const HELP = `tracker - SAT task and worker tracker

Usage:
  tracker <resource> [action] [arguments]

Commands:
  tasks                          List tasks (ready + in-progress)
  tasks me                       List tasks assigned to me (reads SAT_AGENT_NAME)
  tasks ready                    List tasks in ready state only
  tasks show <id>                Show a single task by id
  tasks json                     Output all active tasks as JSON
  tasks json me                  Output my tasks as JSON
  tasks add <id> <description>   Add a task with explicit id (status: ready)
  tasks create <prefix> <desc>   Create a task with auto-generated id (returns id)
  tasks start <id>               Set a task to in-progress
  tasks done <id>                Mark a task as done
  tasks assign <id> <worker>     Assign a task to a worker
  tasks unassign <id>            Unassign a task's worker
  tasks delete <id>              Delete a task by id
  tasks clear                    Delete all tasks

  status                         Show all tasks and workers

Options:
  -h, --help                     Show this help message
  --blocked-by <id>              Set a blocking task (for create/add)`;

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    help: {
      type: "boolean",
      short: "h",
    },
    "blocked-by": {
      type: "string",
    },
  },
  allowPositionals: true,
});

if (values.help || positionals.length === 0) {
  console.log(HELP);
  process.exit(0);
}

const db = openDatabase();

const resource = positionals[0];
const action = positionals[1];

switch (resource) {
  case "tasks": {
    if (!action) {
      ui.renderTasks(getTasks(db, ["ready", "assigned", "in-progress"]));
    } else if (action === "me") {
      const workerName = process.env.SAT_AGENT_NAME;
      if (!workerName) {
        ui.renderError("SAT_AGENT_NAME environment variable is not set");
        process.exit(1);
      }
      ui.renderTasks(getTasksForWorker(db, workerName));
    } else if (action === "json") {
      const sub = positionals[2];
      let tasks;
      if (sub === "me") {
        const workerName = process.env.SAT_AGENT_NAME;
        if (!workerName) {
          console.error("SAT_AGENT_NAME environment variable is not set");
          process.exit(1);
        }
        tasks = getTasksForWorker(db, workerName);
      } else {
        tasks = getTasks(db, ["ready", "assigned", "in-progress"]);
      }
      console.log(JSON.stringify(tasks, null, 2));
    } else if (action === "ready") {
      ui.renderTasks(getTasks(db, "ready"));
    } else if (action === "show") {
      const taskId = positionals[2];
      if (!taskId) {
        ui.renderError("Usage: tracker tasks show <id>");
        process.exit(1);
      }
      const task = getTask(db, taskId);
      if (task) {
        ui.renderTasks([task]);
      } else {
        ui.renderError(`Task ${taskId} not found`);
        process.exit(1);
      }
    } else if (action === "start") {
      const taskId = positionals[2];
      if (!taskId) {
        ui.renderError("Usage: tracker tasks start <id>");
        process.exit(1);
      }
      if (startTask(db, taskId)) {
        ui.renderSuccess(`Task ${taskId} started`);
      } else {
        ui.renderError(`Task ${taskId} not found`);
        process.exit(1);
      }
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
      if (addTask(db, taskId, desc, values["blocked-by"])) {
        ui.renderSuccess(`Added task ${taskId}`);
      } else {
        ui.renderError(`Task ${taskId} already exists`);
        process.exit(1);
      }
    } else if (action === "create") {
      const prefix = positionals[2];
      const desc = positionals.slice(3).join(" ");
      if (!prefix || !desc) {
        ui.renderError("Usage: tracker tasks create <prefix> <description>");
        process.exit(1);
      }
      const taskId = createTask(db, prefix, desc, values["blocked-by"]);
      console.log(taskId);
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

  case "status": {
    ui.renderStatus(getTasks(db, ["ready", "assigned", "in-progress"]), getWorkers(db));
    break;
  }

  default:
    ui.renderError(`Unknown command: ${resource}`);
    console.log(HELP);
    process.exit(1);
}

db.close();
