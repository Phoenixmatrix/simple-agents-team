import { parseArgs } from "util";
import { detectRepos } from "./workspace";

async function run(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });

  const action = positionals[0] ?? "list";

  if (values.help) {
    console.log(`px repo - List repos in the current workspace

Usage:
  px repo [action]

Commands:
  (none)    List repos (human-readable)
  list      Same as above
  json      Output repos as JSON

Options:
  -h, --help    Show this help message`);
    return;
  }

  const workspace = process.env.PX_WORKSPACE || process.env.PX_CWD || process.cwd();
  const repos = detectRepos(workspace);

  if (action === "json") {
    console.log(JSON.stringify(repos, null, 2));
    return;
  }

  if (repos.length === 0) {
    console.log("No repos found in workspace: " + workspace);
    return;
  }

  console.log(`Workspace: ${workspace}`);
  console.log(`${repos.length} repo(s):\n`);
  for (const repo of repos) {
    console.log(`  ${repo.slug.padEnd(20)} ${repo.path}`);
  }
}

export const command = {
  name: "repo",
  description: "List repos in workspace",
  run,
};
