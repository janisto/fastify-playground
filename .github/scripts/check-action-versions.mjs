import { readdir, readFile } from "node:fs/promises";

const workflows = new URL("../workflows/", import.meta.url);
const usesClause = /^\s*(?:-\s+)?uses:\s*["']?([^\s"'#]+)["']?/;
const fullActionVersion = /^[^@\s]+@v\d+\.\d+\.\d+$/;
const rejectedExamples = [
  "uses: actions/checkout@main",
  "- uses: actions/checkout@v7",
  'uses: "actions/checkout"',
  "uses: 'actions/checkout@7.0.0'",
];

const names = (await readdir(workflows))
  .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
  .sort();

let externalActions = 0;
const failures = [];

for (const line of rejectedExamples) {
  const action = usesClause.exec(line)?.[1];
  if (action === undefined) {
    failures.push(`Policy failed to parse controlled example: ${line}`);
  } else if (fullActionVersion.test(action)) {
    failures.push(`Policy unexpectedly accepted ${action}`);
  }
}
const acceptedExample = usesClause.exec('uses: "actions/checkout@v7.0.0"')?.[1];
if (acceptedExample === undefined || !fullActionVersion.test(acceptedExample)) {
  failures.push("Policy unexpectedly rejected actions/checkout@v7.0.0");
}

for (const name of names) {
  const lines = (await readFile(new URL(name, workflows), "utf8")).split("\n");
  for (const [index, line] of lines.entries()) {
    const action = usesClause.exec(line)?.[1];
    if (action === undefined || action.startsWith("./")) continue;

    externalActions += 1;
    if (!fullActionVersion.test(action)) {
      failures.push(`${name}:${index + 1}: ${action} must use @vMAJOR.MINOR.PATCH`);
    }
  }
}

if (externalActions === 0) {
  failures.push("No external GitHub Actions were found");
}

if (failures.length > 0) {
  throw new Error(failures.join("\n"));
}

console.log(`Checked ${externalActions} external GitHub Action references`);
