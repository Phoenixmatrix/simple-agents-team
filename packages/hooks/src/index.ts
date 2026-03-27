import { resolve, dirname } from "path";

const rootDir = resolve(dirname(Bun.main), "../../..");
const hook = process.argv[2];
const args = process.argv.slice(3);

const hooks: Record<string, string> = {
  "read-persona": "read-persona.ts",
  "session-start": "session-start.ts",
  "session-end": "session-end.ts",
  "start-daemon": "start-daemon.ts",
  "statusline": "statusline.ts",
  "worker-busy": "worker-busy.ts",
  "worker-idle": "worker-idle.ts",
  "worker-loop": "worker-loop.ts",
};

if (!hook || !hooks[hook]) {
  const available = Object.keys(hooks).join(", ");
  console.error(`Usage: sat hooks <hook> [args]\n\nAvailable hooks: ${available}`);
  process.exit(1);
}

const scriptPath = resolve(rootDir, "packages/hooks/src", hooks[hook]);
const proc = Bun.spawn(["bun", scriptPath, ...args], {
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
  env: process.env,
});
const exitCode = await proc.exited;
process.exit(exitCode);
