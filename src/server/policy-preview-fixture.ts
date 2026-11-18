import { makeVersion, createPreview, digest } from './policy-preview';
import { HOUSING_DEMO_TITLE, HOUSING_DEMO_TEXT, type ProposalVersionData } from '../shared/policy-preview';
import type { CitizenProposalRecord } from '../shared/citizen-proposals';
/** Explicit development-only fixture. Never persisted or submitted to HBL. */
export function policyPreviewFixture(): ProposalVersionData {
  const p: CitizenProposalRecord = { id: 'demo-housing-fixture', title: HOUSING_DEMO_TITLE, problem: 'UI testing only', proposedChange: HOUSING_DEMO_TEXT[0], jurisdiction: 'city', ownerHash: digest('citizen-voter:fixture-owner'), publishKeyHash: '', bodyHash: '', votesByVoterHash: {}, comments: [], createdAt: '2026-11-18T00:00:00.000Z', publishedAt: '2026-11-18T00:00:00.000Z', provenance: 'synthetic' };
  p.legalVersions = [makeVersion(p,1,p.title,'bill',[{clauseId:'section-0',text:HOUSING_DEMO_TEXT[0]}]),makeVersion(p,2,p.title,'bill',[{clauseId:'section-0',text:HOUSING_DEMO_TEXT[0]},{clauseId:'section-1',text:HOUSING_DEMO_TEXT[1]}])];
  const preview = createPreview(p,'fixture-owner',2,{baseVersion:1,confirmedPublicTransfer:true},'http://localhost');
  preview.status = 'completed'; preview.url = '/policy-preview-fixture'; preview.message = 'LOCAL FIXTURE: illustrative UI data, not an HBL run.';
  preview.results = { receivedAt: p.createdAt, data: { fixture: true, mechanism: 'section-1 → h_lots → illustrative permitting timeline', timeline: [{month:0,baseline:100,proposal:100},{month:60,baseline:100,proposal:110},{month:120,baseline:100,proposal:120}] } };
  return {versions:p.legalVersions,previews:[preview],canEdit:false,provenance:'synthetic'};
}
export const fixtureViewer = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>LOCAL FIXTURE · housing comparison</title><body style="font:18px system-ui;padding:24px;background:#eff5ef;color:#123b2d"><h1>LOCAL FIXTURE · not simulation results</h1><p>Illustrative baseline and proposal UI, not a prediction or HBL run.</p><label>Month <input id="month" type="range" min="0" max="120" value="0"></label><p id="value" aria-live="polite">Month 0 · Baseline 100 · Proposal 100</p><h2>Why did this happen?</h2><p>Legal section-1 → h_lots mechanism assumption → illustrative housing permits index.</p><p>Real synchronized worlds, reviewed parameters, explanations and outcomes belong to HBL.</p><script src="/policy-preview-fixture.js"></script></body></html>`;
export const fixtureScript = `const slider=document.getElementById('month');slider.addEventListener('input',()=>{document.getElementById('value').textContent='Month '+slider.value+' · Baseline 100 · Proposal '+(100+Number(slider.value)/6).toFixed(1);});`;
