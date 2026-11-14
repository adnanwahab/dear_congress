import { MutationError, type MutationState } from './mutation-status';
export type VoteDraft = { proposalId: string; title: string; stance: number };
type Stored = { draft: VoteDraft; confirmed: boolean };
const KEY = 'civic_advisory_receipt_v1';
export type VoteRequest = <T>(path: string, body?: unknown, method?: string, signal?: AbortSignal) => Promise<T>;
/** Only explicit advisory upserts belong here; never use this retry path for creation. */
export function advisoryMutation(request: VoteRequest, storage: Pick<Storage, 'getItem' | 'setItem'>, notify: (state: MutationState) => void, timeoutMs = 15000) {
  let locked = false;
  let stored: Stored | undefined;
  let retryAt = 0;
  let state: MutationState = { phase: 'idle', message: '' };
  const emit = (next: MutationState) => { state = next; notify(next); };
  const persist = () => { try { storage.setItem(KEY, JSON.stringify(stored)); return true; } catch { return false; } };
  const receipt = () => `Server confirmed advisory choice for ${stored!.draft.title} (${stored!.draft.proposalId}): ${stored!.draft.stance === 1 ? 'Support' : stored!.draft.stance === -1 ? 'Oppose' : 'Not sure'}. Non-binding.`;
  try {
    const value = JSON.parse(storage.getItem(KEY) ?? 'null');
    if (value && typeof value.confirmed === 'boolean' && typeof value.draft?.proposalId === 'string' && typeof value.draft?.title === 'string' && [-1, 0, 1].includes(value.draft?.stance)) {
      stored = value;
      state = { phase: value.confirmed ? 'confirmed' : 'failed', message: value.confirmed ? receipt() + ' Previous server acknowledgement; current choice may have changed.' : 'A previous advisory choice was interrupted. We could not confirm whether it was saved. Retry the exact choice below.' };
    }
  } catch {}
  async function submit(draft?: VoteDraft) {
    if (locked) return false;
    if (Date.now() < retryAt) { emit({ phase: 'failed', message: `Please wait until ${new Date(retryAt).toLocaleTimeString()} before retrying. We could not confirm whether your choice was saved.` }); return false; }
    if (draft) stored = { draft: { ...draft }, confirmed: false };
    if (!stored) return false;
    locked = true;
    const recoverable = persist();
    emit({ phase: 'submitting', message: `Saving advisory choice for ${stored.draft.title}…${recoverable ? '' : ' Browser recovery unavailable; keep this page open.'}` });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const result = await request<{ ok?: boolean }>('/api/votes', { votes: [{ proposalId: stored.draft.proposalId, stance: stored.draft.stance, importance: .5, acceptCompromise: true, concern: '', changeMind: '' }] }, 'POST', controller.signal);
      if (result.ok !== true) throw new Error('Missing server acknowledgement');
      stored.confirmed = true;
      const saved = persist();
      retryAt = 0;
      emit({ phase: 'confirmed', message: receipt() + (saved ? '' : ' Receipt recovery unavailable after reload.') });
      return true;
    } catch (error) {
      if (error instanceof MutationError && error.status === 429) {
        const header = error.retryAfter;
        const seconds = header && /^\d+$/.test(header) ? Number(header) * 1000 : NaN;
        retryAt = Number.isFinite(seconds) ? Date.now() + seconds : Math.max(Date.now(), Date.parse(header ?? '') || Date.now() + 60000);
      }
      emit({ phase: 'failed', message: `We could not confirm whether your advisory choice for ${stored.draft.title} was saved.${retryAt > Date.now() ? ` Too many requests; wait until ${new Date(retryAt).toLocaleTimeString()} before retrying.` : ' Retry sends the same choice to the same proposal.'}${recoverable ? '' : ' Browser recovery unavailable; keep this page open.'}` });
      return false;
    } finally { clearTimeout(timer); locked = false; }
  }
  return { submit, get state() { return state; }, get pending() { return locked; } };
}
