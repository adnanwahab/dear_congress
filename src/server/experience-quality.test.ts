import { expect, test } from 'bun:test';
import { LaunchStats } from './launch-stats';
import { createStatsHTTP } from './launch-stats-http';
import { QUALITY_EVENTS, QUALITY_CAPABILITIES } from '../shared/experience-quality';

test('synthetic quality fixtures aggregate capability, bucket latency and expire independently of civic metrics', () => {
  let now = Date.parse('2026-11-14T12:00:00Z');
  const stats = new LaunchStats(':memory:', () => now);
  try {
    for (const capability of QUALITY_CAPABILITIES) for (const event of QUALITY_EVENTS) {
      expect(stats.quality({ event, capability, ...(event === 'route_ready' ? {duration:345} : {}) })).toBe(true);
    }
    stats.quality({event:'route_ready',capability:'basic',duration:400});
    expect(stats.qualitySnapshot().find(r => r.event === 'route_ready' && r.capability === 'basic')).toMatchObject({bucket:'101–500 ms',count:2});
    stats.vote({identity:'synthetic',scope:'test',target:'revision'});
    expect(stats.snapshot().votes).toBe(1);
    now += 30 * 86400000;
    expect(stats.qualitySnapshot()).toEqual([]);
    now -= 30 * 86400000;
    expect(stats.snapshot().votes).toBe(1);
  } finally { stats.close(); }
});

test('quality endpoint rejects private dimensions and invalid data and honors privacy headers', async () => {
  const stats = new LaunchStats(':memory:');
  const http = createStatsHTTP({stats,token:'test',healthy:()=>true,record:run=>run()});
  const signal = {event:'route_ready',capability:'basic',duration:250};
  const send = (body:unknown, headers:Record<string,string>={}, method='POST') => http.quality(new Request('https://local/api/experience-quality', {method,headers:{origin:'https://local','content-type':'application/json',...headers},...(method === 'POST' ? {body:JSON.stringify(body)} : {})}), '127.0.0.1');
  try {
    for (const field of ['stance','journal','location','identity','url','referrer','politicalOpinion']) {
      expect((await send({...signal,[field]:'private'})).status).toBe(400);
    }
    for (const invalid of [null,[],{}, {...signal,capability:'Chrome 135'}, {...signal,duration:-1}, {...signal,duration:120001}, {...signal,event:'model_failed'}]) expect((await send(invalid)).status).toBe(400);
    expect((await send(signal,{origin:'https://elsewhere'})).status).toBe(403);
    expect((await send(signal,{},'GET')).status).toBe(405);
    for (const headers of [{dnt:'1'},{'sec-gpc':'1'}] as Record<string,string>[]) expect((await send(signal,headers)).status).toBe(204);
    expect(stats.qualitySnapshot()).toEqual([]);
    const response = await send(signal);
    expect(response.status).toBe(204);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(stats.qualitySnapshot()).toHaveLength(1);
    const dashboard = await http.admin(new Request('https://local/admin/stats',{headers:{authorization:'Bearer test'}})).text();
    expect(dashboard).toContain('Experience quality');
    expect(dashboard).toContain('101–500 ms');
    expect(dashboard).not.toContain('<script');
  } finally {stats.close();}
});
