import { test, expect } from 'bun:test';
import { LiveRounds } from './live-rounds';

function fixture() {
  const rounds = new LiveRounds();
  const {code} = rounds.start('demo-housing', 'owner');
  const submit = (text:string, author?:string) => rounds.question(code, 'phone', {kind:'submit',text,author});
  const owner = () => rounds.snapshot(code,'owner');
  const approve = (id:string) => rounds.question(code,'owner',{kind:'approve',id});
  return { rounds, code, submit, owner, approve };
}

test('moderates text and optional names, groups only approved duplicates, preserves vote and round isolation', () => {
  const {rounds,code,submit,owner,approve} = fixture();
  submit('More buses?', 'Alex'); submit('MORE buses!');
  expect(rounds.snapshot(code,'phone').board.questions).toEqual([]);
  const pending = owner().board.questions;
  expect(pending[0]?.author).toBe('Alex'); expect(pending[1]?.author).toBeUndefined();
  expect(() => rounds.question(code,'phone',{kind:'approve',id:pending[0]!.id})).toThrow('Only the starting browser');
  approve(pending[0]!.id); approve(pending[1]!.id);
  const board = rounds.snapshot(code,'phone').board;
  expect(board.questions).toHaveLength(1);
  expect(board.questions[0]).toMatchObject({text:'More buses?',author:'Alex',duplicates:2,status:'approved'});
  const id = board.questions[0]!.id;
  rounds.question(code,'phone',{kind:'upvote',id}); rounds.question(code,'phone',{kind:'upvote',id});
  expect(rounds.snapshot(code,'phone').board.questions[0]!.upvotes).toBe(1);
  expect(rounds.snapshot(code,'phone').total).toBe(0);
  expect(rounds.snapshot(code,'phone').item.support).toBe(0);
  rounds.vote(code,'phone',-1);
  expect(rounds.snapshot(code,'phone').total).toBe(1);
  const other = rounds.start('demo-housing','owner');
  expect(other.board.questions).toEqual([]);
  expect(() => rounds.question(other.code,'owner',{kind:'approve',id})).toThrow('not found');
  expect(JSON.stringify(owner().board)).not.toContain('supporters');
  expect(JSON.stringify(owner().board)).not.toContain('reporters');
});

test('least-shown rotation ignores popularity; reports are private to presenter and hiding clears screen', () => {
  const {rounds,code,submit,owner,approve} = fixture();
  submit('First?'); submit('Second?'); submit('Third?');
  for (const q of owner().board.questions) approve(q.id);
  const ids = owner().board.questions.map(q=>q.id);
  for (let i=0;i<10;i++) rounds.question(code,'fan'+i,{kind:'upvote',id:ids[0]!});
  const seen:string[] = [];
  for (let i=0;i<6;i++) seen.push(rounds.question(code,'owner',{kind:'next'}).board.current!);
  expect(seen).toEqual([...ids,...ids]);
  rounds.question(code,'phone',{kind:'report',id:ids[2]!});
  rounds.question(code,'phone',{kind:'report',id:ids[2]!});
  expect(owner().board.questions[2]!.reports).toBe(1);
  expect(rounds.snapshot(code,'other').board.questions[2]!.reports).toBeUndefined();
  expect(rounds.snapshot(code,'phone').board.questions[2]!.reported).toBe(true);
  expect(() => rounds.question(code,'phone',{kind:'next'})).toThrow('Only the starting browser');
  rounds.question(code,'owner',{kind:'hide',id:ids[2]!});
  expect(owner().board.current).toBeUndefined();
  expect(rounds.snapshot(code,'phone').board.questions).toHaveLength(2);
  expect(() => rounds.question(code,'phone',{kind:'report',id:ids[2]!})).toThrow('not found');
});

