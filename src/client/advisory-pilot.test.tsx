import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import GamePatches, { Facts } from './GamePatches';
import WorkflowScreen from './WorkflowScreen';
import { BottomNavigation } from './Navigation';
import type { PublicPull } from '../shared/hbl-governance';

test('blocked PR primary status is Blocked and keeps the actual base reason', () => {
  const pull = {number: 282, title: 'Synthetic blocked PR', author: 'fixture', updatedAt: '',
    draft: false, state: 'open', base: 'disallowed', headSha: 'head', labels: [],
    eligibility: {state: 'blocked', eligible: false, reason: 'Base branch is not allowed'},
  } as unknown as PublicPull;
  const html = renderToStaticMarkup(<Facts pull={pull} />);
  expect(html).toContain('Blocked · open');
  expect(html).toContain('Base branch is not allowed');
  expect(html).toContain('<code>disallowed</code>');
  expect(html).not.toContain('Ready for review');
});

test('direct list and detail render labeled pilot; civic vote page labels repository voting separately', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  try {
    for (const pathname of ['/vote/happybearlandia', '/vote/happybearlandia/pr/282']) {
      Object.defineProperty(globalThis, 'window', {configurable: true, value: {location: {pathname, search: ''}}});
      const html = renderToStaticMarkup(<GamePatches />);
      expect(html).toContain('Developer preview / not a binding vote');
      expect(html).toContain('Public responses do not approve or merge code');
      expect(html).toContain('Not scheduled — advisory pilot');
      expect(html).not.toContain('Next merge batch');
      const nav = renderToStaticMarkup(<BottomNavigation />);
      expect(nav).not.toContain('href="/votes" aria-current="page"');
    }
    const request = async <T,>(): Promise<T> => {throw Error('offline');};
    const civic = renderToStaticMarkup(<WorkflowScreen stage="votes" request={request} />);
    expect(civic).toContain('aria-label="Vote on application pull requests"');
    expect(civic).toContain('href="/vote/happybearlandia?view=prs"');
    expect(civic).toContain('separate from the civic proposals below');
    expect(civic).toContain('advisory, not merge approvals');
    expect(civic).not.toContain('Cast advisory vote'); // Initial SSR has no loaded proposal.
    expect(civic).toContain('Verified eligible participants — advisory');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
