import { uniqueNamesGenerator, adjectives, colors, animals } from "unique-names-generator";

const name = uniqueNamesGenerator({
  dictionaries: [adjectives, colors, animals],
  separator: "-",
  length: 3,
});

console.log(name);
