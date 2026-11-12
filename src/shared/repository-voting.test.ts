import { test, expect } from 'bun:test';
import { votingRoute, isRepoKey } from './repository-voting';
test('legacy, detail, view and exact allowlist routing',()=>{
 expect(votingRoute({pathname:'/vote',search:''})).toMatchObject({repoKey:'happybearlandia',kind:'pr'});
 for(const repoKey of ['dear_congress','happybearlandia','digital_pensieve']){
  expect(votingRoute({pathname:`/vote/${repoKey}`,search:'?view=issues'})).toMatchObject({repoKey,kind:'issue',number:undefined});
  expect(votingRoute({pathname:`/vote/${repoKey}/pr/7`,search:'?view=issues'})).toMatchObject({repoKey,kind:'pr',number:'7'});
  expect(votingRoute({pathname:`/vote/${repoKey}/issue/7`,search:''})).toMatchObject({repoKey,kind:'issue',number:'7'});
 }
 expect(isRepoKey('__proto__')).toBe(false);expect(votingRoute({pathname:'/vote/evil',search:''})).toBeNull();
});
