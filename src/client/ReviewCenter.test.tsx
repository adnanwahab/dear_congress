import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Window } from 'happy-dom';
import ReviewCenter from './ReviewCenter';
import { billCollection } from '../shared/bill-catalog';

const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
function restoreWindow() {
  if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow);
  else delete (globalThis as { window?: unknown }).window;
}

test('review center opens on the proposal document with searchable catalog and contextual public review form', () => {
  const window = new Window({ url: 'https://civic.test/review' });
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true });
  try {
    window.document.body.innerHTML = renderToStaticMarkup(<ReviewCenter />);
    expect(window.document.querySelectorAll('.review-bill-option')).toHaveLength(billCollection.bills.length);
    expect(window.document.querySelector('#selected-bill-title')?.textContent).toBe('Public Arts and Music Act');
    expect(window.document.querySelector('.review-document')?.textContent).toContain('The problem');
    expect(window.document.querySelector('.review-document')?.textContent).toContain('Proposed change');
    expect(window.document.querySelector('.review-document')?.textContent).toContain('Full statutory text has not been supplied');
    expect(window.document.querySelector('.review-workspace')?.textContent).toContain('Submit for human review');
    expect(window.document.querySelector('#suggestion-findings')).not.toBeNull();
    expect(window.document.querySelector('.review-signin[open]')).toBeNull();
    expect(window.document.querySelector('#reviewer-token')).not.toBeNull();
  } finally {
    window.happyDOM.abort();
    restoreWindow();
  }
});

test('a valid bill deep link selects its exact bill and presents the mobile detail return action', () => {
  const window = new Window({ url: 'https://civic.test/review?bill=HFL-060' });
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true });
  try {
    window.document.body.innerHTML = renderToStaticMarkup(<ReviewCenter />);
    expect(window.document.querySelector('#selected-bill-title')?.textContent).toBe(billCollection.bills.find(b => b.id === 'HFL-060')?.title);
    expect(window.document.querySelector('.review-center')?.className).toContain('review-center--mobile-detail');
    expect(window.document.querySelector('.review-back')?.textContent).toContain('Back to bills');
  } finally {
    window.happyDOM.abort();
    restoreWindow();
  }
});
