import { expect, test } from 'bun:test';
import { deleteJourneyEntry, JOURNEY_KEY, readJourney, saveJourneyEntry, type JourneyEntry } from './civic-journey';
function store() { const data = new Map<string,string>(); return { data, getItem: (k:string) => data.get(k) ?? null, setItem: (k:string,v:string) => { data.set(k,v); }, removeItem: (k:string) => { data.delete(k); } }; }
const entry: JourneyEntry = { id: 'one', savedAt: '2026-11-14T12:00:00Z', category: 'Explicit votes', kind: 'Citizen advisory activity', text: 'Self-recorded support for citizen proposal one' };
test('private history survives reload, isolates categories and deletes only selected local notes', () => {
 const s=store(); s.setItem('ballots','unchanged'); s.setItem('drafts','unchanged');
 expect(readJourney(s)).toEqual([]);
 saveJourneyEntry(s,entry); saveJourneyEntry(s,{...entry,id:'two',category:'Sandbox runs',kind:'Model simulation'});
 expect(readJourney(s).map(e=>e.id)).toEqual(['two','one']);
 deleteJourneyEntry(s,'one'); expect(readJourney(s).map(e=>e.id)).toEqual(['two']);
 s.removeItem(JOURNEY_KEY); expect(readJourney(s)).toEqual([]);
 expect(s.getItem('ballots')).toBe('unchanged'); expect(s.getItem('drafts')).toBe('unchanged');
});
test('corrupt or inaccessible storage is preserved and invalid source classifications rejected', () => {
 const s=store(); s.setItem(JOURNEY_KEY,'{broken');
 expect(()=>saveJourneyEntry(s,entry)).toThrow(); expect(()=>deleteJourneyEntry(s,'one')).toThrow(); expect(s.getItem(JOURNEY_KEY)).toBe('{broken');
 s.removeItem(JOURNEY_KEY);
 expect(()=>saveJourneyEntry(s,{...entry,kind:'verified' as any})).toThrow(); expect(s.getItem(JOURNEY_KEY)).toBeNull();
 expect(()=>readJourney({...s,getItem:()=>{throw Error('denied');}})).toThrow('denied');
 expect(()=>saveJourneyEntry({...s,setItem:()=>{throw Error('full');}},entry)).toThrow('full');
});
