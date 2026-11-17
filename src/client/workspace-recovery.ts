import { readWorkspace, WORKSPACE_KEY, type WorkspaceValues } from './proposal-workspace';

/** Accidental corruption detection, not authentication or tamper protection. */
export function checksum(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}
export function revision(raw: string | null) { return raw === null ? null : checksum(raw); }
export function readRecovery(raw: string | null) {
  const draft = readWorkspace(raw);
  if (draft && raw) {
    const envelope = JSON.parse(raw);
    if (envelope.checksum !== undefined && envelope.checksum !== checksum(JSON.stringify(draft.values))) {
      throw new Error('Draft checksum failed. Saved work has not been overwritten. Export or copy it before recovery.');
    }
  }
  return draft;
}
export interface RecoveryStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export type Exclusive = <T>(name: string, work: () => T | Promise<T>) => Promise<T>;
/** All cooperating tabs lock the same key, then compare the exact envelope, not only its checksum. */
export async function persistWorkspace(storage: RecoveryStorage, exclusive: Exclusive | undefined, expected: string | null, id: string, values: WorkspaceValues) {
  if (!exclusive) throw new Error('Could not save safely in this browser: cross-tab locking is unavailable. Copy the recovery text before leaving.');
  return exclusive(WORKSPACE_KEY, () => {
    const current = storage.getItem(WORKSPACE_KEY);
    readRecovery(current); // Never replace corrupt or unknown envelopes.
    if (current !== expected) return { conflict: true as const, raw: current };
    const raw = JSON.stringify({ version: 1, id, savedAt: new Date().toISOString(), revision: crypto.randomUUID(), checksum: checksum(JSON.stringify(values)), values });
    // Preserve the exact prior revision before replacing it, including explicit conflict resolution.
    if (current !== null) storage.setItem(`${WORKSPACE_KEY}:history:${crypto.randomUUID()}`, current);
    storage.setItem(WORKSPACE_KEY, raw);
    return { conflict: false as const, raw };
  });
}
