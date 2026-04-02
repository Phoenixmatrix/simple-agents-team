import { getPersonaDir } from "./personas-data";

async function run(args: string[]) {
  const name = args[0];

  if (!name) {
    console.error("Usage: sat personas <name>");
    process.exit(1);
  }

  console.log(getPersonaDir(name));
}

export const command = {
  name: "personas",
  description: "Get the path to a persona directory",
  run,
};
