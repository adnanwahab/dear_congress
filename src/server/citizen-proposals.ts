import { createHash } from "node:crypto";
import {
  ADVISORY_CHOICES, CITIZEN_PROPOSAL_LIMITS, PROPOSAL_JURISDICTIONS,
  type AdvisoryChoice, type CitizenProposalInput, type CitizenProposalRecord,
  type CitizenProposalView, type ProposalJurisdiction,
} from "../shared/citizen-proposals";

interface PublicJournalSource {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

export interface CitizenProposalStore {
  entries: PublicJournalSource[];
  citizenProposals?: CitizenProposalRecord[];
}

export class CitizenProposalError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function objectBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new CitizenProposalError("A JSON object is required.");
  }
  return body as Record<string, unknown>;
}

function textField(body: Record<string, unknown>, name: keyof typeof CITIZEN_PROPOSAL_LIMITS, required: boolean) {
  const value = body[name];
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string") throw new CitizenProposalError(`${name} must be text.`);
  const text = value.trim();
  if (required && !text) throw new CitizenProposalError(`${name} is required.`);
  if (text.length > CITIZEN_PROPOSAL_LIMITS[name]) {
    throw new CitizenProposalError(`${name} must be ${CITIZEN_PROPOSAL_LIMITS[name]} characters or fewer.`);
  }
  return text || undefined;
}

function normalizedInput(body: Record<string, unknown>): CitizenProposalInput {
  if (typeof body.jurisdiction !== "string" || !PROPOSAL_JURISDICTIONS.includes(body.jurisdiction as ProposalJurisdiction)) {
    throw new CitizenProposalError("Choose city, county, state, federal, or unsure for jurisdiction.");
  }
  const optional = {
    jurisdictionName: textField(body, "jurisdictionName", false),
    supportingInfo: textField(body, "supportingInfo", false),
    sourceEntryId: textField(body, "sourceEntryId", false),
  };
  return {
    title: textField(body, "title", true)!,
    problem: textField(body, "problem", true)!,
    proposedChange: textField(body, "proposedChange", true)!,
    jurisdiction: body.jurisdiction as ProposalJurisdiction,
    ...(optional.jurisdictionName ? { jurisdictionName: optional.jurisdictionName } : {}),
    ...(optional.supportingInfo ? { supportingInfo: optional.supportingInfo } : {}),
    ...(optional.sourceEntryId ? { sourceEntryId: optional.sourceEntryId } : {}),
  };
}

function voterHash(voterId: string) {
  if (voterId.length < 8 || voterId.length > 200 || /[\x00-\x20\x7f]/.test(voterId)) {
    throw new CitizenProposalError("A valid browser voter ID is required in x-voter-id.");
  }
  return hash(`citizen-voter:${voterId}`);
}

function requestVoter(req: Request, required: boolean) {
  const value = req.headers.get("x-voter-id")?.trim();
  if (!value) {
    if (required) throw new CitizenProposalError("A browser voter ID is required in x-voter-id.");
    return undefined;
  }
  voterHash(value);
  return value;
}

/** Return an explicit allowlist. Internal ownership/idempotency/voter hashes stay on the server. */
export function citizenProposalView(record: CitizenProposalRecord, voterId?: string): CitizenProposalView {
  const counts: Record<AdvisoryChoice, number> = { support: 0, oppose: 0, unsure: 0 };
  for (const choice of Object.values(record.votesByVoterHash)) {
    if (ADVISORY_CHOICES.includes(choice)) counts[choice] += 1;
  }
  return {
    id: record.id,
    title: record.title,
    problem: record.problem,
    proposedChange: record.proposedChange,
    jurisdiction: record.jurisdiction,
    ...(record.jurisdictionName ? { jurisdictionName: record.jurisdictionName } : {}),
    ...(record.supportingInfo ? { supportingInfo: record.supportingInfo } : {}),
    ...(record.sourceEntryId ? { sourceEntryId: record.sourceEntryId } : {}),
    status: "published",
    advisory: true,
    createdAt: record.createdAt,
    publishedAt: record.publishedAt,
    counts,
    countTotal: counts.support + counts.oppose + counts.unsure,
    ownVote: voterId ? record.votesByVoterHash[voterHash(voterId)] ?? null : null,
    comments: (record.comments ?? []).map(({ id, text, displayName, createdAt }) => ({ id, text, displayName, createdAt })),
  };
}

