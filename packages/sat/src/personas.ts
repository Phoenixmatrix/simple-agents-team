import { resolve, dirname } from "path";

async function run(args: string[]) {
  const rootDir = resolve(dirname(Bun.main), "../../..");
  const name = args[0];

  if (!name) {
    console.error("Usage: sat personas <name>");
    process.exit(1);
  }

  const personaDir = resolve(rootDir, "personas", name);
  console.log(personaDir);
}

export const command = {
  name: "personas",
  description: "Get the path to a persona directory",
  run,
};
