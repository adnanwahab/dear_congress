import { useEffect, useRef, useState } from 'react';
import { createLayoutSnapshot, exhibitRows, EXHIBIT_NOTICE, EXHIBIT_SOURCE } from './layout-snapshot';

export function LayoutSnapshotExport() {
  const [size, setSize] = useState<'phone' | 'wide'>('phone');
  const [files, setFiles] = useState<{ name: string; url: string }[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const urls = useRef<string[]>([]);
  const generation = useRef(0);
  const release = () => { urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current = []; };
  useEffect(() => () => { generation.current++; release(); }, []);
  const prepare = async () => {
    const current = ++generation.current;
    release(); setFiles([]); setBusy(true); setStatus('Preparing sample exhibit…');
    const created: string[] = [];
    try {
      const snapshot = await createLayoutSnapshot(size);
      if (generation.current !== current) return;
      const downloads = ([['svg', 'image/svg+xml'], ['html', 'text/html'], ['json', 'application/json']] as const).map(([ext, type]) => {
        const url = URL.createObjectURL(new Blob([snapshot[ext]], { type })); created.push(url);
        return { name: `civic-sample-${size}-v1.${ext}`, url };
      });
      urls.current = created; setFiles(downloads); setStatus('Ready: download the image, HTML description and manifest together.');
    } catch {
      created.forEach(url => URL.revokeObjectURL(url));
      if (generation.current === current) setStatus('Download unavailable. Use the sample description below: copy it or print this section from your browser.');
    } finally { if (generation.current === current) setBusy(false); }
  };
  return <section id="exhibit-export" className="panel layout-snapshot" aria-labelledby="exhibit-export-title">
    <h2 id="exhibit-export-title">Export a public educational exhibit</h2>
    <p>{EXHIBIT_NOTICE}</p>
    <p>Exports contain only the built-in public catalog. Journals, drafts, browser choices and account details are excluded. The image and description use the same information at every size, with fixed seed 42 and no animation.</p>
    <label>Image layout <select value={size} disabled={busy} onChange={e => { setSize(e.target.value as 'phone' | 'wide'); release(); setFiles([]); setStatus('Layout changed. Prepare a new export.'); }}><option value="phone">Phone — 390 pixels</option><option value="wide">Wide — 960 pixels</option></select></label>{' '}
    <button type="button" disabled={busy} onClick={prepare}>Prepare sample export</button>
    <p role="status">{status}</p>
    {files.length > 0 && <ul>{files.map(file => <li key={file.name}><a href={file.url} download={file.name}>Download {file.name}</a></li>)}</ul>}
    <details><summary>Sample description and download fallback</summary>
      <p>If downloads are blocked, copy the text below or use browser Print. This fallback is a description, without a version manifest; use the downloaded HTML and JSON for a versioned exhibit.</p>
      <p><a href={EXHIBIT_SOURCE}>Public catalog source</a></p>
      <ul>{exhibitRows().map(row => <li key={row.id}><strong>{row.label}</strong> ({row.id})<p>Goal: {row.goal}<br />Metric: {row.metric}<br />Scope: {row.level}</p></li>)}</ul>
    </details>
  </section>;
}
