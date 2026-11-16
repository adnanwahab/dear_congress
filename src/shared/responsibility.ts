/** Educational institutional roles, never a proposal-specific authority determination. */
export type ResponsibilityRole = 'Writes' | 'Authorizes' | 'Funds' | 'Implements';
export interface AuthorityStep { role: ResponsibilityRole; office: string; detail: string; source: string; publisher: string; }
export interface ResponsibilityPath { id: string; label: string; uncertainty: string; steps: AuthorityStep[]; }
const branches = 'https://www.usa.gov/branches-of-government';
const texas = 'https://www.tlc.texas.gov/docs/legref/legislativeprocess.pdf';
export const responsibilityPaths: ResponsibilityPath[] = [
  { id: 'federal', label: 'United States · federal', uncertainty: 'Federal authority does not establish local authority. State or local administration and grant conditions require separate review; courts may review legality.', steps: [
    { role: 'Writes', office: 'Congress · legislators and staff', detail: 'Draft proposed federal legislation.', source: branches, publisher: 'USAGov · legislative branch' },
    { role: 'Authorizes', office: 'Congress → President', detail: 'Legislation passes Congress for presidential action; a veto can return it to Congress. This simplified path does not show every procedure.', source: branches, publisher: 'USAGov · checks and balances' },
    { role: 'Funds', office: 'Congress → President', detail: 'Congress passes funding bills for presidential signature or veto. Authorization alone is not an appropriation.', source: 'https://www.usa.gov/federal-budget-process', publisher: 'USAGov · federal budget process' },
    { role: 'Implements', office: 'Executive departments and agencies', detail: 'The executive branch administers government programs within its legal authority. The responsible agency depends on the enacted policy.', source: branches, publisher: 'USAGov · executive branch' },
  ] },
  { id: 'texas', label: 'Texas · state', uncertainty: 'City, county, transit-district and federal powers can overlap. No city, county or transit-board authority is established here. Check the applicable statute, charter, funding agreement and operator before outreach.', steps: [
    { role: 'Writes', office: 'Texas legislators · drafting staff', detail: 'Ideas may come from residents; only a legislator introduces a bill. Legislative Council staff can help draft it.', source: texas, publisher: 'Texas Legislative Council · legislative process, page 1' },
    { role: 'Authorizes', office: 'Texas House and Senate → Governor', detail: 'Both chambers consider legislation before gubernatorial action. Signing, veto and becoming law without signature are possible paths.', source: texas, publisher: 'Texas Legislative Council · legislative process, pages 1–7' },
    { role: 'Funds', office: 'Texas Legislature · appropriations', detail: 'Treasury spending requires an appropriation made by law. A policy proposal is not funding approval.', source: 'https://tlc.texas.gov/docs/legref/TxConst.pdf#page=162', publisher: 'Texas Constitution · Article VIII, section 6' },
    { role: 'Implements', office: 'Executive officers · designated agencies', detail: 'The governor ensures laws are executed; the specific implementing agency must be established by applicable law.', source: 'https://tlc.texas.gov/docs/legref/TxConst.pdf#page=96', publisher: 'Texas Constitution · Article IV, section 10' },
  ] },
];