export function publishCitizenProposal(store: CitizenProposalStore, voterId: string, input: unknown) {
  const ownerHash = voterHash(voterId);
  const body = objectBody(input);
  if (body.confirmedPublic !== true) {
    throw new CitizenProposalError("Confirm that this proposal will be public before publishing.");
  }
  if (typeof body.idempotencyKey !== "string" || !uuid.test(body.idempotencyKey)) {
    throw new CitizenProposalError("A stable UUID idempotencyKey is required.");
  }
  const proposal = normalizedInput(body);
  const bodyHash = hash(JSON.stringify(proposal));
  const publishKeyHash = hash(`${ownerHash}:${body.idempotencyKey.toLowerCase()}`);
  const existing = store.citizenProposals?.find((p) => p.publishKeyHash === publishKeyHash);
  if (existing) {
    if (existing.bodyHash !== bodyHash) {
      throw new CitizenProposalError("This draft was already published with different content. Start a new draft for a new proposal.", 409);
    }
    return { record: existing, created: false };
  }
  if (proposal.sourceEntryId && !store.entries.some((entry) => entry.id === proposal.sourceEntryId)) {
    throw new CitizenProposalError("The source journal entry was not found. Choose an existing entry or remove the source link.");
  }
  const now = new Date().toISOString();
  const record: CitizenProposalRecord = {
    ...proposal,
    id: `citizen_${crypto.randomUUID()}`,
    createdAt: now,
    publishedAt: now,
    ownerHash,
    publishKeyHash,
    bodyHash,
    votesByVoterHash: {},
    comments: [],
  };
  (store.citizenProposals ??= []).push(record);
  return { record, created: true };
}

export function findCitizenProposal(store: CitizenProposalStore, id: string) {
  const record = store.citizenProposals?.find((p) => p.id === id);
  if (!record) throw new CitizenProposalError("Proposal not found.", 404);
  return record;
}

export function voteCitizenProposal(store: CitizenProposalStore, id: string, voterId: string, input: unknown) {
  const key = voterHash(voterId);
  const body = objectBody(input);
  if (body.choice !== null && (typeof body.choice !== "string" || !ADVISORY_CHOICES.includes(body.choice as AdvisoryChoice))) {
    throw new CitizenProposalError("choice must be support, oppose, unsure, or null to remove your vote.");
  }
  const record = findCitizenProposal(store, id);
  if (body.choice === null) delete record.votesByVoterHash[key];
  else record.votesByVoterHash[key] = body.choice as AdvisoryChoice;
  return record;
}

export function commentCitizenProposal(store: CitizenProposalStore, id: string, voterId: string, input: unknown) {
  const ownerHash = voterHash(voterId);
  const body = objectBody(input);
  if (typeof body.text !== "string" || !body.text.trim() || body.text.trim().length > 2000) {
    throw new CitizenProposalError("Comment text is required and must be 2000 characters or fewer.");
  }
  if (body.displayName !== undefined && (typeof body.displayName !== "string" || body.displayName.trim().length > 80)) {
    throw new CitizenProposalError("Display name must be text of 80 characters or fewer.");
  }
  if (typeof body.idempotencyKey !== "string" || !uuid.test(body.idempotencyKey)) {
    throw new CitizenProposalError("A stable UUID idempotencyKey is required.");
  }
  const text = body.text.trim();
  const displayName = (typeof body.displayName === "string" ? body.displayName.trim() : "") || "Participant";
  const submitKeyHash = hash(`${ownerHash}:comment:${body.idempotencyKey.toLowerCase()}`);
  const bodyHash = hash(JSON.stringify({ text, displayName }));
  const record = findCitizenProposal(store, id);
  const existing = record.comments?.find((c) => c.submitKeyHash === submitKeyHash);
  if (existing) {
    if (existing.bodyHash !== bodyHash) throw new CitizenProposalError("This comment was already submitted with different text. Start a new comment.", 409);
    return record;
  }
  (record.comments ??= []).push({
    id: `comment_${crypto.randomUUID()}`,
    text,
    displayName,
    createdAt: new Date().toISOString(),
    submitKeyHash,
    bodyHash,
  });
  return record;
}

