import { $ } from "bun";

const name = process.env.PX_AGENT_NAME;
if (name) {
  await $`px workers status ${name} idle`.quiet();
}
