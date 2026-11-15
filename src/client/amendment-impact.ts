/** Exact excerpts only: labels supplied by authors are not verified impact claims. */
export const impactCategories = ['Scope', 'Eligibility', 'Cost', 'Implementation', 'Uncertainties'] as const;
export interface ImpactAnchor { line: number; quote: string }
export function impactExcerpt(text: string, category: typeof impactCategories[number]): ImpactAnchor[] {
  return text.split('\n').flatMap((quote, index) =>
    quote.trimStart().toLowerCase().startsWith(`${category.toLowerCase()}:`) && quote.slice(quote.indexOf(':') + 1).trim()
      ? [{ line: index + 1, quote }] : []);
}
