import { useEffect, useRef, useState } from 'react';
import './vision-board.css';

type Stage = 'dream' | 'working' | 'achieved';
type Tone = 'peach' | 'sage' | 'lavender' | 'sky';
type Step = { id: string; text: string; done: boolean };
export type VisionCard = { id: string; title: string; description: string; stage: Stage; tone: Tone; steps: Step[] };
const STORAGE = 'civic-vision-board.v1';
const LIMIT = 40;
const STAGES: { value: Stage; label: string }[] = [{ value: 'dream', label: 'Dreaming' }, { value: 'working', label: 'Working on it' }, { value: 'achieved', label: 'Achieved' }];
const TONES: Tone[] = ['peach', 'sage', 'lavender', 'sky'];
/** Reject malformed or oversized storage rather than silently converting it into user content. */
export function decodeVisionBoard(raw: string | null): VisionCard[] {
  if (!raw) return [];
  if (raw.length > 180000) throw new Error('Saved board exceeds the supported size.');
  const data = JSON.parse(raw);
  if (data?.version !== 1 || !Array.isArray(data.cards) || data.cards.length > LIMIT) throw new Error('Saved board has an unsupported format.');
  const ids = new Set<string>();
  return data.cards.map((card: unknown) => {
    if (!card || typeof card !== 'object') throw new Error('Invalid saved card.');
    const c = card as Record<string, unknown>;
    if (typeof c.id !== 'string' || !c.id || c.id.length > 100 || ids.has(c.id) || typeof c.title !== 'string' || !c.title.trim() || c.title.length > 120 || typeof c.description !== 'string' || c.description.length > 1200 || !STAGES.some(s => s.value === c.stage) || !TONES.includes(c.tone as Tone) || !Array.isArray(c.steps) || c.steps.length > 8) throw new Error('Invalid saved card.');
    ids.add(c.id);
    const stepIds = new Set<string>();
    const steps = c.steps.map((step: unknown) => {
      if (!step || typeof step !== 'object') throw new Error('Invalid saved step.');
      const s = step as Record<string, unknown>;
      if (typeof s.id !== 'string' || !s.id || s.id.length > 100 || stepIds.has(s.id) || typeof s.text !== 'string' || !s.text.trim() || s.text.length > 180 || typeof s.done !== 'boolean') throw new Error('Invalid saved step.');
      stepIds.add(s.id);
      return { id: s.id, text: s.text, done: s.done };
    });
    return { id: c.id, title: c.title, description: c.description, stage: c.stage as Stage, tone: c.tone as Tone, steps };
  });
}
function initialBoard() {
  try { return { cards: decodeVisionBoard(localStorage.getItem(STORAGE)), warning: '' }; }
  catch { return { cards: [] as VisionCard[], warning: 'Your saved board could not be loaded. Existing browser data has not been changed. New changes will replace it.' }; }
}
export default function VisionBoard() {
  const [initial] = useState(initialBoard);
  const [cards, setCards] = useState(initial.cards), [notice, setNotice] = useState(initial.warning);
  const [open, setOpen] = useState(true), [editor, setEditor] = useState<string | null>(null);
  const [title, setTitle] = useState(''), [description, setDescription] = useState(''), [stage, setStage] = useState<Stage>('dream'), [tone, setTone] = useState<Tone>('peach'), [stepsText, setStepsText] = useState('');
  const [formError, setFormError] = useState(''), [deleting, setDeleting] = useState<string | null>(null);
  const titleInput = useRef<HTMLInputElement>(null), addButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (editor !== null) titleInput.current?.focus(); }, [editor]);
  function persist(next: VisionCard[], message: string) {
    setCards(next);
    try { localStorage.setItem(STORAGE, JSON.stringify({ version: 1, cards: next })); setNotice(`${message} Saved on this device.`); }
    catch { setNotice(`${message} Browser storage is unavailable or full. This change is only kept while this page is open.`); }
  }
  function edit(card?: VisionCard) {
    setOpen(true); setEditor(card?.id ?? 'new'); setTitle(card?.title ?? ''); setDescription(card?.description ?? ''); setStage(card?.stage ?? 'dream'); setTone(card?.tone ?? 'peach'); setStepsText(card?.steps.map(s => s.text).join('\n') ?? ''); setFormError(''); setDeleting(null);
    // Also focus when choosing a different action while the same editor is already open.
    requestAnimationFrame(() => titleInput.current?.focus());
  }
  function closeEditor() { setEditor(null); setFormError(''); requestAnimationFrame(() => addButton.current?.focus()); }
  function save() {
    const lines = stepsText.split('\n').map(s => s.trim()).filter(Boolean);
    if (!title.trim()) { setFormError('Give your card a title.'); titleInput.current?.focus(); return; }
    if (lines.length > 8 || lines.some(line => line.length > 180)) { setFormError('Use up to 8 steps, each no longer than 180 characters.'); return; }
    if (editor === 'new' && cards.length >= LIMIT) { setFormError('Your board can hold 40 cards. Edit or remove a card to make room.'); return; }
    const previous = cards.find(c => c.id === editor);
    const used = new Set<string>();
    const steps = lines.map(text => { const existing = previous?.steps.find(s => s.text === text && !used.has(s.id)); if (existing) { used.add(existing.id); return existing; } return { id: crypto.randomUUID(), text, done: false }; });
    const card: VisionCard = { id: previous?.id ?? crypto.randomUUID(), title: title.trim(), description: description.trim(), stage, tone, steps };
    persist(previous ? cards.map(c => c.id === previous.id ? card : c) : [...cards, card], previous ? 'Card updated.' : 'Card added.'); closeEditor();
  }
  function move(index: number, direction: number) { const next = [...cards]; const target = index + direction; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target]!, next[index]!]; persist(next, 'Card order updated.'); }
  const totalSteps = cards.reduce((sum, c) => sum + c.steps.length, 0), completed = cards.reduce((sum, c) => sum + c.steps.filter(s => s.done).length, 0);
  return <section className="vision-board" aria-labelledby="vision-board-title"><header className="vb-heading"><div><p className="vb-eyebrow">A little room for possibility</p><h2 id="vision-board-title">Your vision board</h2><p>Collect goals, small next steps, and words that inspire you.</p></div><div className="vb-heading-actions"><button type="button" ref={addButton} onClick={() => edit()} disabled={cards.length >= LIMIT}>＋ Add a card</button><button type="button" className="vb-quiet" aria-expanded={open} aria-controls="vision-board-content" onClick={() => setOpen(v => !v)}>{open ? 'Hide board' : 'Show board'}</button></div></header><p className="vb-device">Saved on this device in this browser. Your board stays separate from the shared journal and is not published.</p><p className="vb-status" role="status">{notice}</p><div id="vision-board-content" hidden={!open}>
    {editor !== null && <form className="vb-editor" onSubmit={e => { e.preventDefault(); save(); }}><h3>{editor === 'new' ? 'Make space for a new idea' : 'Edit your card'}</h3><label htmlFor="vb-title">Title <span>(up to 120 characters)</span></label><input ref={titleInput} id="vb-title" required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="Something you hope to grow toward" /><label htmlFor="vb-description">Your vision or inspiration <span>(optional)</span></label><textarea id="vb-description" rows={3} maxLength={1200} value={description} onChange={e => setDescription(e.target.value)} placeholder="Why it matters, a reminder, or what this could feel like…" /><div className="vb-editor-row"><label htmlFor="vb-stage">Where you are<select id="vb-stage" value={stage} onChange={e => setStage(e.target.value as Stage)}>{STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label><label htmlFor="vb-tone">Card color<select id="vb-tone" value={tone} onChange={e => setTone(e.target.value as Tone)}>{TONES.map(t => <option key={t} value={t}>{t[0]!.toUpperCase() + t.slice(1)}</option>)}</select></label></div><label htmlFor="vb-steps">Small steps <span>(optional; one per line, up to 8)</span></label><textarea id="vb-steps" rows={3} maxLength={1447} value={stepsText} onChange={e => setStepsText(e.target.value)} placeholder="One small thing you can do next" /><p className="vb-hint">Each step can be up to 180 characters. Unchanged steps keep their checked status.</p>{formError && <p role="alert" className="vb-error">{formError}</p>}<div className="vb-form-actions"><button type="submit">{editor === 'new' ? 'Add to my board' : 'Save card'}</button><button type="button" className="vb-quiet" onClick={closeEditor}>Cancel</button></div></form>}
    {!cards.length && <div className="vb-empty"><span aria-hidden="true">✧</span><h3>A blank canvas, just for you.</h3><p>A hope for your neighborhood, a personal milestone, or a few encouraging words—start with whatever is on your mind.</p><button type="button" onClick={() => edit()}>Create your first card</button></div>}
    {!!cards.length && <><div className="vb-progress"><span>{cards.length} {cards.length === 1 ? 'card' : 'cards'} · {cards.filter(c => c.stage === 'achieved').length} achieved</span>{totalSteps > 0 && <label>{completed} of {totalSteps} small steps complete <progress value={completed} max={totalSteps} /></label>}</div><div className="vb-cards">{cards.map((card, index) => <article key={card.id} className={`vb-card vb-${card.tone}`}><div className="vb-card-top"><span className="vb-stage">{STAGES.find(s => s.value === card.stage)?.label}</span><span aria-hidden="true">{card.stage === 'achieved' ? '✦' : '✧'}</span></div><h3>{card.title}</h3>{card.description && <p className="vb-description">{card.description}</p>}{card.steps.length > 0 && <fieldset className="vb-checklist"><legend>Small steps · {card.steps.filter(s => s.done).length}/{card.steps.length}</legend>{card.steps.map(step => <label key={step.id}><input type="checkbox" checked={step.done} onChange={e => persist(cards.map(c => c.id === card.id ? { ...c, steps: c.steps.map(s => s.id === step.id ? { ...s, done: e.target.checked } : s) } : c), 'Step updated.')} /><span className={step.done ? 'vb-step-done' : ''}>{step.text}</span></label>)}</fieldset>}<div className="vb-card-actions"><button type="button" onClick={() => edit(card)} aria-label={`Edit ${card.title}`}>Edit</button><button type="button" className="vb-quiet" onClick={() => setDeleting(card.id)} aria-label={`Remove ${card.title}`}>Remove</button><div className="vb-order"><button type="button" className="vb-quiet" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${card.title} earlier`}>↑</button><button type="button" className="vb-quiet" disabled={index === cards.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${card.title} later`}>↓</button></div></div>{deleting === card.id && <div className="vb-remove"><p>Remove “{card.title}” and its steps?</p><button type="button" onClick={() => { persist(cards.filter(c => c.id !== card.id), 'Card removed.'); setDeleting(null); if (editor === card.id) closeEditor(); else requestAnimationFrame(() => addButton.current?.focus()); }}>Remove card</button><button type="button" className="vb-quiet" onClick={() => setDeleting(null)}>Keep card</button></div>}</article>)}</div></>}
  </div></section>;
}
