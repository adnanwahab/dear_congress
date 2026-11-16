import { sanitizeBuild } from "../src/server/build-identity";
const identity = sanitizeBuild({ commit: process.env.BUILD_COMMIT, builtAt: new Date().toISOString(), release: process.env.BUILD_RELEASE });
if (!identity.commit) throw new Error("BUILD_COMMIT must be a full lowercase git SHA");
if (process.env.BUILD_RELEASE && !identity.release) throw new Error("BUILD_RELEASE must be a public v-prefixed release tag");
await Bun.write(new URL("../build-identity.json", import.meta.url), JSON.stringify(identity) + "\n");
