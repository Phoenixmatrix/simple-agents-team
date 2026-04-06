import { parseArgs } from "util";
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
  getPortfolio,
  setPortfolio,
  clearPortfolio,
  abbreviate,
} from "./db";
import * as ui from "./ui";

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

function resolvePortfolio(db: ReturnType<typeof openDatabase>, agentName: string, explicit?: string): string | undefined {
  if (explicit !== undefined) return explicit;
  return getPortfolio(db, agentName) ?? undefined;
}

// --- CLI ---

const HELP = `px tracker - Task and worker tracker

Usage:
  px tracker <resource> [action] [arguments]

Commands:
  tasks                          List tasks (ready + in-progress)
  tasks me                       List tasks assigned to me (reads PX_AGENT_NAME)
  tasks ready                    List tasks in ready state only
  tasks show <id>                Show a single task by id
  tasks json                     Output all active tasks as JSON
  tasks json me                  Output my tasks as JSON
  tasks add <id> <description>   Add a task with explicit id (status: ready)
  tasks create [prefix] <desc>   Create a task with auto-generated id (returns id)
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
  --portfolio <name>             Set portfolio for a task (for create/add)
  --repo <slug>                  Scope to a specific repo (default: PX_REPO env)`;

async function run(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
      "blocked-by": { type: "string" },
      portfolio: { type: "string" },
      repo: { type: "string" },
    },
    allowPositionals: true,
  });

  if (values.help || positionals.length === 0) {
    console.log(HELP);
    return;
  }

  const resource = positionals[0];
  const action = positionals[1];

  const db = openDatabase();
  const agentName = process.env.PX_AGENT_NAME ?? "default";
  const repo = values.repo ?? process.env.PX_REPO ?? undefined;

  if (resource === "portfolio") {
    try {
      if (action === "open") {
        const name = positionals[2];
        if (!name) {
          ui.renderError("Usage: px tracker portfolio open <name>");
          process.exit(1);
        }
        if (!validatePortfolioName(name)) {
          ui.renderError(`Invalid portfolio name: "${name}" (must be a valid git branch name)`);
          process.exit(1);
        }
        setPortfolio(db, agentName, name);
        ui.renderSuccess(`Portfolio set to: ${name}`);
      } else if (action === "close") {
        clearPortfolio(db, agentName);
        ui.renderSuccess("Portfolio closed");
      } else if (action === "show" || !action) {
        const current = getPortfolio(db, agentName);
        if (current) {
          console.log(current);
        } else {
          console.log("No portfolio set for this session");
        }
      } else {
        ui.renderError(`Unknown portfolio action: ${action}`);
        process.exit(1);
      }
    } finally {
      db.close();
    }
    return;
  }
  try {
    switch (resource) {
      case "tasks": {
        if (!action) {
          ui.renderTasks(getTasks(db, ["ready", "assigned", "in-progress"], repo));
        } else if (action === "me") {
          const workerName = process.env.PX_AGENT_NAME;
          if (!workerName) {
            ui.renderError("PX_AGENT_NAME environment variable is not set");
            process.exit(1);
          }
          ui.renderTasks(getTasksForWorker(db, workerName, repo));
        } else if (action === "json") {
          const sub = positionals[2];
          let tasks;
          if (sub === "me") {
            const workerName = process.env.PX_AGENT_NAME;
            if (!workerName) {
              console.error("PX_AGENT_NAME environment variable is not set");
              process.exit(1);
            }
            tasks = getTasksForWorker(db, workerName, repo);
          } else {
            tasks = getTasks(db, ["ready", "assigned", "in-progress"], repo);
          }
          console.log(JSON.stringify(tasks, null, 2));
        } else if (action === "ready") {
          ui.renderTasks(getTasks(db, "ready", repo));
        } else if (action === "show") {
          const taskId = positionals[2];
          if (!taskId) {
            ui.renderError("Usage: px tracker tasks show <id>");
            process.exit(1);
          }
          const task = getTask(db, taskId, repo);
          if (task) {
            ui.renderTasks([task]);
          } else {
            ui.renderError(`Task ${taskId} not found`);
            process.exit(1);
          }
        } else if (action === "start") {
          const taskId = positionals[2];
          if (!taskId) {
            ui.renderError("Usage: px tracker tasks start <id>");
            process.exit(1);
          }
          const result = startTask(db, taskId, repo);
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
            ui.renderError("Usage: px tracker tasks done <id>");
            process.exit(1);
          }
          if (completeTask(db, taskId, repo)) {
            ui.renderSuccess(`Task ${taskId} marked as done`);
          } else {
            ui.renderError(`Task ${taskId} not found`);
            process.exit(1);
          }
        } else if (action === "assign") {
          const taskId = positionals[2];
          const workerName = positionals.slice(3).join(" ");
          if (!taskId || !workerName) {
            ui.renderError("Usage: px tracker tasks assign <id> <worker>");
            process.exit(1);
          }
          if (assignTask(db, taskId, workerName, repo)) {
            ui.renderSuccess(`Task ${taskId} assigned to ${workerName}`);
          } else {
            ui.renderError(`Task ${taskId} not found`);
            process.exit(1);
          }
        } else if (action === "unassign") {
          const taskId = positionals[2];
          if (!taskId) {
            ui.renderError("Usage: px tracker tasks unassign <id>");
            process.exit(1);
          }
          if (unassignTask(db, taskId, repo)) {
            ui.renderSuccess(`Task ${taskId} unassigned`);
          } else {
            ui.renderError(`Task ${taskId} not found`);
            process.exit(1);
          }
        } else if (action === "add") {
          const taskId = positionals[2];
          const desc = positionals.slice(3).join(" ");
          if (!taskId || !desc) {
            ui.renderError("Usage: px tracker tasks add <id> <description>");
            process.exit(1);
          }
          const portfolio = resolvePortfolio(db, agentName, values.portfolio);
          if (portfolio && !validatePortfolioName(portfolio)) {
            ui.renderError(`Invalid portfolio name: "${portfolio}" (must be a valid git branch name)`);
            process.exit(1);
          }
          if (addTask(db, taskId, desc, values["blocked-by"], portfolio, repo)) {
            ui.renderSuccess(`Added task ${taskId}`);
          } else {
            ui.renderError(`Task ${taskId} already exists`);
            process.exit(1);
          }
        } else if (action === "create") {
          let prefix: string;
          let desc: string;
          if (positionals[3]) {
            // Both prefix and description provided
            prefix = positionals[2];
            desc = positionals.slice(3).join(" ");
          } else if (repo) {
            // Only description provided; derive prefix from repo
            prefix = abbreviate(repo);
            desc = positionals.slice(2).join(" ");
          } else {
            prefix = "";
            desc = "";
          }
          if (!prefix || !desc) {
            ui.renderError("Usage: px tracker tasks create [prefix] <description>\n       (prefix defaults to repo abbreviation when --repo is set)");
            process.exit(1);
          }
          const portfolio = resolvePortfolio(db, agentName, values.portfolio);
          if (portfolio && !validatePortfolioName(portfolio)) {
            ui.renderError(`Invalid portfolio name: "${portfolio}" (must be a valid git branch name)`);
            process.exit(1);
          }
          const taskId = createTask(db, prefix, desc, values["blocked-by"], portfolio, repo);
          console.log(taskId);
        } else if (action === "delete") {
          const taskId = positionals[2];
          if (!taskId) {
            ui.renderError("Usage: px tracker tasks delete <id>");
            process.exit(1);
          }
          if (deleteTask(db, taskId, repo)) {
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
        ui.renderStatus(getTasks(db, ["ready", "assigned", "in-progress"], repo), getWorkers(db, undefined, repo));
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
