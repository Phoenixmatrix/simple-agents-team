import { parseArgs } from "util";
import { resolve } from "path";
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { execSync } from "child_process";
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

// --- Session portfolio helpers ---

const SAT_DIR = resolve(process.env.HOME ?? "~", ".sat");

function getPortfolioFilePath(): string {
  const agentName = process.env.SAT_AGENT_NAME ?? "default";
  return resolve(SAT_DIR, `portfolio-${agentName}`);
}

function getSessionPortfolio(): string | null {
  const filePath = getPortfolioFilePath();
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, "utf-8").trim() || null;
}

function setSessionPortfolio(name: string): void {
  mkdirSync(SAT_DIR, { recursive: true });
  writeFileSync(getPortfolioFilePath(), name);
}

function clearSessionPortfolio(): void {
  const filePath = getPortfolioFilePath();
  if (existsSync(filePath)) unlinkSync(filePath);
}

function validatePortfolioName(name: string): boolean {
  try {
    execSync(`git check-ref-format --branch ${JSON.stringify(name)}`, {
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

function resolvePortfolio(explicit?: string): string | undefined {
  if (explicit !== undefined) return explicit;
  return getSessionPortfolio() ?? undefined;
}

// --- CLI ---

const HELP = `sat tracker - Task and worker tracker

Usage:
  sat tracker <resource> [action] [arguments]

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

  portfolio                      Show current session portfolio
  portfolio open <name>          Set session portfolio (for task creation)
  portfolio close                Clear session portfolio

  status                         Show all tasks and workers

Options:
  -h, --help                     Show this help message
  --blocked-by <id>              Set a blocking task (for create/add)
  --portfolio <name>             Set portfolio for a task (for create/add)`;

async function run(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
      "blocked-by": { type: "string" },
      portfolio: { type: "string" },
    },
    allowPositionals: true,
  });

  if (values.help || positionals.length === 0) {
    console.log(HELP);
    return;
  }

  const resource = positionals[0];
  const action = positionals[1];

  // Portfolio commands don't need the database
  if (resource === "portfolio") {
    if (action === "open") {
      const name = positionals[2];
      if (!name) {
        ui.renderError("Usage: sat tracker portfolio open <name>");
        process.exit(1);
      }
      if (!validatePortfolioName(name)) {
        ui.renderError(`Invalid portfolio name: "${name}" (must be a valid git branch name)`);
        process.exit(1);
      }
      setSessionPortfolio(name);
      ui.renderSuccess(`Portfolio set to: ${name}`);
    } else if (action === "close") {
      clearSessionPortfolio();
      ui.renderSuccess("Portfolio closed");
    } else if (action === "show" || !action) {
      const current = getSessionPortfolio();
      if (current) {
        console.log(current);
      } else {
        console.log("No portfolio set for this session");
      }
    } else {
      ui.renderError(`Unknown portfolio action: ${action}`);
      process.exit(1);
    }
    return;
  }

  const db = openDatabase();
  try {
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
            ui.renderError("Usage: sat tracker tasks show <id>");
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
            ui.renderError("Usage: sat tracker tasks start <id>");
            process.exit(1);
          }
          const result = startTask(db, taskId);
          if (result.ok) {
            ui.renderSuccess(`Task ${taskId} started`);
          } else if (result.blocked) {
            ui.renderError(`Task ${taskId} is blocked by ${result.blocked} (not yet done)`);
            process.exit(1);
          } else {
            ui.renderError(`Task ${taskId} not found`);
            process.exit(1);
          }
        } else if (action === "done") {
          const taskId = positionals[2];
          if (!taskId) {
            ui.renderError("Usage: sat tracker tasks done <id>");
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
            ui.renderError("Usage: sat tracker tasks assign <id> <worker>");
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
            ui.renderError("Usage: sat tracker tasks unassign <id>");
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
            ui.renderError("Usage: sat tracker tasks add <id> <description>");
            process.exit(1);
          }
          const portfolio = resolvePortfolio(values.portfolio);
          if (portfolio && !validatePortfolioName(portfolio)) {
            ui.renderError(`Invalid portfolio name: "${portfolio}" (must be a valid git branch name)`);
            process.exit(1);
          }
          if (addTask(db, taskId, desc, values["blocked-by"], portfolio)) {
            ui.renderSuccess(`Added task ${taskId}`);
          } else {
            ui.renderError(`Task ${taskId} already exists`);
            process.exit(1);
          }
        } else if (action === "create") {
          const prefix = positionals[2];
          const desc = positionals.slice(3).join(" ");
          if (!prefix || !desc) {
            ui.renderError("Usage: sat tracker tasks create <prefix> <description>");
            process.exit(1);
          }
          const portfolio = resolvePortfolio(values.portfolio);
          if (portfolio && !validatePortfolioName(portfolio)) {
            ui.renderError(`Invalid portfolio name: "${portfolio}" (must be a valid git branch name)`);
            process.exit(1);
          }
          const taskId = createTask(db, prefix, desc, values["blocked-by"], portfolio);
          console.log(taskId);
        } else if (action === "delete") {
          const taskId = positionals[2];
          if (!taskId) {
            ui.renderError("Usage: sat tracker tasks delete <id>");
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
  } finally {
    db.close();
  }
}

export const command = {
  name: "tracker",
  description: "Task and worker tracker",
  run,
};
