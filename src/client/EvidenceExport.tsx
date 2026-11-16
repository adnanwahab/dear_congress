import { useState } from 'react';
import type { DemoItem } from '../engine/demo';
import { evidencePacket, serializeEvidencePacket } from '../shared/evidence-packet';

export function EvidenceExport({ item }: { item: DemoItem }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  function prepare(download: boolean) {
    try {
      const json = serializeEvidencePacket(evidencePacket(item));
      setText(json);
      setStatus('Packet ready. Links checked for safe HTTPS syntax only; source reachability and human review are unverified.');
      if (download) {
        let url: string | undefined;
        try {
          url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
          const anchor = document.createElement('a');
          anchor.href = url; anchor.download = `evidence-${item.id.replace(/[^a-z0-9_-]/gi, '_')}.json`; anchor.click();
        } catch { setStatus('Download unavailable. Copy the packet below, or print this page.'); }
        finally { if (url) { const created = url; setTimeout(() => URL.revokeObjectURL(created), 1000); } }
      }
    } catch { setText(''); setStatus('Packet validation failed. Reload the proposal and try again.'); }
  }
  return <details className="evidence-export"><summary>Evidence packet for {item.title}</summary>
    <p>Public sample snapshot only. Includes dates where recorded, assumptions and review gaps. Excludes journals, votes and source full text. Available offline after the proposal has loaded.</p>
    <button type="button" onClick={() => prepare(true)}>Export evidence JSON</button>{' '}
    <button type="button" onClick={() => prepare(false)}>Show copy / print fallback</button>
    {status && <p role="status">{status}</p>}
    {text && <><label>Evidence JSON<textarea readOnly value={text} rows={12} style={{ width: '100%', boxSizing: 'border-box' }} onFocus={event => event.currentTarget.select()} /></label><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{text}</pre><button type="button" onClick={() => { try { window.print(); } catch { setStatus('Printing unavailable. Select and copy the JSON above.'); } }}>Print packet</button></>}
  </details>;
}
