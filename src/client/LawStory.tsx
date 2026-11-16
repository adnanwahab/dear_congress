import { useState } from 'react';
import { STAGES, stageRoute } from '../shared/civic-stages';
import { LAW_CHAPTERS, STORY_PROPOSAL, type LawChapter } from './law-story';
import './law-story.css';

function ChapterText({ chapter, index }: { chapter: LawChapter; index: number }) {
  return <>
    <h3>{index + 1}. {chapter.title}</h3>
    <p className="law-story-scene">{chapter.scene}</p>
    <p>{chapter.narration}</p>
    <p><strong>Reality check:</strong> {chapter.boundary}</p>
    <a href={stageRoute(chapter.stage, STORY_PROPOSAL)}>Open {STAGES[chapter.stage].title} · transit sample →</a>
  </>;
}

export function LawStory() {
  const [chapter, setChapter] = useState(0);
  const [textOnly, setTextOnly] = useState(false);
  const [motion, setMotion] = useState(true);
  return <details className="law-story">
    <summary>The life of a law · a six-chapter motion comic</summary>
    <h2>A bus home after dark</h2>
    <p>A fictional journey from lived need to a possible policy and its evaluation. This is one possible path, not a claim that a law passed. Reading never saves a vote, publishes a story or contacts an office.</p>
    <p><a href="https://www.ridemetro.org/">METRO · official agency background</a> — background only, not evidence for this fictional pilot. <a href="/documentation">Participation, privacy and trust limits</a></p>
    <div className="law-story-controls">
      <button onClick={() => setTextOnly(v => !v)} aria-pressed={textOnly}>{textOnly ? 'Return to illustrated chapters' : 'Skip illustrations · complete text edition'}</button>
      {!textOnly && <button onClick={() => setMotion(v => !v)} aria-pressed={!motion}>{motion ? 'Pause illustration motion' : 'Enable illustration motion'}</button>}
    </div>
    {textOnly ? <ol className="law-story-edition">{LAW_CHAPTERS.map((c, i) => <li key={c.stage}><ChapterText chapter={c} index={i} /></li>)}</ol> : <>
      <nav className="law-story-controls" aria-label="Story chapters">{LAW_CHAPTERS.map((c, i) => <button key={c.stage} aria-current={i === chapter ? 'step' : undefined} onClick={() => setChapter(i)}>{i + 1}. {c.title}</button>)}</nav>
      <article className="law-story-panel" key={chapter} aria-label={`Chapter ${chapter + 1} of 6`}>
        <div className={`law-story-art${motion ? ' law-story-motion' : ''}`} aria-hidden="true">
          <svg viewBox="0 0 600 180" focusable="false">
            <path d="M0 145H600 M35 30V145 M95 60V145 M505 35V145 M560 70V145" />
            {chapter === 0 ? <g><circle cx="95" cy="72" r="17"/><path d="M95 89V130 M70 106H120 M95 130L78 155 M95 130L112 155"/></g> : <g><path d="M65 30H230V125H65Z M85 55H205 M85 75H190 M85 95H210"/><circle cx="95" cy="55" r="3"/></g>}
            <g className="law-story-bus"><rect x="300" y="65" width="170" height="70" rx="12"/><path d="M315 80H455V105H315Z M350 80V105 M390 80V105 M430 80V105"/><circle cx="335" cy="140" r="13"/><circle cx="435" cy="140" r="13"/></g>
            {chapter === 5 && <path d="M70 115L110 95L150 105L195 60"/>}
          </svg>
          <span>{['AFTER THE SHIFT', 'CHECK THE SOURCE', 'HEAR THE CONCERN', 'REVISE THE WORDS', 'PREPARE THE HANDOFF', 'MEASURE, THEN RECONSIDER'][chapter]}</span>
        </div>
        <div aria-live="polite" aria-atomic="true"><ChapterText chapter={LAW_CHAPTERS[chapter]!} index={chapter} /></div>
      </article>
      <div className="law-story-controls"><button disabled={chapter === 0} onClick={() => setChapter(i => i - 1)}>Previous chapter</button><span>{chapter + 1} / 6</span><button disabled={chapter === 5} onClick={() => setChapter(i => i + 1)}>Next chapter</button></div>
    </>}
    <p>Chapters are bundled text and inline drawings: no illustration downloads or live data are needed. If a linked stage is loading or fails, return here to keep reading; stage pages provide their own loading and retry states.</p>
  </details>;
}
