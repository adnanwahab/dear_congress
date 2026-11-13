import { readFileSync } from "node:fs";

export function sanitizeBuild(value: unknown) {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.freeze({
    commit: typeof input.commit === "string" && /^[a-f0-9]{40}$/.test(input.commit) ? input.commit : null,
    builtAt: typeof input.builtAt === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(input.builtAt) && Number.isFinite(Date.parse(input.builtAt)) ? input.builtAt : null,
    repository: "https://github.com/adnanwahab/dear_congress",
    mode: "demo",
  });
}

// Read once from the image, never from runtime SHA/timestamp overrides.
let manifest: Record<string, unknown> = {};
try { manifest = JSON.parse(readFileSync(new URL("../../build-identity.json", import.meta.url), "utf8")); } catch { /* Local source checkout has no release identity. */ }
export const buildIdentity = Object.freeze({
  ...sanitizeBuild(manifest),
  environment: process.env.NODE_ENV === "production" ? "production" : "development",
  flyRelease: /^v\d{1,12}$/.test(process.env.FLY_RELEASE_VERSION ?? "") ? process.env.FLY_RELEASE_VERSION! : null,
});
