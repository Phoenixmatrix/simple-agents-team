import { uniqueNamesGenerator, adjectives, colors, animals } from "unique-names-generator";

async function run(_args: string[]) {
  const name = uniqueNamesGenerator({
    dictionaries: [adjectives, colors, animals],
    separator: "-",
    length: 3,
  });
  console.log(name);
}

export const command = {
  name: "get-agent-name",
  description: "Generate a unique agent name",
  run,
};
