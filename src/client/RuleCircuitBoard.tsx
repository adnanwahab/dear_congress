import {useId} from 'react';
import type {CivicLawContext} from './civic-law-context';
import {structuredAmendment} from './civic-law-context';
import type {LawBehaviorReceipt} from './LawBehaviorExplorer';

// This revision identifies the audited consumer, never the provider implementation.
const SOURCE='https://github.com/adnanwahab/dear_congress/blob/1305bc091550425a7c6b6038ce8afd3f6acf4d4f/';
const NODES=[
  {id:'input',title:'Reviewed input → bounded request',kind:'Coded consumer link',doc:'docs/live-law-behavior-loop.md',schema:'src/client/civic-law-context.ts',text:'Only laws 21, 22, 23 and 83 are selectable. Numeric strength uses quarter steps; law 21 is fixed. Population is 24. No legal prose is executed.'},
  {id:'mechanism',title:'Request → internal HBL mechanism',kind:'Inferred link · unverified',doc:'docs/live-law-behavior-loop.md',schema:'src/client/LawBehaviorExplorer.tsx',text:'The selected law names a reviewed mechanism, but this receipt supplies no implementation trace, event schema or event IDs. A path through internal engine rules cannot be established here.'},
  {id:'receipt',title:'Paired receipt → recorded output',kind:'Coded consumer link',doc:'docs/live-law-behavior-loop.md',schema:'src/client/LawBehaviorExplorer.tsx',text:'hbl-law-behavior-receipt.v1 validates paired initial states, ordered checkpoints and bounded actor records. Displayed differences subtract current-rule values from edited-rule values at the same recorded time.'},
] as const;

/** Static topology: expanding nodes never starts model work or invents events. */
export function RuleCircuitBoard({context,receipt,busy,error}:{context:CivicLawContext;receipt:LawBehaviorReceipt|null;busy:boolean;error:string}){
  const id=useId(),amendment=structuredAmendment(context);
  const manifest=receipt?.status==='completed'?receipt.manifest:null;
  return <section className="rule-circuit" aria-labelledby={`${id}-title`}>
    <h4 id={`${id}-title`}>Model rule circuit board</h4>
    <p>Source data mode: synthetic paired HBL model. Seed: {context.seed}. Model version: {manifest?.modelVersion||'unavailable until a validated run'}. Horizon: {manifest?`${manifest.start}–${manifest.end} ${receipt?.unit}s`:`up to ${amendment.horizon} ${amendment.clock}s (requested bound)`}.</p>
    <p>Major uncertainty: synthetic assumptions and sampled actors; no validated causal trace or real-world uncertainty interval. Model links do not prove real-world causality. These effects are not forecasts.</p>
    <p role="status">{busy?'Loading paired receipt; no output established.':error?'Failed run; no output established.':receipt?.status==='completed'?'Validated paired observations available.':receipt?.status==='mechanism-unavailable'?'Mechanism unavailable; no output established.':'Not run; no output established.'}</p>
    <ol className="rule-circuit-nodes">{NODES.map(node=><li key={node.id} className={node.id==='mechanism'?'rule-inferred':'rule-coded'}>
      <details><summary>{node.title} · {node.kind}</summary>
        <p>{node.text}</p>
        <p><a href={SOURCE+node.doc}>Versioned implementation documentation</a> · <a href={SOURCE+node.schema}>Versioned consumer contract</a></p>
        {node.id==='mechanism'&&<p>Provider event schema: unavailable in v1. No event chain is fabricated.</p>}
      </details>
    </li>)}</ol>
    {manifest&&<details><summary>Reproduction receipt (JSON)</summary><pre className="civic-law-draft">{JSON.stringify({schemaVersion:'civic-rule-circuit.v1',sourceDataMode:'synthetic',consumerSourceRevision:'1305bc091550425a7c6b6038ce8afd3f6acf4d4f',context,amendment,receipt},null,2)}</pre><p>Replay restores these inputs through the scenario link below and requires the same provider model version. Recorded checkpoints remain the evidence; matching a seed alone cannot guarantee reproduction across model versions.</p></details>}
  </section>;
}