test('bounds inputs and submissions and freezes board on end or expiry', () => {
  const {rounds,code,submit} = fixture();
  expect(() => submit(' ')).toThrow(); expect(() => submit('?')).toThrow();
  expect(() => submit('x'.repeat(501))).toThrow(); expect(() => submit('Valid?', 'x'.repeat(61))).toThrow();
  expect(() => rounds.question(code,'phone',{kind:'submit',text:32} as any)).toThrow();
  expect(() => rounds.question(code,'phone',{kind:'nope'} as any)).toThrow();
  for (let i=0;i<5;i++) submit('Question '+i);
  expect(() => submit('Sixth?')).toThrow('limit');
  rounds.end(code,'owner'); expect(() => submit('After end?')).toThrow('ended');
  expect(() => rounds.question(code,'owner',{kind:'next'})).toThrow('ended');
  let now=1; const expiring=new LiveRounds(()=>now);const round=expiring.start('demo-housing','owner');
  now=round.expiresAt; expect(() => expiring.question(round.code,'phone',{kind:'submit',text:'Late?'})).toThrow('ended');
});

test('question changes reach existing live stream with private pending projection', async () => {
  const {rounds,code,submit} = fixture();
  const controller=new AbortController();
  const owner=rounds.events(code,'owner',controller.signal).body!.getReader();
  const phone=rounds.events(code,'phone',controller.signal).body!.getReader();
  try {
    await owner.read(); await phone.read(); submit('Private until approved?', 'Name');
    const ownerMessage=new TextDecoder().decode((await owner.read()).value);
    const phoneMessage=new TextDecoder().decode((await phone.read()).value);
    expect(ownerMessage).toContain('Private until approved?'); expect(phoneMessage).not.toContain('Private until approved?');
  } finally { controller.abort(); }
});


test('presenter can group differently worded duplicates into an approved group only', () => {
  const {rounds,code,submit,owner,approve} = fixture();
  submit('More buses?'); submit('Will bus service run later?');
  const [first,second] = owner().board.questions;
  expect(() => rounds.question(code,'owner',{kind:'approve',id:second!.id,groupId:first!.id})).toThrow('approved question');
  approve(first!.id);
  rounds.question(code,'owner',{kind:'approve',id:second!.id,groupId:first!.id});
  expect(owner().board.questions).toHaveLength(1);
  expect(owner().board.questions[0]!.duplicates).toBe(2);
});

test('question API retains origin, signed identity, JSON and rate-limit boundary', async () => {
  const { createPublicSecurity, publicHandler } = await import('./public-security');
  const security = createPublicSecurity({PUBLIC_IP_LIMIT:'4'});
  const {rounds,code,owner} = fixture();
  const request = (body:string, origin?:string) => new Request('https://example.test/api/live/'+code+'/questions', {
    method:'POST', headers:{'content-type':'application/json','x-voter-id':'owner',...(origin ? {origin}: {})}, body,
  });
  const handle = (req:Request) => publicHandler(security,'/api/live/:code/questions','POST',req,'127.0.0.1',async()=>Response.json(rounds.question(code,req.headers.get('x-voter-id')!,await req.json())));
  expect((await handle(request(JSON.stringify({kind:'submit',text:'Cross-origin?'}),'https://evil.test'))).status).toBe(403);
  expect(owner().board.questions).toHaveLength(0);
  expect((await handle(request('null'))).status).toBe(400);
  const posted=await handle(request(JSON.stringify({kind:'submit',text:'Valid question?'})));
  expect(posted.status).toBe(200);
  expect(posted.headers.get('set-cookie')).toContain('HttpOnly');
  expect(posted.headers.get('cache-control')).toBe('no-store');
  expect((await posted.json()).board.questions).toEqual([]);
  const id=owner().board.questions[0]!.id;
  expect((await handle(request(JSON.stringify({kind:'approve',id})))).status).toBe(403);
  expect((await handle(request(JSON.stringify({kind:'submit',text:'Limited?'})))).status).toBe(429);
});
