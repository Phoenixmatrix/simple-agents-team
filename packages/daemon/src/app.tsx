import React, { useState, useEffect, useRef } from "react";
import { render, Text, Box } from "ink";
import { openDatabase, getWorkers, type Worker } from "db";
import { TmuxSession } from "tmux-manager";

const IDLE_THRESHOLD_MS = 20_000;
const POLL_INTERVAL_MS = 2000;
const SKIP_WORKERS = new Set(["coordinator", "daemon"]);

function StatusDashboard() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const idleSince = useRef<Map<string, number>>(new Map());
  const nudged = useRef<Set<string>>(new Set());

  useEffect(() => {
    const poll = async () => {
      let currentWorkers: Worker[] = [];
      try {
        const db = openDatabase();
        currentWorkers = getWorkers(db);
        db.close();
      } catch {
        return;
      }

      setWorkers(currentWorkers);

      const now = Date.now();
      for (const w of currentWorkers) {
        if (SKIP_WORKERS.has(w.worker_name)) continue;
        if (!w.tmux_target) continue;

        if (w.status === "idle") {
          if (!idleSince.current.has(w.worker_name)) {
            idleSince.current.set(w.worker_name, now);
            nudged.current.delete(w.worker_name);
          }

          const idleTime = now - idleSince.current.get(w.worker_name)!;
          if (idleTime >= IDLE_THRESHOLD_MS && !nudged.current.has(w.worker_name)) {
            nudged.current.add(w.worker_name);
            try {
              await TmuxSession.sendKeysToTarget(w.tmux_target, "Wake up and initialize.");
            } catch {
              // Session may be gone
            }
          }
        } else {
          idleSince.current.delete(w.worker_name);
          nudged.current.delete(w.worker_name);
        }
      }

      // Clean up workers that no longer exist
      const currentNames = new Set(currentWorkers.map((w) => w.worker_name));
      for (const name of idleSince.current.keys()) {
        if (!currentNames.has(name)) {
          idleSince.current.delete(name);
          nudged.current.delete(name);
        }
      }
    };

    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const statusColor = (status: string) => {
    switch (status) {
      case "idle": return "gray";
      case "busy": return "green";
      default: return "white";
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">SAT Dashboard</Text>
      <Box flexDirection="column" marginTop={1}>
        <Box gap={2} marginBottom={1}>
          <Box width={20}><Text bold color="yellow">Worker</Text></Box>
          <Box width={12}><Text bold color="yellow">Status</Text></Box>
          <Box><Text bold color="yellow">Session</Text></Box>
        </Box>
        {workers.length === 0 ? (
          <Text color="gray">  No workers registered</Text>
        ) : (
          workers.map((w) => (
            <Box key={w.id} gap={2}>
              <Box width={20}><Text bold color="magenta">{w.worker_name}</Text></Box>
              <Box width={12}><Text color={statusColor(w.status)}>{w.status}</Text></Box>
              <Box><Text color="cyan">{w.tmux_target ?? "-"}</Text></Box>
            </Box>
          ))
        )}
      </Box>
      <Box marginTop={1}><Text color="gray">{workers.length} worker(s)</Text></Box>
    </Box>
  );
}

render(<StatusDashboard />);
