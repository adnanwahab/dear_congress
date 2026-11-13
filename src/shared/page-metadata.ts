import { CIVIC_STAGES } from './civic-stages';
export const SITE_URL = "https://civic-synthesis.fly.dev";
export const SITE_NAME = "Civic Synthesis";
export const DEFAULT_DESCRIPTION = "Share everyday needs, discuss citizen proposals, and explore advisory votes and illustrative civic plans.";

export const PAGE_TITLES: Record<string, string> = {
  "/map": "County map",
  "/documentation": "Documentation", "/docs": "Documentation",
  "/journals": "Journal", "/api-docs": "Journal API",
  "/privacy": "Privacy & removal",
  "/": "Journal", "/journal": "Journal", "/needs": "Shared needs",
  "/proposals/new": "Propose a law",
  "/synth": "Explore civic plans", "/embed": "Civic synthesis demo",
  ...Object.fromEntries(CIVIC_STAGES.map(s => [s.route, s.title])),
  "/vote": "Votes",
};

export function pageTitle(path: string) {
  return `${PAGE_TITLES[path] ?? SITE_NAME} | ${SITE_NAME}`;
}
