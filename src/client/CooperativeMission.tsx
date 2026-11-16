import { useEffect, useState, type FormEvent } from 'react';
import { applyMission, exportMission, missionKey, missionProgress, MISSION_ROLES, readMission, type Mission, type MissionAction, type MissionRole, type MissionSource } from '../shared/cooperative-missions';
import './cooperative-mission.css';

export function CooperativeMission({ source }: { source: MissionSource }) {
  const [mission, setMission] = useState<Mission | null>(null);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [actor, setActor] = useState('Facilitator');
  const [status, setStatus] = useState('');
  const [draft, setDraft] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<MissionRole | ''>('');
  const [permission, setPermission] = useState<'editor' | 'observer'>('editor');
  const [finding, setFinding] = useState('');
  const [citation, setCitation] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [limitation, setLimitation] = useState('');
  const [question, setQuestion] = useState('');
  const [resolution, setResolution] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  useEffect(() => {
    setMission(null); setError(''); setBlocked(false);
    try {
      const raw = localStorage.getItem(missionKey(source));
      const loaded = readMission(raw, source);
      setSaved(raw); setMission(loaded); setDraft(loaded.draft);
    } catch (err) { setError((err as Error).message); setBlocked(true); }
  }, [source.kind, source.id, source.title, source.text, attempt]);
  function change(action: MissionAction): boolean {
    if (!mission || blocked) return false;
    try {
      if (localStorage.getItem(missionKey(source)) !== saved) {
        setBlocked(true); throw new Error('Another tab changed this workshop. Copy your unsaved text, then reload the saved workshop.');
      }
      const next = applyMission(mission, { actor, at: new Date().toISOString(), action });
      const raw = JSON.stringify(next);
      localStorage.setItem(missionKey(source), raw);
      setMission(next); setSaved(raw); setError(''); setStatus('Workshop change saved only in this browser.'); return true;
    } catch (err) { setError(`${(err as Error).message} Your form text remains here.`); return false; }
  }
  function submit(event: FormEvent, action: MissionAction, clear: () => void) { event.preventDefault(); if (change(action)) clear(); }
  function download() {
    if (!mission) return;
    try {
      const url = URL.createObjectURL(new Blob([exportMission(mission)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'cooperative-workshop-log.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); setStatus('Export contains saved draft, names, citations, questions and the full collaboration log. Share only with group consent.');
    } catch { setError('Download failed. Copy the saved collaboration log below.'); }
  }
  const editor = mission?.members.find(m => m.name === actor)?.permission === 'editor';
  const progress = mission ? missionProgress(mission) : [];
  return <section className="cooperative-mission panel cp-panel" aria-label="Cooperative policy-design mission">
    <h2>Design together</h2>
    <p>Optional same-device group workshop · {source.kind === 'sample' ? 'Fictional sample source' : 'Citizen-authored source, unverified'}. Your group edits a separate shared draft; the original proposal stays attached.</p>
    <p>Pass this device between up to six participants. No remote sharing or authenticated access control. Names and permissions are self-declared workshop agreements; anyone using this browser profile can read storage or select another name. Avoid sensitive information.</p>
    <p>Nothing is published, sent to an official, or counted as a political vote. Exporting includes participant names and contribution text: obtain everyone’s consent before sharing.</p>
    {!mission && !error && <p role="status">Loading saved workshop…</p>}
    {error && <p role="alert">{error}</p>}
    {blocked && <button type="button" onClick={() => setAttempt(n => n + 1)}>Reload saved workshop</button>}
    {mission && <>
      <details><summary>Source snapshot and group permissions</summary><h3>{mission.source.title}</h3><p className="mission-text">{mission.source.text}</p><p>Source: {source.kind}:{source.id}. Source changes block reopening this workshop. Facilitator assigns roles and permissions; editors contribute, edit and resolve questions; observers read and export.</p><ul>{mission.members.map(m => <li key={m.name}>{m.name} — {m.permission} · {m.role || 'No assigned role (optional)'}</li>)}</ul></details>
      <label>Current participant<select value={actor} onChange={e => setActor(e.target.value)}>{mission.members.map(m => <option key={m.name}>{m.name}</option>)}</select></label>
      <fieldset disabled={blocked || actor !== 'Facilitator'}><legend>Assign optional roles and permissions</legend><form onSubmit={e => submit(e, { type: 'member', member: { name: name.trim(), role, permission } }, () => setName(''))}>
        <label>Participant name<input required maxLength={60} value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Optional role<select value={role} onChange={e => setRole(e.target.value as MissionRole | '')}><option value="">No assigned role</option>{MISSION_ROLES.map(r => <option key={r}>{r}</option>)}</select></label>
        <label>Workshop permission<select value={permission} onChange={e => setPermission(e.target.value as 'editor' | 'observer')}><option value="editor">editor</option><option value="observer">observer</option></select></label>
        <button>Add or update participant</button><p>Use the same name to update an existing participant. Roles are optional and may be shared.</p>
      </form></fieldset>
      <h3>Shared progress: {progress.length} of 4 evidence perspectives</h3>
      <progress max={4} value={progress.length} aria-label="Evidence perspectives documented" />
      <ul>{MISSION_ROLES.map(r => <li key={r}>{r}: {progress.includes(r) ? 'Peer-reviewed evidence note' : 'Open for investigation'}</li>)}</ul>
      <p>Each role advances once when a different editor reviews a cited finding, its reasoning and limitations as ready. Review source relevance and credibility, whether the finding supports the draft, and whether trade-offs are clear. More posts, popularity and political votes earn no additional progress. Saving a draft revision resets progress until evidence is reviewed again for that revision. These are self-declared human reviews, not verified evidence or consensus.</p>
      <fieldset disabled={!editor || blocked}><legend>Contribute as {actor}</legend>
        <form onSubmit={e => submit(e, { type: 'draft', text: draft }, () => {})}><label>Shared workshop draft<textarea rows={6} maxLength={20000} value={draft} onChange={e => setDraft(e.target.value)} /></label><button>Save shared draft revision</button></form>
        <form onSubmit={e => submit(e, { type: 'contribution', contribution: { member: actor, role: mission.members.find(m => m.name === actor)!.role, finding, citation, reasoning, limitation } }, () => { setFinding(''); setCitation(''); setReasoning(''); setLimitation(''); })}>
          <label>Finding<textarea required maxLength={10000} value={finding} onChange={e => setFinding(e.target.value)} /></label>
          <label>Citation URL (HTTP or HTTPS, unverified)<input required type="url" maxLength={2000} value={citation} onChange={e => setCitation(e.target.value)} /></label>
          <label>How this evidence supports the proposal<textarea required maxLength={10000} value={reasoning} onChange={e => setReasoning(e.target.value)} /></label>
          <label>Limitation, uncertainty or trade-off<textarea required maxLength={10000} value={limitation} onChange={e => setLimitation(e.target.value)} /></label><button>Record evidence contribution</button>
        </form>
        <form onSubmit={e => submit(e, { type: 'question', text: question }, () => setQuestion(''))}><label>New unresolved question<textarea required maxLength={2000} value={question} onChange={e => setQuestion(e.target.value)} /></label><button>Add question</button></form>
        <label>Reason for resolving a question<textarea maxLength={2000} value={resolution} onChange={e => setResolution(e.target.value)} /></label>
      </fieldset>
      <h3>Questions · {mission.questions.filter(q => !q.resolution).length} unresolved</h3>
      {mission.questions.length ? <ol>{mission.questions.map((q, index) => <li key={index}><p>{q.text}</p>{q.resolution ? <p>Resolved with reason: {q.resolution}</p> : <><b>Unresolved</b> <button type="button" disabled={!editor || blocked || !resolution.trim()} onClick={() => { if (change({ type: 'resolve', question: index, reason: resolution })) setResolution(''); }}>Resolve question {index + 1} with reason</button></>}</li>)}</ol> : <p>No questions recorded. This does not mean the proposal has no unresolved issues.</p>}
      <label>Evidence review reason (source relevance, reasoning and limitations)<textarea maxLength={2000} value={reviewReason} onChange={e => setReviewReason(e.target.value)} /></label>
      <h3>Evidence contributions</h3>{mission.contributions.map((c, i) => <article key={i}><b>{c.member} · {c.role || 'General contribution'}</b><p>{c.finding}</p><p>Citation (not fetched or verified): {c.citation}</p><p>Reasoning: {c.reasoning}</p><p>Limitation: {c.limitation}</p><p>Latest review: {(() => { const review = mission.log.slice(mission.log.findLastIndex(e => e.action.type === 'draft') + 1).filter(e => e.action.type === 'review' && e.action.contribution === i).at(-1); return review?.action.type === 'review' ? `${review.action.ready ? 'Ready' : 'Needs work'} — ${review.actor}: ${review.action.reason}` : 'Awaiting a different editor'; })()}</p>{[true, false].map(ready => <button key={String(ready)} type="button" disabled={blocked || !editor || actor === c.member || !reviewReason.trim()} onClick={() => { if (change({ type: 'review', contribution: i, ready, reason: reviewReason })) setReviewReason(''); }}>{ready ? 'Mark evidence ready' : 'Request evidence improvement'} · contribution {i + 1}</button>)}</article>)}
      <button type="button" onClick={download}>Export collaboration log (JSON)</button>
      <details><summary>Saved collaboration log · {mission.log.length} changes</summary><label>Copy saved workshop JSON<textarea readOnly rows={12} value={exportMission(mission)} /></label></details>
      <p>Storage is unencrypted, editable and not a tamper-proof audit trail. Unsaved form text is lost on leaving. Save revisions and contributions before passing the device. Copy text before reloading after a conflict.</p>
      <p role="status">{status}</p>
    </>}
  </section>;
}
