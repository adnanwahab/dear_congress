#!/usr/bin/env bun
// Remove journals that happybearlandia /world posted before the `synthetic` flag existed.
//
//   Live server (dry run, then apply):
//     ADMIN_TOKEN=... bun run purge:world --url https://dear-congress.fly.dev
//     ADMIN_TOKEN=... bun run purge:world --url https://dear-congress.fly.dev --apply
//     ... --mode flag      keep them, but mark synthetic instead of deleting
//
//   Offline, on a downloaded copy (never overwrites the input):
//     bun run purge:world --file db.json [--apply --out db.cleaned.json]

import { parseArgs } from "node:util";
import { applyPurge, planPurge, type PurgeMode, type PurgePlan } from "../src/server/purge-world-journals";
import type { DB } from "../src/engine/types";

const { values: args } = parseArgs({
  options: {
    url: { type: "string" },
    file: { type: "string" },
    out: { type: "string" },
    apply: { type: "boolean", default: false },
    mode: { type: "string", default: "delete" },
    help: { type: "boolean", short: "h", default: false },
  },
});

const usage = `Usage:
  ADMIN_TOKEN=... bun run purge:world --url https://dear-congress.fly.dev [--apply] [--mode delete|flag]
  bun run purge:world --file db.json [--apply --out db.cleaned.json] [--mode delete|flag]`;

if (args.help || (!args.url && !args.file) || (args.url && args.file)) {
  console.log(usage);
  process.exit(args.help ? 0 : 1);
}
if (args.mode !== "delete" && args.mode !== "flag") {
  console.error(`--mode must be "delete" or "flag"`);
  process.exit(1);
}
const mode = args.mode as PurgeMode;

function report(plan: PurgePlan) {
  const short = (t: string) => (t.length > 90 ? t.slice(0, 87) + "…" : t).replace(/\s+/g, " ");
  console.log(`\nWorld journals stored as real people: ${plan.entries.length}`);
  for (const e of plan.entries) console.log(`  ${e.createdAt.slice(0, 16)}  [${e.match}]  ${short(e.text)}`);
  if (plan.emergentNeeds.length) {
    console.log(`\nEmergent needs created only by them: ${plan.emergentNeeds.length}`);
    for (const n of plan.emergentNeeds) console.log(`  ${n.id}  "${n.label}"`);
  }
  if (plan.review.length) {
    console.log(`\nLooks like world text but a different author — NOT touched, check by hand: ${plan.review.length}`);
    for (const e of plan.review) console.log(`  ${e.id}  ${e.author}  ${short(e.text)}`);
  }
  console.log(`\nAlready flagged synthetic (fine, left alone): ${plan.alreadyFlagged}`);
}

if (args.file) {
  const db = (await Bun.file(args.file).json()) as DB;
  db.emergentNeeds ??= [];
  const plan = planPurge(db);
  report(plan);
  if (!args.apply) {
    console.log(`\nDry run. Add --apply --out <file> to write a cleaned copy (${mode}).`);
    process.exit(0);
  }
  if (!args.out || args.out === args.file) {
    console.error("--apply with --file needs --out <different file>; the input is never overwritten.");
    process.exit(1);
  }
  const applied = applyPurge(db, plan, mode);
  await Bun.write(args.out, JSON.stringify(db, null, 2));
  console.log(`\n${mode === "delete" ? "Deleted" : "Flagged"} ${applied.entries} entries, removed ${applied.emergentNeeds} emergent needs → ${args.out}`);
  process.exit(0);
}

const token = process.env.ADMIN_TOKEN?.trim();
if (!token) {
  console.error("Set ADMIN_TOKEN (the same value as the server's secret).");
  process.exit(1);
}
const endpoint = new URL("/api/admin/purge-world-journals", args.url!);
const res = await fetch(endpoint, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
  body: JSON.stringify({ apply: args.apply, mode }),
});
if (res.status === 404) {
  console.error(`${endpoint} returned 404: the server isn't deployed with this route, ADMIN_TOKEN isn't set there, or the token doesn't match.`);
  process.exit(1);
}
if (!res.ok) {
  console.error(`${endpoint} → HTTP ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const out = (await res.json()) as { dryRun: boolean; plan: PurgePlan; applied?: { entries: number; emergentNeeds: number }; backupPath?: string };
report(out.plan);
if (out.dryRun) {
  console.log(`\nDry run — nothing changed. Re-run with --apply to ${mode} these.`);
} else {
  console.log(`\n${mode === "delete" ? "Deleted" : "Flagged"} ${out.applied!.entries} entries, removed ${out.applied!.emergentNeeds} emergent needs.`);
  console.log(`Backup on the server: ${out.backupPath}`);
}
