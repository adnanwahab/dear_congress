import type { ProposalObjection } from './citizen-proposals';

export const HELIOS_SCHEMA = 'helios/v1' as const;
export const HELIOS_PROMPT = 'helios-neutral-drafts/v1' as const;
export const HELIOS_NO_CHANGE = { id: 'no-change', text: 'Retain the current proposal without amendment.' } as const;
export const HELIOS_ABSTENTION = { id: 'abstain', text: 'Decline to express a preference; no vote is inferred.' } as const;
export type HeliosScope = {
  repository: 'adnanwahab/dear_congress';
  itemId: string;
  revision: string;
} & (
  { itemKind: 'pull-request'; head: string; base: string } |
  { itemKind: 'citizen-proposal' | 'hfl'; head?: never; base?: never }
);
export interface HeliosConsent {
  receipt: string;
  revisionHash: string;
  generation: true;
  externalProcessing: boolean;
  publicOutput: true;
}
export interface HeliosSource {
  id: string;
  kind: 'proposal' | 'clause' | 'objection' | 'evidence' | 'private-journal';
  text: string;
  revisionHash: string;
  consent: HeliosConsent | null;
  /** Existing SHE-307 public projection only, never the persisted record. */
  objection?: ProposalObjection;
}
export interface HeliosRequest {
  schema: typeof HELIOS_SCHEMA;
  invokedByHuman: true;
  optedIn: true;
  scope: HeliosScope;
  sources: HeliosSource[];
}
export interface HeliosClaim { text: string; citations: string[] }
export interface HeliosDraft extends HeliosClaim {
  id: 'alternative-a' | 'alternative-b' | 'alternative-c';
  tradeoffs: HeliosClaim[];
}
export interface HeliosModelOutput {
  schema: typeof HELIOS_SCHEMA;
  sharedGoals: HeliosClaim[];
  objections: { sourceId: string; strongestCase: HeliosClaim }[];
  alternatives: HeliosDraft[];
  noChange: { id: 'no-change'; text: string };
  abstention: { id: 'abstain'; text: string };
  amendments: { clauseId: string; alternativeId: HeliosDraft['id']; replacement: string; tradeoffs: HeliosClaim[]; citations: string[] }[];
  uncertainty: string[];
  missingEvidence: string[];
}
export interface HeliosResult extends HeliosModelOutput {
  status: 'human-review-required';
  binding: false;
  scope: HeliosScope;
  provenance: {
    model: string;
    promptVersion: typeof HELIOS_PROMPT;
    generatedAt: string;
    fixture: boolean;
    sourceRevisionHash: string;
    sources: { id: string; kind: HeliosSource['kind']; revisionHash: string; consent: HeliosConsent }[];
  };
  /** Verbatim consented objections retained independently of model paraphrases. */
  unresolvedObjections: { sourceId: string; text: string; severity: ProposalObjection['severity']; responses: ProposalObjection['responses'] }[];
}
export type HeliosErrorCode = 'INVALID_INPUT' | 'CONSENT_REQUIRED' | 'INVALID_OUTPUT' | 'DISABLED' | 'RATE_LIMIT' | 'BUDGET_LIMIT' | 'TIMEOUT' | 'MODEL_UNAVAILABLE';
