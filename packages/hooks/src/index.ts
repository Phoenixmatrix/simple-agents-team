
const hooks: Record<string, () => Promise<typeof import("./worker-loop")>> = {
  "read-persona": () => import("./read-persona"),
  "session-start": () => import("./session-start"),
  "session-end": () => import("./session-end"),
  "start-daemon": () => import("./start-daemon"),
  "statusline": () => import("./statusline"),
  "worker-busy": () => import("./worker-busy"),
  "worker-idle": () => import("./worker-idle"),
  "worker-loop": () => import("./worker-loop"),
  "guard-dangerous": () => import("./guard-dangerous"),
};

async function run(args: string[]) {
  const hook = args[0];

  if (!hook || !hooks[hook]) {
    const available = Object.keys(hooks).join(", ");
    console.error(`Usage: sat hooks <hook> [args]\n\nAvailable hooks: ${available}`);
    process.exit(1);
  }

  // Set remaining args so hook scripts can read them from process.argv
  // Hook scripts use process.argv[2] for their first arg
  process.argv = [process.argv[0], process.argv[1], ...args.slice(1)];

  await hooks[hook]();
}

export const command = {
  name: "hooks",
  description: "Run a lifecycle hook",
  run,
};
