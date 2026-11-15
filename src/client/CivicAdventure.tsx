import { useEffect, useRef, useState } from 'react';
import { CivicHeader } from './CivicHeader';

export const ADVENTURE_KEY = 'civic_adventure_v1';
export const CHAPTERS = [
  { title: 'Journal', route: '/journal', lesson: 'Start with an everyday experience. A story can help explain a need; you can learn without sharing your own.', sample: 'Fictional journal: “My evening bus often leaves before my shift ends.”' },
  { title: 'Need', route: '/needs', lesson: 'Name the need behind the story. An interpretation can be mistaken; check it against the original words.', sample: 'Fictional interpretation: reliable transport after work. This is a possible reading, not a label assigned to a real person.' },
  { title: 'Comparison', route: '/draft', lesson: 'Compare approaches and their trade-offs before choosing. Ask who benefits, what it costs, and what evidence is missing.', sample: 'Fictional comparison: later buses may serve more shifts but cost more to operate; a small pilot can test demand but serves fewer routes.' },
  { title: 'Proposal', route: '/feed', lesson: 'Turn a need into a reviewable idea. A proposal needs scope, costs and evidence. You can disagree or remain unsure; civic choices here are advisory.', sample: 'Fictional proposal: test one later bus for three months, subject to funding and public review. No vote has been cast.' },
  { title: 'Future', route: '/outcomes', lesson: 'Imagine a future, then ask how to check it. Compare dated measurements with a baseline; missing evidence means unknown, not success.', sample: 'Fictional future: compare missed connections before and after a pilot. No pilot has been implemented and no outcome has been measured.' },
] as const;
type Progress = { step: number; samples: boolean; complete: boolean };
export function readAdventure(storage: Pick<Storage, 'getItem'>): Progress {
  try {
    const p = JSON.parse(storage.getItem(ADVENTURE_KEY) ?? 'null');
    if (p && Number.isInteger(p.step) && p.step >= 0 && p.step < CHAPTERS.length && typeof p.samples === 'boolean' && typeof p.complete === 'boolean') return p;
  } catch {}
  return { step: 0, samples: false, complete: false };
}
export function CivicAdventure() {
  const [progress, setProgress] = useState<Progress>(() => {
    try { return readAdventure(window.localStorage); } catch { return { step: 0, samples: false, complete: false }; }
  });
  const [plain, setPlain] = useState(new URLSearchParams(window.location.search).get('walkthrough') === '1');
  const [storageError, setStorageError] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    try { window.localStorage.setItem(ADVENTURE_KEY, JSON.stringify(progress)); setStorageError(false); }
    catch { setStorageError(true); }
  }, [progress]);
  useEffect(() => { heading.current?.focus(); }, [progress.step, progress.complete, plain]);
  const move = (step: number) => setProgress(p => ({ ...p, step, complete: false }));
  return <div className="product-shell"><CivicHeader stage="Learn" dataLabel="Learning guide" /><main className="civic-adventure panel">
    <h1>Five-minute civic adventure</h1>
    <p>Follow one tiny story from everyday life to a possible future. Take your time: every chapter is skippable.</p>
    <p>Learning only · No votes, public posts or messages are submitted. No name or personal story is needed. Examples are fictional and kept separate from real participation.</p>
    <p><a href="/">Exit to home</a></p>
    <button onClick={() => setPlain(p => !p)}>{plain ? 'Show chapter view' : 'Show non-game walkthrough'}</button>
    <label className="adventure-samples"><input type="checkbox" checked={progress.samples} onChange={e => setProgress(p => ({ ...p, samples: e.target.checked }))} /> Show fictional sample story (optional)</label>
    <p role="status">{storageError ? 'Local saving is unavailable. You can continue on this page; progress may be lost on reload.' : 'Chapter and sample preference saved only in this browser. Return here to resume.'}</p>
    <h2 ref={heading} tabIndex={-1}>{plain ? 'Journal → need → comparison → proposal → future' : progress.complete ? 'You know the path' : `Chapter ${progress.step + 1} of 5 · ${CHAPTERS[progress.step]!.title}`}</h2>
    {!plain && <><progress max={5} value={progress.complete ? 5 : progress.step + 1} aria-label="Current chapter" /><nav aria-label="Adventure chapters">{CHAPTERS.map((c, i) => <button key={c.title} aria-current={!progress.complete && i === progress.step ? 'step' : undefined} onClick={() => move(i)}>{i + 1}. {c.title}</button>)}</nav></>}
    {progress.complete && !plain ? <p>You can trace a story to a need, compare trade-offs, review an idea and ask for evidence of its future. Exploring or skipping is enough. No particular opinion or participation is required.</p> : (plain ? CHAPTERS : [CHAPTERS[progress.step]!]).map(c => <section key={c.title}><h3>{c.title}</h3><p>{c.lesson}</p>{progress.samples && <aside aria-label="Fictional sample"><strong>Fictional sample · not resident data</strong><p>{c.sample}</p></aside>}</section>)}
    {!plain && !progress.complete && <div className="adventure-actions"><button disabled={progress.step === 0} onClick={() => move(progress.step - 1)}>Back</button><button onClick={() => progress.step === 4 ? setProgress(p => ({ ...p, complete: true })) : move(progress.step + 1)}>{progress.step === 4 ? 'Finish learning' : 'Next chapter'}</button><button onClick={() => progress.step === 4 ? setProgress(p => ({ ...p, complete: true })) : move(progress.step + 1)}>Skip chapter</button></div>}
    {(plain || progress.complete) && <p>Explore a stage when you choose. Leaving this guide opens the ordinary site; publishing or saving an advisory choice requires a separate explicit action.</p>}
    {(plain || progress.complete) && <ul>{CHAPTERS.map(c => <li key={c.title}><a href={c.route}>Explore {c.title.toLowerCase()}</a></li>)}</ul>}
    <button onClick={() => { setProgress({ step: 0, samples: false, complete: false }); }}>Restart learning</button>
  </main></div>;
}
