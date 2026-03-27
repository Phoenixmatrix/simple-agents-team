import { $ } from "bun";

const name = process.env.SAT_AGENT_NAME;
if (name) {
  await $`sat workers status ${name} idle`.quiet();
}
