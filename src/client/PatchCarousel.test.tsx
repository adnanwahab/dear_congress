import { expect, test } from 'bun:test';
test('carousel compares blocked, checks-pending and review-ready PRs without writes', async () => {
 const child=Bun.spawn([process.execPath,'scripts/verify-patch-carousel.tsx'],{stdout:'pipe',stderr:'pipe'});
 const [code,stdout,stderr]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);
 expect({code,stderr}).toEqual({code:0,stderr:''});expect(stdout).toContain('PASS carousel');
});
