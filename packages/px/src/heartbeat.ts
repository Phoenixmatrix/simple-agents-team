import { openDatabase, setHeartbeat, clearHeartbeat } from "db";

const HELP = `px heartbeat - Update worker heartbeat

Usage:
  px heartbeat         Set heartbeat for current worker (reads PX_AGENT_NAME)
  px heartbeat clear   Clear heartbeat for current worker (reads PX_AGENT_NAME)

Options:
  -h, --help           Show this help message`;

async function run(args: string[]) {
  if (args[0] === "-h" || args[0] === "--help") {
    console.log(HELP);
    return;
  }

  const workerName = process.env.PX_AGENT_NAME;
  if (!workerName) {
    console.error("PX_AGENT_NAME is not set");
    process.exit(1);
  }

  const db = openDatabase();
  try {
    if (args[0] === "clear") {
      clearHeartbeat(db, workerName);
    } else {
      setHeartbeat(db, workerName);
    }
  } finally {
    db.close();
  }
}

export const command = {
  name: "heartbeat",
  description: "Update worker heartbeat timestamp",
  run,
};
