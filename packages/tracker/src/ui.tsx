import React from "react";
import { render, Text, Box } from "ink";
import type { Task, Worker } from "./db";

function TaskList({ tasks }: { tasks: Task[] }) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color="yellow">Tasks</Text>
      {tasks.length === 0 ? (
        <Text color="gray">  (none)</Text>
      ) : (
        tasks.map((t) => (
          <Box key={t.task_id} gap={1}>
            <Text color="cyan">[{t.task_id}]</Text>
            <Text color={t.status === "done" ? "gray" : t.status === "in-progress" ? "yellow" : t.status === "assigned" ? "blue" : "white"}>{t.status}</Text>
            <Text>{t.description}</Text>
            {t.assigned_to && <Text color="magenta">({t.assigned_to})</Text>}
            {t.blocked_by && <Text color="red">[blocked by {t.blocked_by}]</Text>}
            {t.portfolio && <Text color="green">[{t.portfolio}]</Text>}
          </Box>
        ))
      )}
      <Text color="gray">{tasks.length} task(s)</Text>
    </Box>
  );
}

function WorkerList({ workers }: { workers: Worker[] }) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color="yellow">Workers</Text>
      {workers.length === 0 ? (
        <Text color="gray">  (none)</Text>
      ) : (
        workers.map((w) => (
          <Box key={w.id} gap={1}>
            <Text bold color="magenta">{w.worker_name}</Text>
            <Text color={w.status === "idle" ? "gray" : "green"}>{w.status}</Text>
          </Box>
        ))
      )}
      <Text color="gray">{workers.length} worker(s)</Text>
    </Box>
  );
}

function Status({ tasks, workers }: { tasks: Task[]; workers: Worker[] }) {
  return (
    <Box flexDirection="column" paddingX={1} gap={1}>
      <Text bold color="cyan">SAT Tracker</Text>
      <TaskList tasks={tasks} />
      <WorkerList workers={workers} />
    </Box>
  );
}

function Success({ message }: { message: string }) {
  return (
    <Box paddingX={1}>
      <Text color="green">✓ {message}</Text>
    </Box>
  );
}

function Error({ message }: { message: string }) {
  return (
    <Box paddingX={1}>
      <Text color="red">✗ {message}</Text>
    </Box>
  );
}

function renderOnce(element: React.ReactElement) {
  const { unmount } = render(element);
  unmount();
}

export function renderTasks(tasks: Task[]) {
  renderOnce(<TaskList tasks={tasks} />);
}

export function renderWorkers(workers: Worker[]) {
  renderOnce(<WorkerList workers={workers} />);
}

export function renderStatus(tasks: Task[], workers: Worker[]) {
  renderOnce(<Status tasks={tasks} workers={workers} />);
}

export function renderSuccess(message: string) {
  renderOnce(<Success message={message} />);
}

export function renderError(message: string) {
  renderOnce(<Error message={message} />);
}
