import {test, expect} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {Window} from 'happy-dom';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {PolicyDemoPicker} from './PolicyDemoPicker';
import {POLICY_DEMOS} from '../shared/policy-demo-catalog';

test('unwired picker remains candid, accessible and cannot offer invented previews', () => {
  const html = renderToStaticMarkup(<PolicyDemoPicker />);
  expect(html).toContain('human acceptance');
  expect(html).toContain('disabled');
  expect(html).toContain('Not Modeled');
  expect(html).toContain('No preview URL');
  expect(html).not.toContain('<iframe');
  expect(html).not.toContain('pp_');
});

test('policy selection preserves exact text and identity; callback failure never claims a save', async () => {
  const dom = new Window({url:'https://example.test'});
  const keys = ['window','document','navigator','HTMLElement','Node','IS_REACT_ACT_ENVIRONMENT'];
  const previous = keys.map(key => Object.getOwnPropertyDescriptor(globalThis,key));
  for (const key of keys) Object.defineProperty(globalThis,key,{configurable:true,value:key === 'IS_REACT_ACT_ENVIRONMENT' ? true : key === 'window' ? dom : (dom as any)[key]});
  const container = dom.document.createElement('div'); dom.document.body.append(container);
  const root = createRoot(container as unknown as HTMLElement);
  const calls: string[] = [];
  try {
    await act(async () => root.render(<PolicyDemoPicker onSelect={async id => {calls.push(id); throw new Error('private server detail');}} />));
    const select = container.querySelector('select')!;
    for (const demo of POLICY_DEMOS) {
      await act(async () => {select.value=demo.id; select.dispatchEvent(new dom.Event('change',{bubbles:true}));});
      expect(container.textContent).toContain(demo.input.legal.clauses[0].afterText);
      expect(container.textContent).toContain(demo.legalHash);
      expect(container.textContent).toContain(demo.limitation);
      expect(container.querySelector('iframe,a[href*="preview"]')).toBeNull();
    }
    await act(async () => container.querySelector('button')!.click());
    expect(calls).toEqual(['unsupported']);
    expect(container.querySelector('[role=status]')!.textContent).toContain('No save or simulation success');
    expect(container.textContent).not.toContain('private server detail');
  } finally {
    await act(async () => root.unmount());
    for (const [index,key] of keys.entries()) { const descriptor=previous[index]; if(descriptor) Object.defineProperty(globalThis,key,descriptor); else Reflect.deleteProperty(globalThis,key); }
    await dom.happyDOM.close();
  }
});
