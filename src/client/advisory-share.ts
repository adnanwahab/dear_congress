import { DEMO_ITEMS } from '../engine/demo';
import { provenanceText } from './ProposalProvenance';

export const SHARE_NOTICE = 'Non-binding advisory action · not an official election';
const STANCES = new Map([[1, 'Support'], [-1, 'Oppose'], [0, 'Not sure']]);

/** Only repository-curated public sample fields enter the export. No payload spread. */
export async function decisionCard(id: string, stance?: number) {
  const item = DEMO_ITEMS.find(item => item.id === id);
  if (!item) throw new Error('Sample proposal unavailable');
  const content = [item.title, item.summary, item.currentText, item.proposedText, provenanceText(item)].join('\n\n');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  const version = `sha256:${Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('')}`;
  const chosen = stance === undefined ? undefined : STANCES.get(stance);
  const text = [SHARE_NOTICE, 'Fictional sample proposal · no live activity, illustrative tallies or model simulation results included.',
    'Source repository: adnanwahab/dear_congress · kind: sample scenario', `Proposal: ${item.id}`, item.title,
    `Content version: ${version}`, item.summary, `Proposed text: ${item.proposedText}`, provenanceText(item),
    ...(chosen ? [`Optional chosen stance: ${chosen}. This card is not proof of a saved vote.`] : [])].join('\n\n');
  return { text, version, svg: cardSvg(text) };
}

function escapeXml(text: string) {
  return text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
}
export function cardSvg(text: string) {
  // Fixed-length wrapping also bounds unbroken version digests and URLs.
  const lines = text.split('\n').flatMap(line => line.match(/.{1,64}/gu) ?? ['']);
  const height = 64 + lines.length * 25;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="${height}" viewBox="0 0 960 ${height}" role="img" aria-labelledby="title description"><title id="title">${escapeXml(SHARE_NOTICE)}</title><desc id="description">${escapeXml(text)}</desc><rect width="960" height="${height}" fill="#f7f6f0"/><g fill="#162e41" font-family="monospace" font-size="21">${lines.map((line, i) => `<text x="32" y="${40 + i * 25}">${escapeXml(line)}</text>`).join('')}</g></svg>`;
}
