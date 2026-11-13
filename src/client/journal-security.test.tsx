import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { JournalView } from "./App";

test("journal escapes published text and shows consent/removal guidance before submit", () => {
  const injection = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
  const html = renderToStaticMarkup(<JournalView state={{ entries: [{ id: "public-entry", text: injection, author: injection, extraction: { needs: [] } }] } as any} refresh={() => {}} liveStatus="live" onPublishStart={() => {}} onPublishEvent={() => {}} onSeeNeed={() => {}} />);
  expect(html).not.toContain('<img');
  expect(html).not.toContain('<script');
  expect(html).toContain('&lt;img');
  expect(html).toContain('This entry is public if submitted.');
  expect(html).toContain('Do not include addresses, contact details');
  expect(html).toContain('open a removal request');
  expect(html).toContain('I want to publish this entry publicly.');
  expect(html.indexOf('This entry is public')).toBeLessThan(html.indexOf('Publish publicly'));
  expect(html).toContain('maxLength="10000"');
  expect(html).toContain('disabled=""');
});
