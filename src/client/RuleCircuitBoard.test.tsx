import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {RuleCircuitBoard} from './RuleCircuitBoard';
import {reviewedSimulatorInput,parseCivicLawContext,civicLawQuery} from './civic-law-context';
const context={lawId:83,implementationStrength:.5,seed:42,population:24 as const,revision:2,modelVersion:'population.v1'};
test('circuit distinguishes consumer links from unavailable causal events in all run states',()=>{
 for(const state of [{busy:false,error:''},{busy:true,error:''},{busy:false,error:'offline'}]){
  const html=renderToStaticMarkup(<RuleCircuitBoard context={context} receipt={null} {...state}/>);
  for(const text of ['Source data mode','Seed: 42','Model version','Horizon','Major uncertainty','Inferred link','Provider event schema: unavailable','do not prove real-world causality'])expect(html).toContain(text);
  expect(html).toContain('/blob/1305bc091550425a7c6b6038ce8afd3f6acf4d4f/');
  expect(html.match(/<summary>/g)).toHaveLength(3);
  expect(html).not.toContain('Reproduction receipt');
 }
});
test('scenario replay preserves version/revision and sends only validated simulator fields',()=>{
 const replay=parseCivicLawContext(civicLawQuery(context).toString())!;
 expect(replay).toEqual(context);
 expect(reviewedSimulatorInput(replay)).toEqual({lawId:83,implementationStrength:.5,seed:42,population:24});
 for(const patch of [{lawId:84},{lawId:21},{implementationStrength:.33},{seed:-1}])expect(()=>reviewedSimulatorInput({...context,...patch})).toThrow();
});
