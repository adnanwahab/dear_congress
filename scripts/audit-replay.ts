import { replaySnapshot } from "../src/server/audit-replay";

// No network, DB, cookies, keys, or environment-derived inputs.
try {
  const [file, expectedId, ...extra] = process.argv.slice(2);
  if (!file || !expectedId || extra.length || !/^[a-f0-9]{64}$/.test(expectedId)) {
    throw new Error("Usage: bun run audit:replay <snapshot.json> <independently retained snapshot ID>");
  }
  console.log(JSON.stringify(replaySnapshot(await Bun.file(file).json(), expectedId)));
} catch {
  // Do not reflect untrusted filenames, input fields, or potentially private canaries.
  console.error("Audit replay failed: invalid arguments, unreadable bundle, unsupported schema, digest or arithmetic mismatch.");
  process.exitCode = 1;
}
