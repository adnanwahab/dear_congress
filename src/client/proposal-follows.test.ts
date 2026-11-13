import { test, expect } from 'bun:test';
import { FOLLOW_KEY, readFollows, toggleFollow, observeFollow, writeFollows, type FollowSource } from './proposal-follows';
function memory() { const data = new Map<string,string>(); return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string,v: string) => { data.set(k,v); } }; }
const source: FollowSource = {kind:'sample',id:'same',title:'Bus pilot',text:'Run for twelve months'};
test('following persists, is reversible, isolates kinds and excludes ballot and identity fields', () => {
 const storage=memory();
 const payload={...source,ownVote:'oppose',accountId:'secret',journal:'private'};
 toggleFollow(storage,payload,'2026-11-13');
 expect(readFollows(storage)[0]!.source).toEqual(source);
 expect(storage.getItem(FOLLOW_KEY)).not.toContain('secret');
 expect(storage.getItem(FOLLOW_KEY)).not.toContain('oppose');
 toggleFollow(storage,{...source,kind:'citizen'});
 expect(readFollows(storage)).toHaveLength(2);
 toggleFollow(storage,source); expect(readFollows(storage)[0]!.source.kind).toBe('citizen');
 writeFollows(storage,[]); expect(readFollows(storage)).toEqual([]);
});
test('changed version retains exact text and duplicate observations do not rewrite the event', () => {
 const storage=memory(); toggleFollow(storage,source);
 const next={...source,text:'Run for eighteen months'};
 observeFollow(storage,next,'first'); observeFollow(storage,next,'duplicate');
 expect(readFollows(storage)[0]).toMatchObject({previousText:source.text,source:next,observedAt:'first'});
});
test('absent or withdrawn sources are not fabricated into progress or removed from saved follows', () => {
 const storage=memory(); toggleFollow(storage,source);
 // No authoritative withdrawal/deletion feed exists: unrelated observations cannot infer one.
 observeFollow(storage,{...source,id:'unrelated'});
 expect(readFollows(storage)[0]).toMatchObject({source,observedAt:null,previousText:null});
});
test('corrupt and blocked storage fail without replacing existing data', () => {
 const storage=memory(); storage.setItem(FOLLOW_KEY,'broken');
 expect(()=>toggleFollow(storage,source)).toThrow(); expect(storage.getItem(FOLLOW_KEY)).toBe('broken');
 const blocked={getItem:()=>null,setItem:()=>{throw Error('denied');}};
 expect(()=>toggleFollow(blocked,source)).toThrow('denied');
});
