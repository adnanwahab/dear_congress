import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReportError } from './ReportError';
import { reportUrl, reportRevision } from '../shared/error-reports';
import { DEMO_ITEMS } from '../engine/demo';
import { proposalEmbed } from '../server/proposal-embed';
import { errorReportPage, errorReportScript, resolveErrorTarget } from '../server/error-reports';
import { emptyDB } from '../engine/engine';
import { Window } from 'happy-dom';

test('report link retains exact source kind, canonical ID and revision in escaped navigation', async () => {
  const target = { kind: 'official-metadata', id: 'congress-gov:119:hr:123', revision: 'a'.repeat(64) };
  const html = renderToStaticMarkup(<ReportError {...target} />);
  expect(html).toContain('Report an error');
  expect(html).toContain(reportUrl(target).replaceAll('&', '&amp;'));
  const embed = await proposalEmbed(new Request('https://example.test/embed/v1?proposal=demo-housing')).text();
  expect(embed).toContain(await reportRevision(JSON.stringify(DEMO_ITEMS[0])));
  expect(embed).toContain('Report an error (new tab)');
});
test('report form keeps text and retry key on network failure, then shows receipt on success', async () => {
  const db = emptyDB();
  const { target } = await resolveErrorTarget(db, 'sample', DEMO_ITEMS[0]!.id);
  const window = new Window({ url: 'https://example.test' + reportUrl(target) });
  try {
    window.document.write(await (await errorReportPage(new Request(window.location.href), db)).text());
    const form = window.document.querySelector('form')!;
    const textarea = form.querySelector('textarea')!;
    textarea.value = 'Evidence is missing. Suggested correction: qualify the claim.';
    const sent: any[] = [];
    let failed = true;
    window.fetch = (async (_url: any, init: any) => {
      sent.push(JSON.parse(init.body));
      if (failed) throw Error('Offline');
      return new Response(JSON.stringify({ id: 'receipt-123', status: 'pending' }), { status: 201 });
    }) as any;
    window.eval(errorReportScript);
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(window.document.getElementById('result')!.textContent).toContain('Offline');
    expect(textarea.value).toContain('Suggested correction');
    expect(form.querySelector('button')!.disabled).toBe(false);
    failed = false;
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(sent[0]).toEqual(sent[1]);
    expect(sent[0].revision).toBe(target.revision);
    expect(sent[0].reason).toBe(textarea.value);
    expect(window.document.getElementById('result')!.textContent).toContain('receipt-123');
    expect(form.hidden).toBe(true);
  } finally { await window.happyDOM.close(); }
});
