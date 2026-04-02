import { resolve } from "path";

const personaDir = process.argv[2];
if (!personaDir) {
  console.error("Usage: read-persona.ts <persona-dir>");
  process.exit(1);
}

const agentName = process.env.PX_AGENT_NAME;
if (agentName) {
  console.log(`Your name is **${agentName}**.`);
  console.log();
}

const file = Bun.file(resolve(personaDir, "persona.md"));
const content = await file.text();
console.log(content);
