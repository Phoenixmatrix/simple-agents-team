import * as p from "@clack/prompts";
import type { Task, Worker } from "./db";

export function renderTasks(tasks: Task[]) {
  p.intro("Tasks");
  if (tasks.length === 0) {
    p.log.info("(none)");
  } else {
    for (const t of tasks) {
      p.log.step(`[${t.task_id}] ${t.description}`);
    }
  }
  p.outro(`${tasks.length} task(s)`);
}

export function renderWorkers(workers: Worker[]) {
  p.intro("Workers");
  if (workers.length === 0) {
    p.log.info("(none)");
  } else {
    for (const w of workers) {
      p.log.step(`${w.worker_name}: ${w.status}`);
    }
  }
  p.outro(`${workers.length} worker(s)`);
}

export function renderStatus(tasks: Task[], workers: Worker[]) {
  p.intro("SAT Tracker");

  p.log.message(`Tasks (${tasks.length})`);
  if (tasks.length === 0) {
    p.log.info("  (none)");
  } else {
    for (const t of tasks) {
      p.log.step(`[${t.task_id}] ${t.description}`);
    }
  }

  p.log.message(`Workers (${workers.length})`);
  if (workers.length === 0) {
    p.log.info("  (none)");
  } else {
    for (const w of workers) {
      p.log.step(`${w.worker_name}: ${w.status}`);
    }
  }

  p.outro("Done");
}

export function renderSuccess(message: string) {
  p.log.success(message);
}

export function renderError(message: string) {
  p.log.error(message);
}
