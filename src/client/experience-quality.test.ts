import { expect, test } from 'bun:test';
import { qualityAllowed, recordQuality } from './experience-quality';
function browser() {
  const values = new Map<string,string>();
  return { values, target: { localStorage:{getItem:(key:string)=>values.get(key)}, navigator:{}, document:{}, matchMedia:()=>({matches:false}) } } as unknown as {values:Map<string,string>;target:Window};
}
test('no request before affirmative consent, after opt-out, with blocked storage or privacy preferences', async () => {
  const {values,target} = browser();
  const calls:RequestInit[]=[];
  const send = ((_url:unknown,init:RequestInit)=>{calls.push(init);return Promise.resolve(new Response());}) as typeof fetch;
  recordQuality('compare_opened',undefined,target,send);
  expect(calls).toHaveLength(0);
  values.set('civic-experience-metrics-v1','yes');
  recordQuality('route_ready',345,target,send);
  expect(calls).toHaveLength(1);
  expect(JSON.parse(calls[0]!.body as string)).toEqual({event:'route_ready',capability:'basic',duration:345});
  expect(calls[0]).toMatchObject({credentials:'omit',referrerPolicy:'no-referrer'});
  values.set('civic-experience-metrics-v1','no');
  recordQuality('demo_completed',undefined,target,send);
  expect(calls).toHaveLength(1);
  values.set('civic-experience-metrics-v1','yes');
  Object.assign(target.navigator,{doNotTrack:'1'});
  expect(qualityAllowed(target)).toBe(false);
  Object.assign(target.navigator,{doNotTrack:'0',globalPrivacyControl:true});
  expect(qualityAllowed(target)).toBe(false);
  Object.defineProperty(target,'localStorage',{get(){throw Error('blocked');}});
  expect(qualityAllowed(target)).toBe(false);
});
