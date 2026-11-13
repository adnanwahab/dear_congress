import { sanitizeBuild } from "../src/server/build-identity";
const identity = sanitizeBuild({ commit: process.env.BUILD_COMMIT, builtAt: new Date().toISOString() });
if (!identity.commit) throw new Error("BUILD_COMMIT must be a full lowercase git SHA");
await Bun.write(new URL("../build-identity.json", import.meta.url), JSON.stringify(identity) + "\n");
