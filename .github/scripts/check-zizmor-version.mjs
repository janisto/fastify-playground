import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const expected = "zizmor 1.27.0";
let stdout;
try {
  ({ stdout } = await execFileAsync("zizmor", ["--version"]));
} catch (error) {
  throw new Error(`Expected ${expected}; install that exact analyzer before running workflow checks`, { cause: error });
}
const actual = stdout.trim();

if (actual !== expected) {
  throw new Error(`Expected ${expected}, found ${actual}; install the exact required analyzer version`);
}
