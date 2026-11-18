import { useState } from 'react';
import './legal-latency-lab.css';

const HISTORICAL_DAYS = 40;
const HISTORICAL_MS = HISTORICAL_DAYS * 24 * 60 * 60 * 1000;
const NUMBER = new Intl.NumberFormat('en-US');

const LOG_TICKS = [
  { label: '1 ms', durationMs: 1 },
  { label: '1 sec', durationMs: 1_000 },
  { label: '1 hour', durationMs: 3_600_000 },
  { label: '1 day', durationMs: 86_400_000 },
  { label: '40 days', durationMs: HISTORICAL_MS },
];

function logPosition(durationMs: number): number {
  const fraction = Math.log10(Math.max(durationMs, 1)) / Math.log10(HISTORICAL_MS);
  return Math.max(0, Math.min(100, fraction * 100));
}

/**
 * Educational comparison of communication round trips, NOT measured legal latency.
 * The modern example is adjustable by the reader; no network probe is performed.
 */
export default function LegalLatencyLab() {
  const [roundTripMs, setRoundTripMs] = useState(250);
  const [playing, setPlaying] = useState(true);
  const [replay, setReplay] = useState(0);

  const durationRatio = Math.round(HISTORICAL_MS / roundTripMs);
  const networkPosition = logPosition(roundTripMs);

  return (
    <section className="csh-ll" id="latency-lab" aria-labelledby="csh-ll-title">
      <div className="csh-ll-heading">
        <div>
          <p className="csh-ll-eyebrow">01A / INTERACTIVE COMMUNICATION LAB</p>
          <h3 id="csh-ll-title">Forty days.<br /><em>A fraction of a second.</em></h3>
          <p className="csh-ll-intro">Imagine asking a question, receiving an answer, and asking again. Communication has accelerated enormously. Thoughtful lawmaking still needs human time.</p>
        </div>
        <div className="csh-ll-tag"><span aria-hidden="true" className="csh-ll-led" />EXPLORABLE EXAMPLE · NOT LIVE DATA</div>
      </div>

      <div className="csh-ll-console">
        <div className="csh-ll-topline"><span>COMMUNICATION / ROUND TRIP</span><span>MOTION COMPRESSED · NOT TIME-SCALED</span></div>
        <div className="csh-ll-lanes" data-playing={playing ? 'yes' : 'no'} key={replay}>
          <article className="csh-ll-lane csh-ll-lane--old">
            <div className="csh-ll-lane-head"><span>1799 / POSTAL CORRESPONDENCE</span><strong>~40 <small>days</small></strong></div>
            <div className="csh-ll-route" aria-label="Letter sent from Savannah, Georgia, to Portland, Maine, then replied to">
              <div className="csh-ll-place"><b>GA</b><span>Savannah</span></div>
              <div className="csh-ll-track" aria-hidden="true"><span className="csh-ll-signal csh-ll-signal--letter">✉</span></div>
              <div className="csh-ll-place"><b>ME</b><span>Portland</span></div>
            </div>
            <p>Letter out + reply back. Historical round-trip estimate from 1799.</p>
          </article>
          <article className="csh-ll-lane csh-ll-lane--new">
            <div className="csh-ll-lane-head"><span>TODAY / INTERNET PACKETS</span><strong>{roundTripMs} <small>ms</small></strong></div>
            <div className="csh-ll-route" aria-label="Illustrative network packet from Georgia, USA, to Shenzhen, China, and back">
              <div className="csh-ll-place"><b>GA</b><span>Georgia</span></div>
              <div className="csh-ll-track" aria-hidden="true"><span className="csh-ll-signal csh-ll-signal--packet">◆</span></div>
              <div className="csh-ll-place"><b>CN</b><span>Shenzhen</span></div>
            </div>
            <p>Selected example of network round-trip time, not a measured route or application response.</p>
          </article>
        </div>
        <div className="csh-ll-result">
          <div>
            <span className="csh-ll-result-label">DIFFERENCE IN ROUND-TRIP DURATION</span>
            <strong>{NUMBER.format(durationRatio)}<small>×</small></strong>
          </div>
          <p>At {roundTripMs} ms per network round trip, the 40-day mail interval is that many times longer. This compares durations, <b>not</b> the speed of passing a law.</p>
        </div>
        <div className="csh-ll-controls">
          <div className="csh-ll-slider-wrap">
            <div className="csh-ll-slider-label"><label htmlFor="csh-ll-rtt">Change the illustrative network latency</label><output htmlFor="csh-ll-rtt">{roundTripMs} ms</output></div>
            <input id="csh-ll-rtt" type="range" min={150} max={500} step={25} value={roundTripMs} onChange={event => setRoundTripMs(Number(event.target.value))} />
            <div className="csh-ll-slider-endpoints"><span>150 ms</span><span>500 ms</span></div>
          </div>
          <div className="csh-ll-actions">
            <button type="button" onClick={() => setPlaying(value => !value)} aria-pressed={!playing}>{playing ? 'Ⅱ Pause' : '▶ Resume'}</button>
            <button type="button" onClick={() => { setReplay(value => value + 1); setPlaying(true); }}>↻ Replay</button>
          </div>
        </div>
      </div>

      <div className="csh-ll-scale">
        <div className="csh-ll-scale-head"><strong>See both on the same clock.</strong><span>LOGARITHMIC TIME SCALE</span></div>
        <div className="csh-ll-scale-board" role="img" aria-label={'Logarithmic time comparison from one millisecond to forty days. Network example: ' + roundTripMs + ' milliseconds. Mail round trip: forty days.'}>
          <div className="csh-ll-axis">{LOG_TICKS.map(tick => <span key={tick.label} style={{ left: logPosition(tick.durationMs) + '%' }}>{tick.label}</span>)}</div>
          <div className="csh-ll-measure"><span>Network</span><div className="csh-ll-measure-track"><div className="csh-ll-measure-fill csh-ll-measure-fill--network" style={{ width: networkPosition + '%' }} /><i className="csh-ll-dot csh-ll-dot--network" style={{ left: networkPosition + '%' }} /></div><b>{roundTripMs} ms</b></div>
          <div className="csh-ll-measure"><span>Mail</span><div className="csh-ll-measure-track"><div className="csh-ll-measure-fill csh-ll-measure-fill--mail" /><i className="csh-ll-dot csh-ll-dot--mail" /></div><b>40 days</b></div>
        </div>
        <p className="csh-ll-caveat">Both are round trips, but not equivalent kinds of communication. The mail figure describes Savannah–Portland correspondence in <strong>1799</strong>, not a measured 1776 route. The Georgia–Shenzhen RTT is an <strong>adjustable illustration</strong>, not live telemetry. Faster messages may help people collaborate; they do not replace informed consent, debate, expert review, constitutional procedures, or legal safeguards. <a href="https://press.uchicago.edu/ucp/books/book/chicago/P/bo4134270.html">Historical reference: David M. Henkin, <em>The Postal Age</em></a>.</p>
      </div>
    </section>
  );
}
