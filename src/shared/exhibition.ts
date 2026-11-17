import { billCollection, type CatalogBill } from './bill-catalog';
export const PANEL_ROLES = ['question', 'proposal', 'counterargument', 'evidence', 'results'] as const;
export type PanelRole = typeof PANEL_ROLES[number];
export type ExhibitPanel = { role: PanelRole; id: string; revision: string };
export type Exhibit = { version: 1; panels: ExhibitPanel[] };
export function panelText(role: PanelRole, bill: CatalogBill) {
  return ({ question: bill.problem, proposal: bill.proposedChange, counterargument: bill.safeguards,
    evidence: 'Evidence not yet assessed. This concept has no verified supporting evidence.',
    results: `Proposed success metrics only; no measured results: ${bill.metrics}` })[role];
}
export function readExhibit(raw: string | null): Exhibit | null {
  try {
    if (!raw || raw.length > 6000) return null;
    const value = JSON.parse(raw);
    if (value.version !== 1 || !Array.isArray(value.panels) || value.panels.length !== 5) return null;
    if (!PANEL_ROLES.every(role => value.panels.filter((p: ExhibitPanel) => p?.role === role).length === 1)) return null;
    if (!value.panels.every((p: ExhibitPanel) => billCollection.bills.some(b => b.id === p.id && b.revision === p.revision))) return null;
    return { version: 1, panels: PANEL_ROLES.map(role => { const p = value.panels.find((p: ExhibitPanel) => p.role === role); return { role, id: p.id, revision: p.revision }; }) };
  } catch { return null; }
}
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** Standalone read-only document: no scripts, forms, tracking, storage or remote assets. */
export function exhibitDocument(exhibit: Exhibit, origin: string) {
  const valid = readExhibit(JSON.stringify(exhibit));
  const base = new URL(origin);
  if (!valid || !['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('Invalid exhibit');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Civic exhibition · hypothetical</title><style>body{max-width:70ch;margin:auto;padding:1rem;font:1rem/1.6 system-ui;overflow-wrap:anywhere}a{color:#0645ad}a:focus-visible{outline:3px solid #805000}article{border-top:1px solid;padding-block:1rem}</style><body><a href="#panels">Skip to panels</a><h1>Civic exhibition</h1><p>Hypothetical / unreviewed editorial concepts. Not legislation, verified evidence or measured outcomes. Search this document with your browser’s Find command. Use Tab to select links.</p><nav aria-label="Panels">${valid.panels.map(p => `<a href="#${p.role}">${p.role}</a>`).join(' · ')}</nav><main id="panels">${valid.panels.map(p => {
    const b = billCollection.bills.find(b => b.id === p.id)!;
    return `<article id="${p.role}" tabindex="0"><h2>${p.role}: ${escape(b.title)}</h2><p>Hypothetical</p><p>${escape(panelText(p.role, b))}</p><a href="${escape(base.origin)}/bills/${b.id}">Catalog source · ${b.id}</a><p>Pinned revision: ${b.revision}. Live source may change; this document preserves the selected text.</p></article>`;
  }).join('')}</main></body></html>`;
}
