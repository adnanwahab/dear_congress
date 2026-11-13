import { strict as assert } from "node:assert";
export async function verifyRelease(origin: string | undefined, expected: string | undefined, request: typeof fetch = fetch) {
assert.ok(origin && /^https?:\/\//.test(origin), "Supply the release origin");
assert.match(expected ?? "", /^[a-f0-9]{40}$/, "Supply the intended full release SHA");
const response = await request(new URL("/version", origin), { cache: "no-store", signal: AbortSignal.timeout(15000) });
assert.equal(response.status, 200);
const version = await response.json();
assert.equal(version.commit, expected, "Deployed SHA differs from intended release");
assert.ok(version.builtAt && Number.isFinite(Date.parse(version.builtAt)), "Missing build date");
const page = await request(new URL("/", origin), { cache: "no-store", signal: AbortSignal.timeout(15000) });
assert.equal(page.status, 200);
assert.ok((await page.text()).includes(`data-build-commit="${expected}"`), "Page and server versions differ");
}
if (import.meta.main) {
  const [origin, expected] = process.argv.slice(2);
  await verifyRelease(origin, expected);
  console.log(`Verified release ${expected}`);
}
