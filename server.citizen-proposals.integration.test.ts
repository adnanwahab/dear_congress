import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyDB, extract } from "./src/engine/engine";
import type { CitizenProposalView, PublishCitizenProposalInput } from "./src/shared/citizen-proposals";

type RunningServer = { url: URL; stop: () => Promise<void> };

function deadline<T>(promise: Promise<T>, milliseconds: number, message: () => string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message())), milliseconds);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

/** A fresh process proves persistence and avoids changing the test runner's env/module cache. */
async function startServer(dbPath: string): Promise<RunningServer> {
  let logs = "";
  let announce!: (url: URL) => void;
  let fail!: (error: Error) => void;
  let announced = false;
  const ready = new Promise<URL>((resolve, reject) => { announce = resolve; fail = reject; });
  const child = Bun.spawn([process.execPath, "server.ts"], {
    cwd: import.meta.dir,
    env: {
      PATH: process.env.PATH ?? "",
      DB_PATH: dbPath,
      PORT: "0",
      NODE_ENV: "production",
      ANON_COOKIE_SECRET: "integration-only-cookie-secret-at-least-32-chars",
      ADMIN_TOKEN: "integration-reset-admin",
      DEBUG_REQUEST_LOGS: "0",
      OPENAI_API_KEY: "",
      GEMINI_API_KEY: "",
      ANTHROPIC_API_KEY: "",
    },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });

  async function collect(stream: ReadableStream<Uint8Array>, detectReady = false) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let stdout = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        logs = (logs + chunk).slice(-12_000);
        if (detectReady && !announced) {
          stdout += chunk;
          const match = stdout.match(/Civic Synthesis prototype running at (https?:\/\/\S+)/);
          if (match) {
            const url = new URL(match[1]!);
            url.hostname = "127.0.0.1";
            announced = true;
            announce(url);
          }
        }
      }
    } finally { reader.releaseLock(); }
  }

  const streams = Promise.all([collect(child.stdout, true), collect(child.stderr)]);
  void streams.catch((error) => fail(error instanceof Error ? error : new Error(String(error))));
  void child.exited.then((code) => {
    if (!announced) fail(new Error(`Child server exited with ${code} before starting.\n${logs}`));
  });

  let stopped = false;
  async function stop() {
    if (stopped) return;
    stopped = true;
    if (child.exitCode === null) child.kill("SIGTERM");
    try { await deadline(child.exited, 2_000, () => "Child did not stop after SIGTERM"); }
    catch { child.kill("SIGKILL"); await child.exited; }
    await streams;
  }

  try {
    const url = await deadline(ready, 15_000, () => `Child server did not become ready.\n${logs}`);
    return { url, stop };
  } catch (error) { await stop(); throw error; }
}

// Isolated browser cookie jars survive a server restart; headers cannot select voters.
const cookieJars = new Map<string, string>();
interface RequestOptions { voter?: string; method?: string; body?: unknown; rawBody?: string }
async function api<T>(server: RunningServer, path: string, options: RequestOptions = {}) {
  const hasBody = options.body !== undefined || options.rawBody !== undefined;
  const response = await fetch(new URL(path, server.url), {
    method: options.method ?? (hasBody ? "POST" : "GET"),
    headers: {
      ...(cookieJars.get(options.voter ?? "reader") ? { cookie: cookieJars.get(options.voter ?? "reader")! } : {}),
      ...(hasBody ? { "content-type": "application/json" } : {}),
    },
    ...(hasBody ? { body: options.rawBody ?? JSON.stringify(options.body) } : {}),
    signal: AbortSignal.timeout(10_000),
  });
  const issued = response.headers.get("set-cookie")?.split(";")[0];
  if (issued) cookieJars.set(options.voter ?? "reader", issued);
  return { status: response.status, data: await response.json() as T };
}

async function ok<T>(server: RunningServer, path: string, options: RequestOptions = {}) {
  const result = await api<T>(server, path, options);
  if (result.status !== 200) throw new Error(`${path} returned ${result.status}: ${JSON.stringify(result.data)}`);
  return result.data;
}

