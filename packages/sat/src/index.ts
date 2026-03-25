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

console.log("Hello from sat!");
