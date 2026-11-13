import { Window as TestWindow } from 'happy-dom';
import { expect, test } from "bun:test";
import { startPageViews } from "./page-views";

test("page views cover load, SPA navigation and back/forward without query, cookie or duplicate events", () => {
  const calls:RequestInit[]=[];
  const listeners = new Map<string,()=>void>();
  const location = {pathname:"/needs",search:"?secret=do-not-collect",hash:"#private"};
  const history = {
    pushState(_data:unknown,_unused:string,url?:string|URL|null) { if(url) location.pathname=new URL(url,"https://local").pathname; },
    replaceState(_data:unknown,_unused:string,url?:string|URL|null) { if(url) location.pathname=new URL(url,"https://local").pathname; },
  };
  const browser = {location,history,addEventListener:(name:string,callback:()=>void)=>listeners.set(name,callback)};
  const send = (url:RequestInfo|URL,init?:RequestInit) => {expect(url).toBe("/api/page-view");calls.push(init!);return Promise.resolve(new Response(null,{status:204}));};
  startPageViews(browser as unknown as Window,send as typeof fetch);
  history.replaceState({},"","/needs?different=query");
  history.pushState({},"","/synth?private=query");
  location.pathname="/needs";listeners.get("popstate")!();
  expect(calls.map(call=>JSON.parse(String(call.body)))).toEqual([{path:"/needs"},{path:"/synth"},{path:"/needs"}]);
  for(const call of calls) {expect(call.credentials).toBe("omit");expect(call.keepalive).toBe(true);expect(call.method).toBe("POST");}
});

test('speculative history changes do not count until activation', () => {
  const dom = new TestWindow();
  const page = dom.document as unknown as Document & { prerendering: boolean };
  page.prerendering = true;
  const location = { pathname: '/feed' };
  const history = { pushState() {}, replaceState() {} };
  const calls: string[] = [];
  const browser = { location, history, document: page, addEventListener() {} };
  startPageViews(browser as unknown as Window, ((_url, init) => {
    calls.push(String(init?.body)); return Promise.resolve(new Response());
  }) as typeof fetch);
  history.replaceState();
  expect(calls).toEqual([]);
  location.pathname = '/votes';
  page.prerendering = false;
  page.dispatchEvent(new dom.Event('prerenderingchange') as unknown as Event);
  page.dispatchEvent(new dom.Event('prerenderingchange') as unknown as Event);
  history.replaceState();
  expect(calls).toEqual([JSON.stringify({ path: '/votes' })]);
});
