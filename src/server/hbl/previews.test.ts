import {test,expect} from 'bun:test';
import {previewFor,previewImage} from './previews';
import records from './previews.json';
test('screenshots and Fly links are pinned to the exact PR revision',async()=>{
 for(const record of records){const preview=previewFor(record.number,record.headSha)!;expect(preview).toBeDefined();expect(preview.headSha).toBe(record.headSha);expect(await Bun.file(previewImage(record.number,record.headSha)!).exists()).toBe(true);if(preview.exploreUrl)expect(new URL(preview.exploreUrl).hostname).toBe(`hbl-pr-${record.number}-${record.headSha.slice(0,8)}.fly.dev`);}
 expect(previewFor(2,'b'.repeat(40))).toBeUndefined();expect(previewImage(999,'a'.repeat(40))).toBeNull();
});
