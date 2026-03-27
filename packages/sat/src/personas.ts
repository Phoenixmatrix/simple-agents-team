import { resolve, dirname } from "path";

const rootDir = resolve(dirname(Bun.main), "../../..");
const name = process.argv[2];

if (!name) {
  console.error("Usage: sat personas <name>");
  process.exit(1);
}

const personaDir = resolve(rootDir, "personas", name);
console.log(personaDir);
