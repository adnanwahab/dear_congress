import { clusterPilot, type PilotManifest } from "./pilot";
import type { DB } from "../../engine/types";

// Reads a disposable snapshot; never loads the running server or writes its database.
if (import.meta.main) {
  const [snapshot, authorization] = Bun.argv.slice(2);
  if (!snapshot || !authorization || Bun.argv.length !== 4) {
    throw new Error("Usage: bun run clusters:pilot <private-db-snapshot.json> <private-manifest.json>");
  }
  const db = await Bun.file(snapshot).json() as Pick<DB, "entries">;
  const manifest = await Bun.file(authorization).json() as PilotManifest;
  if (!Array.isArray(db.entries)) throw new Error("Snapshot must contain journal entries");
  console.log(JSON.stringify(clusterPilot(db.entries, manifest), null, 2));
}