test("public proposals survive server restarts with independent browser votes and protected sample resets", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "civic-proposals-integration-"));
  const dbPath = join(temporaryDirectory, "db.json");
  const servers: RunningServer[] = [];
  const author = `author-${crypto.randomUUID()}`;
  const otherVoter = `reader-${crypto.randomUUID()}`;
  const source = {
    id: "integration-source-journal",
    author: "Integration resident",
    text: "The bus to work takes too long. More frequent service would help.",
    createdAt: new Date().toISOString(),
  };
  const db = emptyDB();
  db.schemaVersion = 2;
  db.entries = [{ ...source, extraction: extract(source.text), corrected: false }];
  await Bun.write(dbPath, JSON.stringify(db));

  const input: PublishCitizenProposalInput = {
    title: "Frequent bus service pilot",
    problem: "Residents wait too long for the bus to work.",
    proposedChange: "Run a six-month frequent-service pilot and publish its measured results.",
    jurisdiction: "city",
    jurisdictionName: "Houston",
    supportingInfo: "Measure wait time, ridership, and cost per passenger.",
    sourceEntryId: source.id,
    idempotencyKey: crypto.randomUUID(),
    confirmedPublic: true,
  };
  const base = "/api/citizen-proposals";

  try {
    let server = await startServer(dbPath);
    servers.push(server);
    // Launch routes use the same isolated database as this full HTTP journey.
    for (const path of ["/", "/journal", "/needs", "/vote", "/votes", "/feed", "/proposals/new", "/synth", "/embed"]) {
      const page = await fetch(new URL(path, server.url));
      expect(page.status).toBe(200);
      const html = await page.text();
      expect(html).toContain('property="og:title"');
      expect(html).toContain('name="twitter:image"');
      for (const asset of html.matchAll(/(?:src|href)="(\/[^"?#]+\.(?:js|css))"/g)) {
        const response = await fetch(new URL(asset[1]!, server.url));
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toMatch(/javascript|css/);
      }
    }
    const robots = await fetch(new URL("/robots.txt", server.url));
    expect(robots.status).toBe(200);
    expect(await robots.text()).toContain("Sitemap: https://civic-synthesis.fly.dev/sitemap.xml");
    const image = await fetch(new URL("/social-preview.png", server.url));
    expect(image.headers.get("content-type")).toContain("image/png");
    const png = new DataView(await image.arrayBuffer());
    expect(png.getUint32(16)).toBe(1200);
    expect(png.getUint32(20)).toBe(630);
    for (const path of ["/missing-launch-page", "/proposals/missing"]) {
      const missing = await fetch(new URL(path, server.url));
      expect(missing.status).toBe(404);
      const html = await missing.text();
      expect(html).toContain('href="/feed"');
      expect(html).toContain('href="/votes"');
      const head = await fetch(new URL(path, server.url), { method: "HEAD" });
      expect(head.status).toBe(404);
      expect(await head.text()).toBe("");
    }
    expect((await ok<{ proposals: CitizenProposalView[] }>(server, base)).proposals).toEqual([]);
    expect((await ok<{ entry: typeof source }>(server, `${base}/journal/${source.id}`)).entry).toEqual(source);

    const malformed = await api<{ error: string }>(server, base, { voter: author, rawBody: "{broken" });
    expect(malformed.status).toBe(400);
    expect(malformed.data.error).toMatch(/JSON/i);
    const invalidSource = await api<{ error: string }>(server, base, {
      voter: author,
      body: { ...input, sourceEntryId: "missing-journal", idempotencyKey: crypto.randomUUID() },
    });
    expect(invalidSource.status).toBe(400);
    expect(invalidSource.data.error).toMatch(/source journal entry.*not found/i);
    const unknown = await api<{ error: string }>(server, `${base}/citizen_missing`);
    expect(unknown.status).toBe(404);
    expect(unknown.data.error).toMatch(/not found/i);
    expect((await api(server, `${base}/citizen_missing/vote`, { voter: otherVoter, body: { choice: "support" } })).status).toBe(404);

    const published = (await ok<{ proposal: CitizenProposalView }>(server, base, { voter: author, body: input })).proposal;
    const detail = `${base}/${published.id}`;
    const proposalPage = await fetch(new URL(`/proposals/${published.id}`, server.url));
    expect(proposalPage.status).toBe(200);
    const proposalHtml = await proposalPage.text();
    expect(proposalHtml).toContain(`<title>${input.title} | Civic Synthesis</title>`);
    expect(proposalHtml).toContain(`content="${input.problem}"`);
    const sitemap = await fetch(new URL("/sitemap.xml", server.url));
    expect(sitemap.status).toBe(200);
    expect(sitemap.headers.get("content-type")).toContain("application/xml");
    expect(await sitemap.text()).toContain(`https://civic-synthesis.fly.dev/proposals/${published.id}`);
    expect(published.status).toBe("published");
    expect(published.advisory).toBe(true);
    expect(published.sourceEntryId).toBe(source.id);
    expect(published.counts).toEqual({ support: 0, oppose: 0, unsure: 0 });
    expect(published.countTotal).toBe(0);
    expect(published.ownVote).toBeNull();

    const retried = (await ok<{ proposal: CitizenProposalView }>(server, base, { voter: author, body: input })).proposal;
    expect(retried).toEqual(published);
    expect((await ok<{ proposals: CitizenProposalView[] }>(server, base)).proposals).toHaveLength(1);
    const conflict = await api<{ error: string }>(server, base, {
      voter: author, body: { ...input, proposedChange: "Changed after publication" },
    });
    expect(conflict.status).toBe(409);

    const cast = async (voter: string, choice: "support" | "oppose" | "unsure" | null) =>
      (await ok<{ proposal: CitizenProposalView }>(server, `${detail}/vote`, { voter, body: { choice } })).proposal;
    expect((await cast(author, "support")).counts).toEqual({ support: 1, oppose: 0, unsure: 0 });
    const otherView = (await ok<{ proposal: CitizenProposalView }>(server, detail, { voter: otherVoter })).proposal;
    expect(otherView.counts).toEqual({ support: 1, oppose: 0, unsure: 0 });
    expect(otherView.ownVote).toBeNull();
    expect((await cast(otherVoter, "oppose")).counts).toEqual({ support: 1, oppose: 1, unsure: 0 });
    expect((await cast(otherVoter, "support")).counts).toEqual({ support: 2, oppose: 0, unsure: 0 });
    const removed = await cast(author, null);
    expect(removed.counts).toEqual({ support: 1, oppose: 0, unsure: 0 });
    expect(removed.countTotal).toBe(1);
    expect(removed.ownVote).toBeNull();

    const comment = { text: "Please include weekend service in the pilot.", displayName: "A resident", idempotencyKey: crypto.randomUUID() };
    const commented = (await ok<{ proposal: CitizenProposalView }>(server, `${detail}/comments`, { voter: otherVoter, body: comment })).proposal;
    expect(commented.comments).toHaveLength(1);
    expect(commented.comments[0]!.text).toBe(comment.text);
    expect((await ok<{ proposal: CitizenProposalView }>(server, `${detail}/comments`, { voter: otherVoter, body: comment })).proposal.comments).toEqual(commented.comments);

    const objectionBody = { action: "create", text: "Weekend access is missing", severity: "major", constituency: "Shift workers", confirmedPublic: true, idempotencyKey: crypto.randomUUID() };
    const objected = (await ok<{ proposal: CitizenProposalView }>(server, `${detail}/objections`, { voter: otherVoter, body: objectionBody })).proposal;
    expect(objected.objections).toHaveLength(1);
    expect(objected.counts).toEqual(commented.counts);
    const responseBody = { action: "respond", objectionId: objected.objections[0]!.id, expectedVersion: 0, status: "declined", reason: "A separate weekend pilot is needed" };
    const responded = (await ok<{ proposal: CitizenProposalView }>(server, `${detail}/objections`, { voter: author, body: responseBody })).proposal;
    expect(responded.objections[0]!.responses[0]!.status).toBe("declined");
    const publicJson = JSON.stringify(responded);
    for (const privateValue of [author, otherVoter, input.idempotencyKey, comment.idempotencyKey, "ownerHash", "votesByVoterHash", "publishKeyHash", "submitKeyHash", "bodyHash"]) {
      expect(publicJson).not.toContain(privateValue);
    }

    await server.stop();
    server = await startServer(dbPath);
    servers.push(server);
    const restarted = (await ok<{ proposal: CitizenProposalView }>(server, detail, { voter: otherVoter })).proposal;
    expect(restarted.counts).toEqual({ support: 1, oppose: 0, unsure: 0 });
    expect(restarted.countTotal).toBe(1);
    expect(restarted.ownVote).toBe("support");
    expect(restarted.comments).toEqual(commented.comments);
    expect(restarted.objections).toEqual(responded.objections);
    expect(restarted.publishedAt).toBe(published.publishedAt);
    expect((await ok<{ proposal: CitizenProposalView }>(server, detail)).proposal.ownVote).toBeNull();
    expect((await ok<{ proposal: CitizenProposalView }>(server, base, { voter: author, body: input })).proposal.id).toBe(published.id);
    const list = (await ok<{ proposals: CitizenProposalView[] }>(server, base, { voter: otherVoter })).proposals;
    expect(list).toEqual([restarted]);

    const reset = await fetch(new URL("/api/reset", server.url), { method: "POST", headers: { authorization: "Bearer integration-reset-admin" } });
    expect(reset.status).toBe(200);
    expect((await ok<{ proposal: CitizenProposalView }>(server, detail, { voter: otherVoter })).proposal).toEqual(restarted);
    expect((await ok<{ entry: typeof source }>(server, `${base}/journal/${source.id}`)).entry).toEqual(source);

    for (const path of ["/", "/journal", "/needs", "/vote", "/synth", "/votes", "/feed", "/proposals/new", `/proposals/${published.id}`]) {
      const response = await fetch(new URL(path, server.url), { signal: AbortSignal.timeout(15_000) });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(await response.text()).toMatch(/<!doctype html>/i);
    }
  } finally {
    await Promise.all(servers.map((server) => server.stop()));
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}, 60_000);
