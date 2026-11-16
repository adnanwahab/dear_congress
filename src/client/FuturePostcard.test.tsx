import {expect,test} from 'bun:test';
import {composeFuturePostcard,type PostcardFacts} from './FuturePostcard';
const facts:PostcardFacts={law:83,seed:42,strength:50,revision:2,model:'population.v1',time:30,clock:'minute',metric:'Mean planned travel',unit:'minutes/trip',baseline:20,edited:17};
test('postcard attaches measured pairs, reproducibility and synthetic warning to graphic and description',()=>{
 const card=composeFuturePostcard(facts);
 for(const text of ['Synthetic scenario / not forecast','Seed 42','50%','revision 2','population.v1','minute 30','20 → 17','-3']){
  expect(card.svg).toContain(text);expect(card.description).toContain(text);expect(card.alt).toContain(text);
 }
 expect(card.description).toContain('Not verified civic participation');
 expect(card.svg).not.toContain('<image');
});
test('export allowlist excludes extra private data and escapes model markup',()=>{
 const card=composeFuturePostcard({...facts,model:'<script>attack</script>',journal:'private journal sentinel',actors:['private actor']} as PostcardFacts);
 expect(card.svg).not.toContain('<script>');expect(card.svg).toContain('&lt;script&gt;');
 expect(JSON.stringify(card)).not.toContain('private journal sentinel');expect(JSON.stringify(card)).not.toContain('private actor');
 expect(()=>composeFuturePostcard({...facts,edited:NaN})).toThrow();
});
