import { WORKSPACE_FIELDS, readWorkspace } from './proposal-workspace';
const encode = (bytes: Uint8Array) => btoa(Array.from(bytes, b => String.fromCharCode(b)).join('')).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const decode = (value: string) => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
const aad = new TextEncoder().encode('adnanwahab/dear_congress:private-workspace:v1');
export async function encryptWorkspace(raw: string) {
  const draft = readWorkspace(raw);
  if (!draft) throw new Error('Save a guided proposal workspace first.');
  // Explicit schema projection excludes unrelated browser records and unknown fields.
  const text = JSON.stringify({ version: 1, id: draft.id, savedAt: draft.savedAt, values: { jurisdiction: draft.values.jurisdiction, ...Object.fromEntries(Object.keys(WORKSPACE_FIELDS).map(field => [field, draft.values[field as keyof typeof WORKSPACE_FIELDS]])) } });
  if (new TextEncoder().encode(text).length > 44000) throw new Error('Draft too large for handoff. Keep the original and use a private manual copy.');
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, new TextEncoder().encode(text));
  return { ciphertext: encode(new Uint8Array(ciphertext)), iv: encode(iv), key: encode(new Uint8Array(await crypto.subtle.exportKey('raw', key))) };
}
export async function decryptWorkspace(ciphertext: string, iv: string, secret: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(secret) || !/^[A-Za-z0-9_-]{16}$/.test(iv) || ciphertext.length > 60000) throw new Error('Invalid encrypted handoff.');
  const key = await crypto.subtle.importKey('raw', decode(secret), 'AES-GCM', false, ['decrypt']);
  const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv), additionalData: aad }, key, decode(ciphertext));
  const raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (!readWorkspace(raw)) throw new Error('Invalid workspace.');
  return raw;
}
export async function handoffRequest(body: Record<string, unknown>) {
  const response = await fetch('/api/draft-handoff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Handoff unavailable. Keep your original draft.');
  return result;
}
