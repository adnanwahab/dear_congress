import { test, expect } from 'bun:test';
import { LaunchStats, observePublicResponse, statsPage } from './launch-stats';
import { distributionMarker, DISTRIBUTION_TTL } from '../shared/distribution';

test('distribution vocabulary, expiry, route normalization and isolated aggregates', () => {
  const now = Date.now();
  const marker = {source:'newsletter',campaign:'launch',landing:'/proposals/private-id',expires:now + DISTRIBUTION_TTL};
  const stats = new LaunchStats(':memory:', () => now);
  try {
    expect(distributionMarker({...marker, source:'person@example.com'}, now)).toBeNull();
    expect(distributionMarker({...marker, expires:now}, now)).toBeNull();
    expect(distributionMarker({...marker, expires:now + DISTRIBUTION_TTL + 1}, now)).toBeNull();
    expect(stats.distribution({...marker,landing:'/admin/stats'},'landing')).toBe(false);
    expect(stats.distribution(marker,'landing')).toBe(true);
    expect(stats.snapshot().distribution).toEqual([{source:'newsletter',campaign:'launch',landing:'/proposals/:id',stage:'landing',count:1}]);
    expect(stats.snapshot().votes).toBe(0);
    expect(JSON.stringify(stats.snapshot())).not.toContain('private-id');
    expect(statsPage(stats.snapshot(),true)).toContain('Not unique people');
  } finally { stats.close(); }
});

test('only accepted real publication or civic vote can complete attribution', async () => {
  const stats = new LaunchStats(':memory:');
  const marker = {source:'community',campaign:'usefulness',landing:'/',expires:Date.now()+DISTRIBUTION_TTL};
  const observe = (result:unknown, status=200, header=JSON.stringify(marker)) => observePublicResponse(stats,new Request('https://local/api/journal',{method:'POST',headers:{'x-distribution':header},body:'{}'}),Response.json(result,{status}),()=>{throw new Error('stats failure');});
  try {
    for (const [result,status] of [[{id:'sample',seeded:true},200],[{id:'simulation',synthetic:true},200],[{entryId:'held'},202],[{error:'invalid'},400]] as const) expect((await observe(result,status)).headers.get('x-distribution-recorded')).toBeNull();
    expect(stats.snapshot().distribution).toEqual([]);
    expect((await observe({id:'real'})).headers.get('x-distribution-recorded')).toBe('1');
    expect((await observe({id:'other'},200,'invalid json')).headers.get('x-distribution-recorded')).toBeNull();
    expect(stats.snapshot().distribution).toEqual([{source:'community',campaign:'usefulness',landing:'/',stage:'interaction',count:1}]);
  } finally {stats.close();}
});