async function readBody(req: Request) {
  // These small text forms have no reason to accept an unbounded request body.
  const maxBytes = 64 * 1024;
  if (Number(req.headers.get("content-length")) > maxBytes) {
    throw new CitizenProposalError("Proposal request is too large.", 413);
  }
  const reader = req.body?.getReader();
  if (!reader) throw new CitizenProposalError("A JSON object is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new CitizenProposalError("Proposal request is too large.", 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return objectBody(JSON.parse(new TextDecoder().decode(bytes))); }
  catch (error) {
    if (error instanceof CitizenProposalError) throw error;
    throw new CitizenProposalError("A valid JSON object is required.");
  }
}

function json(value: unknown, status = 200) {
  // ownVote is browser-specific; shared caches must not reuse it for another visitor.
  return Response.json(value, { status, headers: { "cache-control": "no-store", vary: "x-voter-id" } });
}

/** Small adapter keeps this feature independent of the sample synthesis/vote engine. */
export function createCitizenProposalHandlers(deps: {
  getStore: () => CitizenProposalStore;
  save: () => Promise<unknown>;
}) {
  let writes: Promise<unknown> = Promise.resolve();
  function serialized<T>(run: () => Promise<T>) {
    const next = writes.then(run, run);
    writes = next.catch(() => {});
    return next;
  }
  async function handle(run: () => unknown | Promise<unknown>) {
    try { return json(await run()); }
    catch (error) {
      if (error instanceof CitizenProposalError) return json({ error: error.message }, error.status);
      console.error("[CITIZEN_PROPOSAL_ERROR]", error);
      return json({ error: "The proposal could not be saved. Please retry; your draft has been kept." }, 500);
    }
  }
  return {
    list: (req: Request) => handle(() => {
      const voter = requestVoter(req, false);
      const proposals = [...(deps.getStore().citizenProposals ?? [])]
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id.localeCompare(a.id))
        .map((p) => citizenProposalView(p, voter));
      return { proposals };
    }),
    detail: (req: Request, id: string) => handle(() => ({
      proposal: citizenProposalView(findCitizenProposal(deps.getStore(), id), requestVoter(req, false)),
    })),
    journal: (_req: Request, id: string) => handle(() => {
      const source = deps.getStore().entries.find((entry) => entry.id === id);
      if (!source) throw new CitizenProposalError("Journal entry not found.", 404);
      return { entry: { id: source.id, text: source.text, author: source.author, createdAt: source.createdAt } };
    }),
    publish: (req: Request) => handle(async () => {
      const voter = requestVoter(req, true)!;
      const body = await readBody(req);
      return serialized(async () => {
        const store = deps.getStore();
        const previous = [...(store.citizenProposals ?? [])];
        const { record, created } = publishCitizenProposal(store, voter, body);
        try { await deps.save(); }
        catch (error) { if (created) store.citizenProposals = previous; throw error; }
        return { proposal: citizenProposalView(record, voter) };
      });
    }),
    vote: (req: Request, id: string) => handle(async () => {
      const voter = requestVoter(req, true)!;
      const body = await readBody(req);
      return serialized(async () => {
        const store = deps.getStore();
        const previous = { ...findCitizenProposal(store, id).votesByVoterHash };
        const record = voteCitizenProposal(store, id, voter, body);
        try { await deps.save(); }
        catch (error) { record.votesByVoterHash = previous; throw error; }
        return { proposal: citizenProposalView(record, voter) };
      });
    }),
    comment: (req: Request, id: string) => handle(async () => {
      const voter = requestVoter(req, true)!;
      const body = await readBody(req);
      return serialized(async () => {
        const store = deps.getStore();
        const previous = [...(findCitizenProposal(store, id).comments ?? [])];
        const record = commentCitizenProposal(store, id, voter, body);
        try { await deps.save(); }
        catch (error) { record.comments = previous; throw error; }
        return { proposal: citizenProposalView(record, voter) };
      });
    }),
  };
}
