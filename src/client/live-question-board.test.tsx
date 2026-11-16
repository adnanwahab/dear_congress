import { test, expect } from 'bun:test';
import { LiveRounds } from '../server/live-rounds';

test('live question UI loads, retries, preserves failed draft, submits anonymously and freezes', async () => {
  const { Window } = await import('happy-dom');
  const window = new Window({url:'http://localhost/live/test'});
  let stream: Stream;
  class Stream { constructor() {stream=this;} onmessage:any; onerror:any; close() {} }
  const globals = { window, document:window.document, navigator:window.navigator, EventSource:Stream, IS_REACT_ACT_ENVIRONMENT:true };
  const previous = Object.fromEntries(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const originalFetch = globalThis.fetch;
  for (const [key,value] of Object.entries(globals)) Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const { LiveRound } = await import('./LiveRound');
  const rounds = new LiveRounds(); const round = rounds.start('demo-housing','owner');
  let resolve!: (r:Response)=>void;
  const requests: {path:string;body:any}[] = [];
  globalThis.fetch = ((path:any,init:any) => {requests.push({path,body:init?.body ? JSON.parse(init.body) : undefined});return new Promise<Response>(r=>{resolve=r;});}) as typeof fetch;
  const host=document.createElement('div'); document.body.append(host);const root=createRoot(host);
  const button=(text:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent===text)!;
  try {
    await act(async()=>root.render(<LiveRound code={round.code} presenter={false}/>));
    expect(host.textContent).toContain('Loading round');
    await act(async()=>resolve(Response.json({error:'Unavailable'},{status:503})));
    expect(host.querySelector('[role=alert]')!.textContent).toContain('Unavailable');
    await act(async()=>button('Retry loading round').click());
    await act(async()=>resolve(Response.json(rounds.snapshot(round.code,'phone'))));
    expect(host.textContent).toContain('not civic election votes');
    expect(host.querySelector('textarea')!.maxLength).toBe(500);
    expect(host.querySelector('label[for=live-question-text]')).not.toBeNull();
    const textarea=host.querySelector('textarea')!;
    await act(async()=>{
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value')!.set!.call(textarea,'More evening buses?');
      textarea.dispatchEvent(new window.Event('input',{bubbles:true}) as unknown as Event);
      textarea.dispatchEvent(new window.Event('change',{bubbles:true}) as unknown as Event);
    });
    // A native form supports keyboard submission as well as touch activation.
    await act(async()=>host.querySelector('form')!.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}) as unknown as Event));
    expect(requests.at(-1)!.body).toEqual({kind:'submit',text:'More evening buses?'});
    expect(button('Send question for review').disabled).toBe(true);
    await act(async()=>resolve(Response.json({error:'Try later'},{status:429})));
    expect(textarea.value).toBe('More evening buses?');
    expect(host.querySelector('[role=alert]')!.textContent).toContain('Try later');
    await act(async()=>button('Send question for review').click());
    await act(async()=>resolve(Response.json(rounds.question(round.code,'phone',requests.at(-1)!.body))));
    expect(textarea.value).toBe('');
    expect(host.textContent).toContain('Question sent for presenter review');
    expect(host.textContent).not.toContain('More evening buses?');
    const pending=rounds.snapshot(round.code,'owner').board.questions[0]!;
    rounds.question(round.code,'owner',{kind:'approve',id:pending.id});
    await act(async()=>stream.onmessage({data:JSON.stringify(rounds.snapshot(round.code,'phone'))}));
    await act(async()=>button('Report abuse').click());
    await act(async()=>resolve(Response.json(rounds.question(round.code,'phone',requests.at(-1)!.body))));
    expect(button('Reported for review').disabled).toBe(true);
    await act(async()=>stream.onmessage({data:JSON.stringify(rounds.end(round.code,'owner'))}));
    expect(textarea.disabled).toBe(true);
    expect(button('Upvote question').disabled).toBe(true);
    expect(host.textContent).toContain('Questions and moderation are frozen.');
  } finally {
    await act(async()=>root.unmount());host.remove();globalThis.fetch=originalFetch;
    for (const key of Object.keys(globals)) {if(previous[key])Object.defineProperty(globalThis,key,previous[key]!);else Reflect.deleteProperty(globalThis,key);}
    await window.happyDOM.close();
  }
});
