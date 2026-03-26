export {};

const input = await Bun.stdin.text();
const data = JSON.parse(input);

const agentName = process.env.SAT_AGENT_NAME ?? "sat";
const model = data.model?.display_name ?? "?";

const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

console.log(`${CYAN}🤖 ${agentName}${RESET} ${DIM}·${RESET} ${model}`);
