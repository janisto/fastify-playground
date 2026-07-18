import type { Parameters } from "fast-check";

const MAX_RUNS = 10_000;
const MAX_REPLAY_PATH_LENGTH = 2_048;
const DEFAULT_RUNS = 100;

function parseInteger(name: string, raw: string, minimum: number, maximum: number): number {
  if (!/^-?\d+$/.test(raw)) {
    throw new Error(`${name} must be an integer`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  }
  return value;
}

function readOptional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

const runCount = readOptional("FUZZ_RUNS");
const seed = readOptional("FUZZ_SEED");
const replayPath = readOptional("FUZZ_PATH");
type PropertyRunParameters = Pick<Parameters<never>, "numRuns" | "path" | "seed">;

export const propertyParameters: PropertyRunParameters = {
  numRuns: runCount === undefined ? DEFAULT_RUNS : parseInteger("FUZZ_RUNS", runCount, 1, MAX_RUNS),
};
if (seed !== undefined) {
  propertyParameters.seed = parseInteger("FUZZ_SEED", seed, -2_147_483_648, 2_147_483_647);
}
if (replayPath !== undefined) {
  if (seed === undefined) {
    throw new Error("FUZZ_PATH requires FUZZ_SEED");
  }
  if (replayPath.length > MAX_REPLAY_PATH_LENGTH || !/^\d+(?::\d+)*$/.test(replayPath)) {
    throw new Error("FUZZ_PATH must be a colon-separated fast-check replay path");
  }
  propertyParameters.path = replayPath;
}
