import { $ } from "bun";

const name = process.env.SAT_AGENT_NAME;
if (name) {
  await $`bun workers status ${name} idle`.quiet();
}
