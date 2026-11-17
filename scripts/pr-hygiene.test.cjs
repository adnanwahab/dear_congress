'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {inspect,mode}=require('./pr-hygiene.cjs');
const h='adnanwahab/happybearlandia',d='adnanwahab/dear_congress',f=(filename,status='added',other={})=>({filename,status,...other});
test('coordinator ownership',()=>{
 assert.equal(inspect(h,'mini/SHE-674',[f('docs/implementation-plan.md')]).length,1);
 assert.equal(inspect(d,'mini/SHE-1',[f('readme.md'),f('src/client/public-guide.ts')]).length,2);
 assert.deepEqual(inspect(h,'mini/SHE-674',[f('docs/reviews/SHE-674.md')]),[]);
 assert.deepEqual(inspect(h,'integration/plan',[f('docs/implementation-plan.md')]),[]);
});
test('browser artifacts and retained golden fixtures',()=>{
 assert.equal(inspect(h,'feature/x',[f('.mini-symphony-evidence/after.png'),f('test/test-results/.last-run.json')]).length,2);
 assert.equal(inspect(d,'mini/x',[f('artifacts/shot.png')]).length,1);
 assert.deepEqual(inspect(d,'mini/x',[f('.mini-symphony-evidence/old.png','removed')]),[]);
 assert.deepEqual(inspect(d,'mini/x',[f('tests/visual/baselines/linux/a.png')]),[]);
});
test('rename and migration boundary',()=>{
 assert.equal(inspect(h,'mini/x',[f('docs/reviews/new.md','renamed',{previous_filename:'docs/implementation-plan.md'})]).length,1);
 assert.equal(mode('2026-11-17T10:30:00Z'),'warn');
 assert.equal(mode('2026-11-17T11:00:00Z'),'enforce');
 assert.throws(()=>inspect(h,'mini/x',[{filename:'a'}]));
});
