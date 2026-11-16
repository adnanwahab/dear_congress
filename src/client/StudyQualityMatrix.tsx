import { useState } from 'react';
import { evidenceExport, sortStudies, STUDY_EVIDENCE, type StudySort } from '../shared/study-evidence';
import './study-quality.css';
const columns: readonly [StudySort, string][] = [['case', 'Case'], ['kind', 'Claim kind'], ['design', 'Study design'], ['sample', 'Sample'], ['jurisdiction', 'Jurisdiction'], ['outcome', 'Outcome'], ['date', 'Claim / publication date'], ['limitations', 'Limitations'], ['conflicts', 'Conflict disclosures']];
export function StudyQualityMatrix() {
  const [sort, setSort] = useState<StudySort>('case');
  const [descending, setDescending] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [notice, setNotice] = useState('');
  const rows = sortStudies(STUDY_EVIDENCE, sort, descending);
  function download() {
    setShowExport(true);
    try {
      const url = URL.createObjectURL(new Blob([evidenceExport(rows)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'study-evidence-v1.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Export prepared. Copyable JSON is also available below.');
    } catch { setNotice('Download unavailable. Copy the JSON below.'); }
  }
  return <section className="study-quality" aria-labelledby="study-quality-title" id="study-quality">
    <h3 id="study-quality-title">Study-quality matrix</h3>
    <p>Reviewer criteria: inspect design and comparator, sample and selection, jurisdiction applicability, dated outcomes and uncertainty, limitations, and funding/conflicts. No composite quality or political viewpoint score. All entries await human review.</p>
    <p>Read-only examples bundled with this page: no separate loading request. Available offline once loaded; external source links need connectivity. Missing sources remain unknown. This matrix does not establish evidence for a selected proposal.</p>
    <div className="study-controls"><button type="button" onClick={download}>Export evidence JSON</button><button type="button" onClick={() => { try { window.print(); } catch { setNotice('Printing unavailable. Use the table or copyable export.'); setShowExport(true); } }}>Print matrix</button></div>
    <p role="status">{notice}</p>
    <div className="study-scroll" tabIndex={0} role="region" aria-label="Study evidence table, scroll horizontally for all columns">
      <table><caption>Evidence examples · revision evidence-v1 · pending human review. Select a column to sort; select again to reverse.</caption><thead><tr>{columns.map(([key, label]) => <th key={key} scope="col" aria-sort={sort === key ? descending ? 'descending' : 'ascending' : 'none'}><button type="button" onClick={() => { setSort(key); setDescending(sort === key ? !descending : false); }}>{label}</button></th>)}<th scope="col">Source and review history</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.id}>{columns.map(([key]) => key === 'case' ? <th scope="row" key={key}>{row[key]}</th> : <td key={key}>{row[key]}</td>)}<td>{row.source ? <><a href={row.source.url} target="_blank" rel="noopener noreferrer">{row.source.title}</a><p>{row.source.locator}</p></> : <p>No external source supplied</p>}{row.history.map(h => <p key={h.revision}>{h.revision} · {h.date} · {h.actor} · {h.reason} · {h.review} · reviewer: none</p>)}</td></tr>)}</tbody></table>
    </div>
    {showExport && <label>Copyable evidence JSON<textarea readOnly rows={12} value={evidenceExport(rows)} /></label>}
  </section>;
}
