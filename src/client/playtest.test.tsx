import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PublicPull } from '../shared/hbl-governance';
import { PatchPlaytest } from './PatchPlaytest';
import { approvedPlaytestUrl, playtestReport, playtestStatus } from './playtest';
const repo='adnanwahab/happybearlandia';
const pull:PublicPull={number:2,repositoryId:1364565814,title:'Patch',body:'',author:'dev',url:`https://github.com/${repo}/pull/2`,updatedAt:'',headSha:'a'.repeat(40),base:'sprint/test',draft:false,state:'open',version:'revision-1',firstSeenAt:0,labels:[],tally:{yes:0,no:0,participation:0,feedback:0},eligibility:{eligible:false,state:'blocked',reason:'Base not allowed'},preview:{headSha:'a'.repeat(40),route:'/world',screenshotUrl:'/image',capturedAt:'now',exploreUrl:'https://hbl-pr-2-aaaaaaaa.fly.dev/world',deploymentVerifiedAt:'2026-11-14T00:00:00Z'}};
describe('revision-bound advisory playtests',()=>{
 for(const [state,status] of [['blocked','blocked'],['waiting-for-checks','checks-pending'],['approved','review-ready']] as const) test(`${status} PR retains evidence and independent exploration`,()=>{
  const p={...pull,eligibility:{...pull.eligibility,state}};
  expect(playtestStatus(p)).toBe(status);
  const html=renderToStaticMarkup(<PatchPlaytest pull={p} repository={repo} api="/api/hbl/pulls" disabledReason="Sign in with GitHub to participate." onSaved={()=>{throw Error('render cannot mutate');}}/>);
  expect(html).toContain(status);expect(html).toContain(p.headSha);expect(html).toContain('Open isolated revision preview');expect(html).toContain('Sign in with GitHub');expect(html).toContain('never casts a vote');
  for(const label of ['Desktop:','Mobile:','Keyboard:','Reduced motion:'])expect(html).toContain(label);
 });
 test('only exact-head operator origins launch; unknown scopes and revisions fail closed',()=>{
  expect(approvedPlaytestUrl(pull,repo)).toBe(pull.preview!.exploreUrl!);
  for(const exploreUrl of ['https://civic-synthesis.fly.dev/world','https://evil.test/world','https://hbl-pr-2-aaaaaaaa.fly.dev.evil.test/world','https://user@hbl-pr-2-aaaaaaaa.fly.dev/world','https://hbl-pr-2-aaaaaaaa.fly.dev/other'])expect(approvedPlaytestUrl({...pull,preview:{...pull.preview!,exploreUrl}},repo)).toBeNull();
  expect(approvedPlaytestUrl({...pull,headSha:'b'.repeat(40)},repo)).toBeNull();
  expect(approvedPlaytestUrl({...pull,kind:'issue'},repo)).toBeNull();
  expect(approvedPlaytestUrl(pull,'adnanwahab/dear_congress')).toBeNull();
  expect(approvedPlaytestUrl({...pull,preview:{...pull.preview!,deploymentVerifiedAt:undefined}},repo)).toBeNull();
 });
 test('public report freezes source, revision and explicitly supplied environment',()=>{
  const text=playtestReport(pull,repo,'Firefox / Linux / 390px / reduced',['Keyboard'],'Tab','Focus visible','Focus absent');
  for(const value of [repo,pull.headSha,pull.base,pull.version,'390px','Steps: Tab','Expected: Focus visible','Actual: Focus absent'])expect(text).toContain(value);
  expect(text.length).toBeLessThan(10000);
 });
});
