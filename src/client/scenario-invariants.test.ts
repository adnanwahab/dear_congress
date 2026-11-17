import {test,expect} from 'bun:test';
import {checkScenario,type SimulatorInput} from './scenario-invariants';
const transit:SimulatorInput={lawId:83,seed:42,population:24,implementationStrength:.5,units:'fraction of reviewed implementation',horizon:720,clock:'minute'};
test('all reviewed controls have deterministic preflight and preserve draft bytes',()=>{
 for(const lawId of [21,22,23,83] as const){
  const input={...transit,lawId,implementationStrength:1,units:lawId===21?'discrete rule':'fraction of reviewed implementation',horizon:lawId===83?720:12,clock:lawId===83?'minute':'month'};
  const before=JSON.stringify(input);
  expect(checkScenario(input)).toEqual([]);
  expect(checkScenario(JSON.parse(before))).toEqual([]);
  expect(JSON.stringify(input)).toBe(before);
 }
});
test('domains, units, dependencies and missing mechanisms fail at exact controls',()=>{
 for(const seed of [-1,NaN,Infinity,4294967296,.5])expect(checkScenario({...transit,seed}).some(f=>f.control==='seed')).toBe(true);
 for(const implementationStrength of [-1,.1,NaN,1.1])expect(checkScenario({...transit,implementationStrength}).some(f=>f.control==='strength')).toBe(true);
 expect(checkScenario({...transit,lawId:21}).some(f=>f.control==='strength')).toBe(true);
 for(const patch of [{lawId:99},{units:'percent'},{clock:'month'},{horizon:721},{population:60},{legalText:'enact'}])expect(checkScenario({...transit,...patch}).some(f=>f.control==='law')).toBe(true);
 for(const value of [null,[],{},'law'])expect(checkScenario(value).length).toBeGreaterThan(0);
 expect(checkScenario({...transit,seed:0})).toEqual([]);
 expect(checkScenario({...transit,seed:4294967295})).toEqual([]);
});
