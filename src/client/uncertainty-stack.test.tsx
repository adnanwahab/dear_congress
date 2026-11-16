import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { UncertaintyStack } from './UncertaintyStack';
import { Window } from 'happy-dom';
test('stack exposes native controls, readable provenance and export fallback without remote data', () => {
  const window = new Window();
  window.document.body.innerHTML = renderToStaticMarkup(<UncertaintyStack />);
  const doc = window.document;
  expect(doc.querySelectorAll('select option').length).toBe(3);
  expect(doc.querySelectorAll('ol li').length).toBe(4);
  expect(doc.querySelector('[role=status]')!.textContent).toContain('$72,000–$198,000');
  expect(doc.body.textContent).toContain('pending human review');
  expect(doc.body.textContent).toContain('No primary data source');
  expect(JSON.parse(doc.querySelector('textarea')!.value).components.length).toBe(4);
  expect(doc.querySelector('textarea')!.readOnly).toBe(true);
  expect(doc.querySelector('iframe,canvas')).toBeNull();
  window.happyDOM.abort();
});

test('mounted selection and failed-download fallback work without network or storage', () => {
  const result = Bun.spawnSync(['bun', 'scripts/verify-uncertainty-stack.tsx'], { cwd: process.cwd() });
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain('PASS local selection');
});
