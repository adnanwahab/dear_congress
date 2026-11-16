import { useRef, useState } from 'react';
import { acceptImport, IMPORT_EXAMPLES, CLAIM_KINDS, EMPTY_IMPORT, validateImport, type ImportDraft, type ReviewPacket } from '../shared/dataset-import';
import './dataset-import.css';

export function DatasetImportWorkbench() {
  const [draft, setDraft] = useState<ImportDraft>(EMPTY_IMPORT);
  const [reviewer, setReviewer] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [history, setHistory] = useState<ReviewPacket[]>([]);
  const [accepted, setAccepted] = useState<ReviewPacket | null>(null);
  const [status, setStatus] = useState('Draft only. Nothing is published.');
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  function change(patch: Partial<ImportDraft>) {
    generation.current++; setLoading(false); setDraft(d => ({ ...d, ...patch })); setAccepted(null); setConfirmed(false);
    setStatus('Draft changed. Source checks and human review must be repeated.');
  }
  const validation = validateImport(draft);
  async function load(file?: File) {
    if (!file) return;
    const token = ++generation.current; setLoading(true); setAccepted(null); setConfirmed(false);
    setStatus('Reading local CSV…');
    try {
      if (file.size > 100_000) throw new Error('File exceeds 100,000 bytes.');
      const csv = await file.text();
      if (token === generation.current) { change({ csv }); setStatus('CSV loaded locally. Review schema, mapping and validation.'); }
    } catch (e) { if (token === generation.current) setStatus(`File unavailable: ${(e as Error).message} Paste CSV below to retry.`); }
    finally { if (token === generation.current) setLoading(false); }
  }
  function accept() {
    try {
      const packet = acceptImport(draft, reviewer, confirmed);
      setHistory(h => [...h, packet]); setAccepted(packet); setStatus('Locally accepted for this exact draft. Reviewer identity is self-reported; publication remains unavailable.');
    } catch (e) { setStatus((e as Error).message); }
  }
  const report = JSON.stringify({ schema: 'civic-dataset-workbench.v1', draft, validation: validation.errors, accepted, history,
    notice: 'Local self-reported review only. No publication authority. Earlier packets are historical; edits require new review.' }, null, 2);
  function download() {
    try {
      const url = URL.createObjectURL(new Blob([report], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'dataset-review.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setStatus('Download unavailable. Copy the complete review text below or use browser Print.'); }
  }
  return <section className="panel dataset-import" aria-labelledby="dataset-import-title">
    <h2 id="dataset-import-title">Public dataset import workbench</h2>
    <p>Stage aggregate public CSV data for a civic metric. Local files and pasted data work offline. Nothing is fetched, saved to the server, published or fed into synthesis. Drafts and review history are lost on reload; export to retain them.</p>
    <details><summary>Prepare and review an official feed</summary>
      <p>Primary source: an original agency record. Editorial inference: an interpretation or calculation. User claim: an assertion awaiting evidence. Synthetic estimate: invented or modeled data. Only primary sources are eligible here; an agency-looking URL alone does not verify a claim.</p>
      <p>Examples are unpublished review exercises. The sourced specimen has citations but has not been independently verified here. Loading an example replaces the current draft.</p>
      {Object.entries(IMPORT_EXAMPLES).map(([name, example]) => <button type="button" key={name} onClick={() => change(structuredClone(example))}>Load {name.toLowerCase()}</button>)}
      <label>CSV file<input type="file" accept=".csv,text/csv" onChange={e => { void load(e.target.files?.[0]); e.target.value = ''; }} /></label>
      <label>CSV text<textarea rows={6} value={draft.csv} maxLength={100000} onChange={e => change({ csv: e.target.value })} /></label>
      <p role="status" aria-live="polite">{status}</p>
      <fieldset disabled={loading}><legend>Metric contract and source metadata</legend>
        {(['metric', 'expectedUnit', 'expectedScope', 'publisher', 'source', 'version', 'license', 'licenseUrl', 'retrieved', 'limitations'] as const).map(key => <label key={key}>
          {{ metric: 'Civic metric identifier', expectedUnit: 'Required unit', expectedScope: 'Required geography and population scope', publisher: 'Agency publisher', source: 'Exact source URL (HTTPS)', version: 'Dataset release / revision and query', license: 'License / reuse terms', licenseUrl: 'License terms URL (HTTPS)', retrieved: 'Retrieved date (YYYY-MM-DD)', limitations: 'Limitations, uncertainty and exclusions' }[key]}
          <input value={draft[key]} onChange={e => change({ [key]: e.target.value })} />
        </label>)}
        <label>Claim provenance<select value={draft.kind} onChange={e => change({ kind: e.target.value as ImportDraft['kind'] })}>{CLAIM_KINDS.map(k => <option key={k}>{k}</option>)}</select></label>
      </fieldset>
      <fieldset disabled={loading}><legend>Map CSV columns</legend>
        {(['value', 'period', 'unit', 'scope'] as const).map(key => <label key={key}>{key} column<select value={draft.mapping[key]} onChange={e => change({ mapping: { ...draft.mapping, [key]: e.target.value } })}><option value="">Select column</option>{(validation.rows[0] ?? []).map(h => <option key={h}>{h}</option>)}</select></label>)}
      </fieldset>
      <h3>Schema and preview</h3>
      <p>{Math.max(0, validation.rows.length - 1)} observations. Values must be finite numbers; periods use YYYY-MM-DD. Showing the first five rows; validation covers all rows.</p>
      {validation.rows.length > 0 && <div className="dataset-table"><table><caption>Raw CSV preview (unpublished)</caption><thead><tr>{validation.rows[0]!.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{validation.rows.slice(1, 6).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>}
      <h3>Validation</h3>
      {validation.errors.length ? <ul>{validation.errors.map((e, i) => <li key={i}>{e}</li>)}</ul> : <p>Structural checks pass. A person must still verify provenance, reuse permission, units and scope against the original record.</p>}
      <label>Reviewer name (self-reported)<input value={reviewer} onChange={e => { setReviewer(e.target.value); setConfirmed(false); setAccepted(null); }} /></label>
      <label><input type="checkbox" checked={confirmed} onChange={e => { setConfirmed(e.target.checked); setAccepted(null); }} />I inspected the exact source release, license permission, mapped units, population scope, dates and limitations.</label>
      <button type="button" disabled={loading || !!validation.errors.length || !reviewer.trim() || !confirmed || !!accepted} onClick={accept}>Accept this local revision</button>
      <p>{accepted ? `Locally accepted by ${accepted.reviewer} at ${accepted.reviewedAt}. Unpublished.` : 'Awaiting valid data and human review. Unpublished.'}</p>
      <p>{history.length} retained local review records. A material edit invalidates current acceptance and preserves earlier review packets in export.</p>
      <button type="button" onClick={download}>Export review JSON</button>
      <details><summary>Copy or print complete review packet</summary><p>Use browser Print or copy this text if downloads are unavailable. No network is required.</p><textarea className="dataset-report-editor" readOnly aria-label="Complete review packet" rows={12} value={report} /></details>
    </details>
    <pre className="dataset-print-report">{report}</pre>
  </section>;
}
