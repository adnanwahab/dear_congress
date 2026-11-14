import {test,expect} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {LawBehaviorExplorer,parseLawBehaviorReceipt,actualActorDifferences,type LawBehaviorReceipt} from './LawBehaviorExplorer';

const realShape:LawBehaviorReceipt={
  schemaVersion:'hbl-law-behavior-receipt.v1',status:'completed',
  law:{id:'law-83',number:83,title:'Bus frequency'},engine:'population',unit:'minute',
  manifest:{modelVersion:'population-test',seed:42,population:12,implementationStrength:.5,
    pairedInitialState:true,start:0,end:15,recordedCheckpoints:2,
    scope:'fixed synthetic world; not linked to caller’s policy package'},
  frames:[
    {time:0,baseline:{metrics:{trips:0},actors:[
      {id:'p0',label:'Resident 1',mode:'walk',activity:'home',x:1,z:2}
    ]},edited:{metrics:{trips:0},actors:[
      {id:'p0',label:'Resident 1',mode:'walk',activity:'home',x:1,z:2}
    ]}},
    {time:15,baseline:{metrics:{trips:1,meanCommuteMinutes:17},actors:[
      {id:'p0',label:'Resident 1',mode:'walk',activity:'work',x:14,z:12}
    ]},edited:{metrics:{trips:1,meanCommuteMinutes:12},actors:[
      {id:'p0',label:'Resident 1',mode:'bus',activity:'work',x:20,z:12}
    ]}}
  ],limitations:['Synthetic outcomes are not empirical forecasts.']
};
const duplicate=(v:unknown)=>JSON.parse(JSON.stringify(v)) as unknown;

test('native receipt accepts genuinely paired sampled positions and identifies actual changed actor fields',()=>{
  const parsed=parseLawBehaviorReceipt(duplicate(realShape));
  expect(parsed.frames.length).toBe(2);
  expect(parsed.manifest?.seed).toBe(42);
  expect(parsed.frames[1]?.baseline.metrics.meanCommuteMinutes).toBe(17);
  expect(parsed.frames[1]?.edited.metrics.meanCommuteMinutes).toBe(12);
  const changed=actualActorDifferences(parsed.frames[1],parsed.engine);
  expect(changed).toHaveLength(1);
  expect(changed[0]).toMatchObject({id:'p0',fields:['mode','x']});
  expect(actualActorDifferences(parsed.frames[0],parsed.engine)[0]?.fields).toEqual([]);
});

test('unmatched synthetic actor IDs never fabricate a before/after resident match',()=>{
  const revised={...realShape.frames[1]!,edited:{metrics:{trips:1},actors:[{id:'other',x:3,z:4}]}};
  expect(actualActorDifferences(revised,'population')).toEqual([]);
  expect(actualActorDifferences(undefined,'city')).toEqual([]);
  const house={
    ...realShape.frames[0]!,
    baseline:{metrics:{},actors:[{id:'h0',savings:120,unitId:'u0',unhoused:false}]},
    edited:{metrics:{},actors:[{id:'h0',savings:150,unitId:'u0',unhoused:false}]}
  };
  expect(actualActorDifferences(house,'city')[0]?.fields).toEqual(['savings']);
});

test('invalid or unpaired model receipts fail closed instead of filling unknown effects',()=>{
  const shape=duplicate(realShape) as LawBehaviorReceipt;
  for(const altered of [
    {...shape,schemaVersion:'arbitrary.v2'},
    {...shape,status:'pending'},
    {...shape,manifest:{...shape.manifest,pairedInitialState:false}},
    {...shape,frames:[]},
    {...shape,frames:[shape.frames[0],shape.frames[0]]},
    {...shape,frames:[...Array(101).fill(shape.frames[0])]},
    {...shape,frames:[{...shape.frames[0],baseline:{metrics:{},actors:[...Array(13).fill({id:'synthetic'})]}}]}
  ])expect(()=>parseLawBehaviorReceipt(altered)).toThrow();
  const unavailable=parseLawBehaviorReceipt({
    schemaVersion:'hbl-law-behavior-receipt.v1',status:'mechanism-unavailable',
    law:{id:'law-31',number:31,title:'Unmodeled'},frames:[],reason:'No reviewed mechanism.'
  });
  expect(unavailable.status).toBe('mechanism-unavailable');
  expect(unavailable.frames).toEqual([]);
});

test('simulation first-load shows native accessible controls with explicit separate-model disclosure, no iframe or images',()=>{
  const html=renderToStaticMarkup(<LawBehaviorExplorer seed={42} hblOrigin="https://happybearlandia.fly.dev"/>);
  expect(html).toContain('Watch a law change simulated behavior');
  expect(html).toContain('your frozen civic package is not automatically applied');
  expect(html).toContain('Run two simulated worlds');
  expect(html).toContain('Implementation strength');
  expect(html).toContain('reviewed mechanism sandbox');
  expect(html).not.toContain('<iframe');
  expect(html).not.toContain('<img');
  expect(html).toContain('83 · Transit frequency');
});
