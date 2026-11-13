export const SITE_URL = "https://civic-synthesis.fly.dev";
export const SITE_NAME = "Civic Synthesis";
export const DEFAULT_DESCRIPTION = "Share everyday needs, discuss citizen proposals, and explore advisory votes and illustrative civic plans.";

export const PAGE_TITLES: Record<string, string> = {
  "/map": "County map", "/published": "Published proposals", "/draft": "Policy drafts",
  "/sponsors": "Sponsor workflow", "/outcomes": "Measured outcomes",
  "/documentation": "Documentation", "/docs": "Documentation",
  "/journals": "Journal", "/api-docs": "Journal API",
  "/privacy": "Privacy & removal",
  "/": "Journal", "/journal": "Journal", "/needs": "Shared needs",
  "/vote": "Vote on goals and ideas", "/votes": "Citizen proposals & votes",
  "/feed": "Proposal feed", "/proposals/new": "Propose a law",
  "/synth": "Explore civic plans", "/embed": "Civic synthesis demo",
};

export function pageTitle(path: string) {
  return `${PAGE_TITLES[path] ?? SITE_NAME} | ${SITE_NAME}`;
}
