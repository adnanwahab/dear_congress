import { expect, test } from 'bun:test';
import { installRouteQuality } from './motion';
function setup(consent = true) {
  const target = new EventTarget();
  const frames: FrameRequestCallback[] = [];
  Object.assign(target, {
    localStorage: {getItem:()=>consent ? 'yes' : 'no'}, navigator: {},
    document: {startViewTransition:()=>{},documentElement:{dataset:{}}},
    matchMedia:()=>({matches:false}), performance:{now:()=>450},
    requestAnimationFrame:(callback:FrameRequestCallback)=>{frames.push(callback);return frames.length;}
  });
  const calls:unknown[][]=[];
  installRouteQuality(target as unknown as Window, (...args)=>{calls.push(args.slice(0,2));});
  const paint = () => { while(frames.length) frames.shift()!(0); };
  return {target, calls, paint};
}
test('route waits for real transition, records once and excludes BFCache restore', async () => {
  const {target,calls,paint}=setup();
  let complete!:()=>void;
  const finished = new Promise<void>(resolve=>{complete=resolve;});
  target.dispatchEvent(Object.assign(new Event('pagereveal'),{viewTransition:{finished}}));
  paint();
  expect(calls).toEqual([]);
  complete();await finished;await Promise.resolve();
  expect(calls).toEqual([['route_ready',450]]);
  target.dispatchEvent(Object.assign(new Event('pageshow'),{persisted:true}));
  target.dispatchEvent(new Event('pagereveal'));
  expect(calls).toHaveLength(1);
});
test('failed and abandoned route observations remain distinct; opt-out cancels pending observations', async () => {
  const failed=setup();
  failed.target.dispatchEvent(Object.assign(new Event('pagereveal'),{viewTransition:{finished:Promise.reject(Error('synthetic private text'))}}));
  await Promise.resolve();
  expect(failed.calls).toEqual([['route_failed',450]]);
  const abandoned=setup();
  abandoned.target.dispatchEvent(new Event('pagehide'));abandoned.paint();
  expect(abandoned.calls).toEqual([['route_abandoned',undefined]]);
  const optedOut=setup();
  optedOut.target.dispatchEvent(new Event('quality-consent'));optedOut.paint();
  expect(optedOut.calls).toEqual([]);
  const beforeConsent=setup(false);beforeConsent.paint();
  expect(beforeConsent.calls).toEqual([]);
});
