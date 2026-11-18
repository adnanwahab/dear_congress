import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type TouchEvent } from 'react';
import { type CatalogBill } from '../shared/bill-catalog';
import { getLawScene, LawVisualization } from './LawVisualization';
import './law-carousel.css';

function urlLaw(): string {
  return new URLSearchParams(window.location.search).get('law') ?? '';
}
function writeLawToUrl(id: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('law', id);
  window.history.replaceState(null, '', url);
}

export function LawCarousel({ bills }: { bills: readonly CatalogBill[] }) {
  const [selectedId, setSelectedId] = useState(urlLaw);
  const railRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<number | undefined>(undefined);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const billIds = bills.map(bill => bill.id).join('|');
  const active = bills.find(bill => bill.id === selectedId) ?? bills[0];
  const index = active ? bills.findIndex(bill => bill.id === active.id) : -1;
  const scene = active ? getLawScene(active.id) : undefined;

  useEffect(() => {
    function restore() {
      const id = urlLaw();
      if (bills.some(bill => bill.id === id)) setSelectedId(id);
    }
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [billIds]);

  useEffect(() => {
    if (!bills.length) return;
    if (bills.some(bill => bill.id === selectedId)) return;
    const first = bills[0];
    if (first) setSelectedId(first.id);
  }, [billIds, selectedId]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    function handleWheel(event: WheelEvent) {
      if (!rail || event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const maximum = rail.scrollWidth - rail.clientWidth;
      const next = Math.min(maximum, Math.max(0, rail.scrollLeft + event.deltaY));
      if (Math.abs(rail.scrollLeft - next) < 1) return;
      event.preventDefault();
      rail.scrollLeft = next;
    }
    rail.addEventListener('wheel', handleWheel, { passive: false });
    return () => rail.removeEventListener('wheel', handleWheel);
  }, [billIds]);

  useEffect(() => () => window.clearTimeout(scrollTimerRef.current), []);

  function centerThumbnail(id: string) {
    const rail = railRef.current;
    const thumbnail = rail?.querySelector<HTMLElement>(`[data-law-id="${id}"]`);
    if (!rail || !thumbnail) return;
    const target = thumbnail.offsetLeft + thumbnail.offsetWidth / 2 - rail.clientWidth / 2;
    if (typeof rail.scrollTo === 'function') rail.scrollTo({ left: target, behavior: 'auto' });
    else rail.scrollLeft = target;
  }

  useEffect(() => {
    if (!active) return;
    const frame = window.requestAnimationFrame(() => centerThumbnail(active.id));
    return () => window.cancelAnimationFrame(frame);
  }, [billIds]);

  function choose(id: string, center = true) {
    if (!bills.some(bill => bill.id === id)) return;
    setSelectedId(id);
    writeLawToUrl(id);
    if (center) centerThumbnail(id);
  }

  function advance(offset: number) {
    if (!bills.length || index < 0) return;
    const nextIndex = (index + offset + bills.length) % bills.length;
    const next = bills[nextIndex];
    if (next) choose(next.id);
  }

  function onRailScroll() {
    window.clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = window.setTimeout(() => {
      const rail = railRef.current;
      if (!rail) return;
      const center = rail.getBoundingClientRect().left + rail.clientWidth / 2;
      let nearest: { id: string; distance: number } | undefined;
      for (const el of rail.querySelectorAll<HTMLElement>('[data-law-id]')) {
        const rect = el.getBoundingClientRect();
        const distance = Math.abs(rect.left + rect.width / 2 - center);
        if (!nearest || distance < nearest.distance) nearest = { id: el.dataset.lawId ?? '', distance };
      }
      if (nearest?.id) choose(nearest.id, false);
    }, 120);
  }

  function onArrowKey(event: KeyboardEvent<HTMLElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown') {
      event.preventDefault(); advance(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
      event.preventDefault(); advance(-1);
    } else if (event.key === 'Home' && bills[0]) {
      event.preventDefault(); choose(bills[0].id);
    } else if (event.key === 'End' && bills[bills.length - 1]) {
      event.preventDefault(); choose(bills[bills.length - 1]!.id);
    }
  }

  function endSwipe(event: TouchEvent<HTMLDivElement>) {
    const start = touchRef.current;
    touchRef.current = null;
    const end = event.changedTouches[0];
    if (!start || !end) return;
    const deltaX = end.clientX - start.x, deltaY = end.clientY - start.y;
    if (Math.abs(deltaX) >= 55 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) advance(deltaX < 0 ? 1 : -1);
  }

  return <section className="law-carousel" aria-labelledby="law-carousel-heading" aria-roledescription="carousel"
    tabIndex={0} onKeyDown={onArrowKey}>
    <div className="law-carousel__header">
      <div>
        <p className="law-carousel__eyebrow">EXPLORE THE LAW COLLECTION</p>
        <h2 id="law-carousel-heading">One law at a time.</h2>
        <p>Scroll the strip or use ← → to browse every proposal and its own visual explanation.</p>
      </div>
      <div className="law-carousel__progress" aria-live="polite" aria-atomic="true">
        <strong>{active ? String(index + 1).padStart(2, '0') : '00'}</strong>
        <span>/ {String(bills.length).padStart(2, '0')} drafts</span>
      </div>
    </div>
    {!active ? <p role="status">No laws match the current filters. Clear the catalog search to browse the visualizations.</p> : <>
      <div className="law-carousel__controls">
        <button type="button" onClick={() => advance(-1)} disabled={bills.length < 2} aria-label="Previous law">
          <span aria-hidden="true">←</span> Previous
        </button>
        <p role="status" aria-live="polite">{active.id} · {active.title}</p>
        <button type="button" onClick={() => advance(1)} disabled={bills.length < 2} aria-label="Next law">
          Next <span aria-hidden="true">→</span>
        </button>
      </div>
      <div className="law-carousel__stage" onTouchStart={event => {
        const touch = event.touches[0];
        if (touch) touchRef.current = { x: touch.clientX, y: touch.clientY };
      }} onTouchEnd={endSwipe}>
        {scene ? <LawVisualization bill={active} scene={scene} /> :
          <p role="alert">The stored visualization for {active.id} is unavailable. You can still read the draft.</p>}
      </div>
      <div className="law-carousel__below">
        <span>SWIPE / SCROLL THROUGH LAWS</span>
        <a href={`/bills/${active.id}`}>Read the full {active.id} proposal ↗</a>
      </div>
      <div className="law-carousel__rail" ref={railRef} onScroll={onRailScroll}
        role="group" aria-label="Scrollable law thumbnails">
        {bills.map((bill, i) => {
          const spec = getLawScene(bill.id);
          const selected = active.id === bill.id;
          return <button type="button" key={bill.id} data-law-id={bill.id}
            aria-current={selected ? 'true' : undefined}
            aria-label={`Show law ${i + 1} of ${bills.length}: ${bill.id}, ${bill.title}`}
            className={selected ? 'law-carousel__thumb law-carousel__thumb--active' : 'law-carousel__thumb'}
            onClick={() => choose(bill.id)}
            style={{ '--scene-accent': spec?.accent ?? '#8be5b7' } as CSSProperties}>
            <span className="law-carousel__thumb-id">{bill.id}</span>
            <span className="law-carousel__thumb-mark" aria-hidden="true"><i /><i /><i /></span>
            <strong>{bill.title}</strong>
            <span className="law-carousel__thumb-counter">{String(i + 1).padStart(2, '0')} / {bills.length}</span>
          </button>;
        })}
      </div>
      <p className="law-carousel__help">Keyboard: ←/→ next or previous, Home/End first or last, Page Up/Down to step. Mouse wheel works over the strip; swipe on touch devices. Navigation wraps at the ends. URL updates to <code>?law={active.id}</code> for sharing.</p>
    </>}
  </section>;
}
