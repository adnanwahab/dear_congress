import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { renderToStaticMarkup } from 'react-dom/server';
import archive from '../shared/redline-card-archive.json';
import { DEMO_ITEMS } from '../engine/demo';
import { cardText, RedlineCard, RedlineShareLink } from './RedlineShareCard';

test('archived revisions bind every card field and preserve exact source identity', () => {
  for (const { revision, ...data } of archive) {
    expect(createHash('sha256').update(JSON.stringify(data)).digest('hex')).toBe(revision);
    expect(data.repository).toBe('adnanwahab/dear_congress');
    expect(data.kind).toBe('sample');
    expect(cardText({ revision, ...data })).toContain(`/draft?card=${revision}`);
  }
});
test('text card and full accessibility description snapshot', () => {
  expect(renderToStaticMarkup(<RedlineCard revision={archive[0]!.revision} />)).toMatchSnapshot();
  expect(archive.map(cardText)).toMatchSnapshot();
});
test('unknown revisions fail closed and changed current text cannot reuse old link', () => {
  const item = DEMO_ITEMS[0]!;
  expect(renderToStaticMarkup(<RedlineCard revision="unknown" />)).toContain('Draft revision unavailable');
  expect(renderToStaticMarkup(<RedlineShareLink item={item} />)).toContain(archive[0]!.revision);
  for (const change of [{currentText:'changed'}, {proposedText:'changed'}, {jurisdiction:'changed'}, {id:'citizen-1'}, {sourceUrl:'https://example.org'}]) {
    expect(renderToStaticMarkup(<RedlineShareLink item={{...item,...change}} />)).toContain('No archived share card');
  }
  expect(renderToStaticMarkup(<RedlineCard revision={archive[0]!.revision} />)).toContain(archive[0]!.before);
});
