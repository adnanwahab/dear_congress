import { expect, test } from 'bun:test';
import { CLUES, CivicCrossword } from './CivicCrossword';

test('fixed pack has consistent intersections and institutional sources', () => {
  const cells = new Map<number,string>();
  for (const c of CLUES) {
    expect(c.answer.length).toBe(c.cells.length);
    expect(new URL(c.url).hostname.endsWith('.gov')).toBe(true);
    c.cells.forEach((n,i) => { if(cells.has(n)) expect(cells.get(n)).toBe(c.answer[i]); cells.set(n,c.answer[i]!); });
  }
});

test('local playthrough, hints, glossary, restart, skip and exit preserve unrelated state', async () => {
  const { Window } = await import('happy-dom');
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const dom = new Window({url:'http://localhost/bills'});
  const globals = {window:dom, document:dom.document, IS_REACT_ACT_ENVIRONMENT:true};
  const previous = Object.fromEntries(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  for(const [k,v] of Object.entries(globals)) Object.defineProperty(globalThis,k,{configurable:true,value:v});
  dom.localStorage.setItem('existing-vote','preserved');
  document.body.innerHTML='<div id="root"></div>';
  const root = createRoot(document.getElementById('root')!);
  const button = (name:string) => [...document.querySelectorAll('button')].find(b=>b.textContent===name)!;
  const click = async (name:string) => act(async()=>button(name).click());
  try {
    await act(async()=>root.render(<CivicCrossword/>));
    await click('Play Civic Chronicle crossword');
    for(const c of CLUES) for(let i=0;i<c.answer.length;i++) await click(`Hint ${c.id}`);
    expect(document.querySelector('[role=status]')!.textContent).toContain('Puzzle complete');
    const glossary = document.querySelector('a[href="#crossword-1-across"]') as HTMLAnchorElement;
    await act(async()=>glossary.click());
    expect(document.querySelector('details')!.open).toBe(true);
    expect(document.body.textContent).toContain('Completion confers no civic authority');
    await click('Restart');
    expect([...document.querySelectorAll('input')].every(i=>i.value==='')).toBe(true);
    const first=document.querySelector('input')!;
    first.focus();
    await act(async()=>first.dispatchEvent(new dom.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}) as any));
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Row 1, column 2');
    await click('Skip');
    expect(document.querySelectorAll('input').length).toBe(0);
    expect(document.activeElement).toBe(button('Play Civic Chronicle crossword'));
    await click('Play Civic Chronicle crossword');
    document.querySelector('input')!.focus();
    await act(async()=>document.querySelector('input')!.dispatchEvent(new dom.KeyboardEvent('keydown',{key:'Escape',bubbles:true}) as any));
    expect(document.querySelectorAll('input').length).toBe(0);
    expect(dom.localStorage.getItem('existing-vote')).toBe('preserved');
    expect(dom.localStorage.length).toBe(1);
    expect(dom.sessionStorage.length).toBe(0);
  } finally {
    await act(async()=>root.unmount()); await dom.happyDOM.close();
    for(const [k,v] of Object.entries(previous)) { if(v) Object.defineProperty(globalThis,k,v); else Reflect.deleteProperty(globalThis,k); }
  }
});
