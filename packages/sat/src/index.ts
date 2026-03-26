import { parseArgs } from "util";
import { resolve, dirname } from "path";

const rootDir = resolve(dirname(Bun.main), "../../..");
const settingsPath = resolve(rootDir, "personas/coordinator/settings.json");

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    help: {
      type: "boolean",
      short: "h",
    },
  },
  allowPositionals: true,
});

if (values.help) {
  console.log(`sat - simple agents team CLI

Usage:
  sat [options]

Options:
  -h, --help    Show this help message`);
  process.exit(0);
}

const initialPrompt = "Go through the initialization process";

const proc = Bun.spawn(["claude", "--settings", settingsPath, "--model", "claude-sonnet-4-6"], {
  stdin: new TextEncoder().encode(initialPrompt),
  stdout: "inherit",
  stderr: "inherit",
  env: { ...process.env, CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1" },
});
await proc.exited;
