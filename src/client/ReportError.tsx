import { useEffect, useState } from 'react';
import { reportRevision, reportUrl } from '../shared/error-reports';
export function ReportError({ kind, id, snapshot, revision }: { kind: string; id: string; snapshot?: string; revision?: string }) {
  const [hash, setHash] = useState(revision ?? '');
  useEffect(() => { let active = true; setHash(revision ?? ''); if (!revision && snapshot) void reportRevision(snapshot).then(h => { if (active) setHash(h); }).catch(() => {}); return () => { active = false; }; }, [revision, snapshot]);
  return hash ? <p>{kind === 'sample-source' ? 'Background source: ' : kind === 'sample' ? 'Sample proposal: ' : ''}<a href={reportUrl({ kind, id, revision: hash })} aria-label={`Report an error on ${kind} ${id}`}>Report an error</a></p> : null;
}
