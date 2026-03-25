import { parseArgs } from "util";

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

const proc = Bun.spawn(["claude"], {
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});
await proc.exited;
