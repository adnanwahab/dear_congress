import { Window as TestWindow } from 'happy-dom';
import { expect, test } from 'bun:test';
import { onPageActivation } from './page-activation';

test('stream effects wait for activation and clean up on unmount or cancellation', () => {
  const dom = new TestWindow();
  const page = dom.document as unknown as Document & { prerendering: boolean };
  page.prerendering = true;
  let opens = 0, closes = 0;
  const start = () => { opens++; return () => { closes++; }; };
  const stop = onPageActivation(start, page as unknown as Document);
  expect(opens).toBe(0);
  page.prerendering = false;
  page.dispatchEvent(new dom.Event('prerenderingchange') as unknown as Event);
  page.dispatchEvent(new dom.Event('prerenderingchange') as unknown as Event);
  expect(opens).toBe(1);
  stop(); expect(closes).toBe(1);
  page.prerendering = true;
  onPageActivation(start, page as unknown as Document)();
  page.dispatchEvent(new dom.Event('prerenderingchange') as unknown as Event);
  expect(opens).toBe(1);
  onPageActivation(start, new TestWindow().document as unknown as Document)();
  expect(opens).toBe(2); expect(closes).toBe(2);
});
