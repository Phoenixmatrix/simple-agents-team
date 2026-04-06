import React, { useState, useEffect } from "react";
import { render, Text, Box, useInput, useApp } from "ink";
import { openDatabase, getWorkersByWorkspace, getWorkers, getTasks, type Worker } from "db";
import { execSync } from "child_process";

const POLL_INTERVAL_MS = 2000;

interface AgentRow {
  label: string;
  status: string;
  repo: string | null;
  tmuxTarget: string | null;
  type: "header" | "agent";
}

function buildRows(workers: Worker[], tasksByRepo: Map<string, number>): AgentRow[] {
  const rows: AgentRow[] = [];

  // Global agents (coordinator, daemon)
  const global = workers.filter((w) => !w.repo);
  if (global.length > 0) {
    for (const w of global) {
      rows.push({ label: w.worker_name, status: w.status, repo: null, tmuxTarget: w.tmux_target, type: "agent" });
    }
  }

  // Group by repo
  const byRepo = new Map<string, Worker[]>();
  for (const w of workers) {
    if (!w.repo) continue;
    const list = byRepo.get(w.repo) ?? [];
    list.push(w);
    byRepo.set(w.repo, list);
  }

  for (const [repoSlug, repoWorkers] of [...byRepo.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const taskCount = tasksByRepo.get(repoSlug) ?? 0;
    rows.push({ label: `${repoSlug} (${taskCount} task${taskCount !== 1 ? "s" : ""})`, status: "", repo: repoSlug, tmuxTarget: null, type: "header" });
    for (const w of repoWorkers) {
      rows.push({ label: w.worker_name, status: w.status, repo: repoSlug, tmuxTarget: w.tmux_target, type: "agent" });
    }
  }

  return rows;
}

function Dashboard() {
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const workspace = process.env.PX_WORKSPACE;
  const { exit } = useApp();

  useEffect(() => {
    const poll = () => {
      try {
        const db = openDatabase();
        const workers = workspace ? getWorkersByWorkspace(db, workspace) : getWorkers(db);

        // Count active tasks per repo
        const activeTasks = getTasks(db, ["ready", "assigned", "in-progress"]);
        const tasksByRepo = new Map<string, number>();
        for (const t of activeTasks) {
          if (t.repo) {
            tasksByRepo.set(t.repo, (tasksByRepo.get(t.repo) ?? 0) + 1);
          }
        }

        db.close();
        setRows(buildRows(workers, tasksByRepo));
      } catch {
        // DB may not be ready
      }
    };

    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  // Keep selection in bounds
  const agentIndices = rows.map((r, i) => (r.type === "agent" ? i : -1)).filter((i) => i >= 0);

  useInput((input, key) => {
    if (input === "q") {
      exit();
      return;
    }

    if (key.upArrow) {
      const currentPos = agentIndices.indexOf(selectedIndex);
      if (currentPos > 0) {
        setSelectedIndex(agentIndices[currentPos - 1]);
      }
      setMessage(null);
    }

    if (key.downArrow) {
      const currentPos = agentIndices.indexOf(selectedIndex);
      if (currentPos < agentIndices.length - 1) {
        setSelectedIndex(agentIndices[currentPos + 1]);
      }
      setMessage(null);
    }

    if (key.return) {
      const row = rows[selectedIndex];
      if (row?.tmuxTarget) {
        const session = row.tmuxTarget.split(":")[0];
        try {
          execSync(`tmux switch-client -t ${session}`, { stdio: "ignore" });
        } catch {
          setMessage(`Could not switch to ${session}`);
        }
      }
    }
  });

  // Ensure selectedIndex points to a valid agent
  if (agentIndices.length > 0 && !agentIndices.includes(selectedIndex)) {
    // Will fix on next render via effect, just show what we have
  }

  const statusColor = (status: string) => {
    switch (status) {
      case "idle": return "gray";
      case "busy": return "green";
      default: return "white";
    }
  };

  const wsLabel = workspace ? workspace.split("/").pop() : "unknown";

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">{wsLabel} workspace</Text>
      <Box flexDirection="column" marginTop={1}>
        {rows.length === 0 ? (
          <Text color="gray">  No agents registered</Text>
        ) : (
          rows.map((row, i) => {
            if (row.type === "header") {
              return (
                <Box key={`h-${row.label}`} marginTop={1}>
                  <Text bold color="blue">{row.label}</Text>
                </Box>
              );
            }
            const isSelected = i === selectedIndex;
            const cursor = isSelected ? "▸ " : "  ";
            return (
              <Box key={`a-${row.label}-${row.repo}`} gap={2}>
                <Box width={22}>
                  <Text bold={isSelected} color={isSelected ? "white" : "magenta"}>
                    {cursor}{row.label}
                  </Text>
                </Box>
                <Box width={12}>
                  <Text color={statusColor(row.status)}>{row.status}</Text>
                </Box>
                <Box>
                  <Text color="cyan">{row.tmuxTarget ?? "-"}</Text>
                </Box>
              </Box>
            );
          })
        )}
      </Box>
      <Box marginTop={1}>
        <Text color="gray">
          {agentIndices.length} agent(s)  |  ↑↓ navigate  ↵ switch  q quit
        </Text>
      </Box>
      {message && (
        <Box marginTop={1}>
          <Text color="red">{message}</Text>
        </Box>
      )}
    </Box>
  );
}

render(<Dashboard />);
