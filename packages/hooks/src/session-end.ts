import { $ } from "bun";

await $`bun workers clear`.quiet();
