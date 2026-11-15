// Exact editorial fixture scope shared with the argument map. Never reused for real records.
export const PILOT_TEXT = 'Fund a twelve-month pilot of fifteen-minute service through 10 p.m. on three priority corridors, with quarterly public reporting.';
export const PILOT_SCOPE = 'adnanwahab/dear_congress:fictional-demo:demo-transit:v1';
export const EVIDENCE_QUESTIONS = [
  { id: 'access', question: 'Would evening riders reach jobs more reliably?', template: 'I would reconsider if quarterly corridor data showed [minimum improvement] in missed trips or access to jobs, compared with [baseline], over [time period], including [affected riders].' },
  { id: 'funding', question: 'Can added service be funded without reducing essential routes?', template: 'I would reconsider if a published operating plan identified [funding source and amount] for [time period], with [minimum service protection] for other essential routes and [independent review].' },
] as const;

export function evidenceUpdateUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
