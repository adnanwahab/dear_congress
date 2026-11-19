import { TOPICS } from './topics';
import { CIVIC_STAGES } from './civic-stages';
export const SITE_URL = "https://civic-synthesis.fly.dev";
export const SITE_NAME = "Civic Synthesis";
export const DEFAULT_DESCRIPTION = "Explore 110 draft policy ideas for arts, science, health, learning, and a more creative civic future. Compare possibilities, understand safeguards, and participate in civic discussion.";

export const PAGE_TITLES: Record<string, string> = {
  "/topics": "Topic hubs",
  ...Object.fromEntries(TOPICS.map(t => [`/topics/${t.id}`, `${t.label} topic hub`])),
  "/account": "Participation & privacy",
  "/review": "Expert review center",
  "/helios": "HELIOS five-transformer ensemble",
  "/bills": "Draft bill catalog", // legacy deep links redirect to /votes at the HTTP edge
  "/map": "County map",
  "/documentation": "How Civic Synthesis works", "/docs": "How Civic Synthesis works",
  "/journals": "Journal", "/api-docs": "Journal API",
  "/privacy": "Privacy & removal",
  "/": "Civic Renaissance — 110 Bills for Human Flourishing", "/dashboard": "Original dashboard", "/journal": "Journal", "/needs": "Shared needs",
  "/proposals/new": "Propose a law",
  "/synth": "Explore civic plans", "/embed": "Civic synthesis demo",
  ...Object.fromEntries(CIVIC_STAGES.map(s => [s.route, s.title])),
  "/vote": "Votes",
};

export function pageTitle(path: string) {
  return `${PAGE_TITLES[path] ?? SITE_NAME} | ${SITE_NAME}`;
}
