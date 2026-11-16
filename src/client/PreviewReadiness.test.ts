import { test, expect } from 'bun:test';
test('diagnostics expansion and refresh preserve votes and expose permission/stale states',async()=>{
 const child=Bun.spawn([process.execPath,'scripts/verify-preview-readiness-ui.tsx'],{stdout:'pipe',stderr:'pipe'});
 const [code,stdout,stderr]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);
 expect({code,stderr}).toEqual({code:0,stderr:''});expect(stdout).toContain('PASS diagnostics');
});
