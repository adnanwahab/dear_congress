import './draft-handoff.css';
import { useState } from 'react';
import { decryptWorkspace, encryptWorkspace, handoffRequest } from './draft-handoff';
import { readWorkspace, WORKSPACE_KEY, workspaceOutline } from './proposal-workspace';

export function DraftHandoff() {
  const [id, setId] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.hash.slice(1)).get('handoff') ?? '');
  const [secret, setSecret] = useState('');
  const [sent, setSent] = useState<{ id: string; revoke: string; key: string; expiresAt: number } | null>(null);
  const [received, setReceived] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  async function run(action: () => Promise<void>) {
    setBusy(true);
    try { await action(); } catch (error) { setStatus(error instanceof Error ? error.message : 'Handoff unavailable. Keep your original draft.'); }
    finally { setBusy(false); }
  }
  return <section className="panel" id="draft-handoff" aria-labelledby="handoff-title">
    <h2 id="handoff-title">Private draft handoff</h2>
    <p>Transfer only your saved <a href="/proposals/new?guided=1">guided proposal workspace</a>. Save edits there first. Nothing is published; the original stays on this device. Other journals, amendments and ballots are excluded.</p>
    <p>The service holds encrypted text for up to 15 minutes, until one opening, revocation or restart. Send the link and key through separate trusted channels. Anyone with both can read it. Revocation cannot erase a copy already opened. This page and its keys are visible to anyone using your browser.</p>
    <button disabled={busy || !!sent} onClick={() => void run(async () => {
      const raw = localStorage.getItem(WORKSPACE_KEY);
      if (!raw) throw new Error('Save a guided proposal workspace first.');
      const encrypted = await encryptWorkspace(raw);
      const result = await handoffRequest({ action: 'create', ciphertext: encrypted.ciphertext, iv: encrypted.iv });
      setSent({ ...result, key: encrypted.key }); setStatus('Encrypted handoff created. Copy the link and key separately.');
    })}>Create encrypted handoff</button>
    {sent && <>
      <p>Expires {new Date(sent.expiresAt).toLocaleString()}. Keep this page open to revoke. Closing it loses these handoff controls; the relay still expires.</p>
      <label className="cp-field">Handoff link — send first<input readOnly value={`${window.location.origin}/account#handoff=${sent.id}`} /></label>
      <label className="cp-field">Decryption key — send separately<input readOnly value={sent.key} /></label>
      <button disabled={busy} onClick={() => void run(async () => { await handoffRequest({ action: 'revoke', id: sent.id, revoke: sent.revoke }); setSent(null); setStatus('Handoff revoked. Original draft retained.'); })}>Revoke handoff</button>
    </>}
    <h3>Open once on this device</h3>
    <p>Opening consumes the handoff even if the key is wrong or the connection fails. Keep this page open after opening and copy or save the received draft before leaving. Ask the sender to create another handoff if needed.</p>
    <label className="cp-field">Handoff ID (from the link)<input value={id} onChange={e => setId(e.target.value)} autoComplete="off" spellCheck={false} /></label>
    <label className="cp-field">Separate decryption key<input type="password" value={secret} onChange={e => setSecret(e.target.value)} autoComplete="off" spellCheck={false} /></label>
    <button disabled={busy || !!received || !/^[A-Za-z0-9_-]{43}$/.test(id) || !/^[A-Za-z0-9_-]{43}$/.test(secret)} onClick={() => void run(async () => {
      const encrypted = await handoffRequest({ action: 'claim', id });
      try { setReceived(await decryptWorkspace(encrypted.ciphertext, encrypted.iv, secret)); setSecret(''); setStatus('Decrypted privately. Review below; nothing saved or published.'); }
      catch { throw new Error('Could not decrypt. Check the separate key and ask the sender for a new handoff. Original drafts remain unchanged.'); }
    })}>Open encrypted handoff once</button>
    {received && <>
      <label className="cp-field">Received private draft — review or copy<textarea rows={14} readOnly value={workspaceOutline(readWorkspace(received)!.values)} /></label>
      <button disabled={busy} onClick={() => void run(async () => {
        if (localStorage.getItem(WORKSPACE_KEY) !== null) throw new Error('This device already has a workspace. It was not overwritten. Copy the received text above and reconcile manually.');
        localStorage.setItem(WORKSPACE_KEY, received);
        setStatus('Saved privately on this device. Open the guided workspace to continue. Nothing published.');
      })}>Save received draft if workspace is empty</button>
      <p><a href="/proposals/new?guided=1">Continue in guided workspace</a></p>
    </>}
    <p role="status" aria-live="polite">{status}</p>
    <p>Fallback: if encryption, network or browser storage is unavailable, keep the original page open and copy the draft manually through a trusted private channel. Do not use public Journal publishing as a transfer. No automatic retries or background polling occur.</p>
  </section>;
}
