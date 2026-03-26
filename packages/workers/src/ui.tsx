import React from "react";
import { render, Text, Box } from "ink";
import type { Worker } from "db";

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
            {w.tmux_target && <Text color="cyan">[{w.tmux_target}]</Text>}
          </Box>
        ))
      )}
      <Text color="gray">{workers.length} worker(s)</Text>
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

export function renderWorkers(workers: Worker[]) {
  renderOnce(<WorkerList workers={workers} />);
}

export function renderSuccess(message: string) {
  renderOnce(<Success message={message} />);
}

export function renderError(message: string) {
  renderOnce(<Error message={message} />);
}
