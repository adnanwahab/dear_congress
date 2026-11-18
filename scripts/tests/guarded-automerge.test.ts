import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const dir = new URL("../../.github/workflows/", import.meta.url);

// User explicitly disabled automatic merges for Dear Congress.
// The old five-minute guarded-automerge workflow must not return unnoticed.
test("Dear Congress has no PR auto-merge workflow", () => {
  expect(existsSync(new URL("guarded-automerge.yml", dir))).toBe(false);
  const workflows = readdirSync(dir).filter(name => /\.ya?ml$/.test(name));
  for (const name of workflows) {
    const content = readFileSync(new URL(name, dir), "utf8");
    expect(content).not.toMatch(/gh\s+pr\s+merge|enablePullRequestAutoMerge|\/pulls\/[^\s'"]+\/merge/i);
    // Scheduled or PR-triggered jobs should never hold PR write authority.
    const isAutomatic = /^\s*(?:schedule|workflow_run|pull_request_target):/m.test(content);
    if (isAutomatic) expect(content).not.toMatch(/^\s*pull-requests:\s*write\s*$/m);
  }
});
