import { PRIVACY_HTML } from "./privacy-page";
import { SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION, PAGE_TITLES, pageTitle } from "../shared/page-metadata";
import type { CitizenProposalRecord } from "../shared/citizen-proposals";

export function escapeHTML(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function metadata(title: string, description: string, path: string) {
  const url = SITE_URL + path;
  const image = `${SITE_URL}/social-preview.png`;
  return `<title>${escapeHTML(title)}</title>
<meta name="description" content="${escapeHTML(description)}">
<link rel="canonical" href="${escapeHTML(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${escapeHTML(title)}">
<meta property="og:description" content="${escapeHTML(description)}">
<meta property="og:url" content="${escapeHTML(url)}">
<meta property="og:image" content="${image}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Civic Synthesis — share needs, discuss proposals, explore civic plans">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHTML(title)}">
<meta name="twitter:description" content="${escapeHTML(description)}">
<meta name="twitter:image" content="${image}">
<meta name="twitter:image:alt" content="Civic Synthesis — share needs, discuss proposals, explore civic plans">`;
}

export function renderPage(shell: string, path: string, proposals: CitizenProposalRecord[]) {
  const proposal = path.startsWith("/proposals/") && path !== "/proposals/new"
    ? proposals.find((item) => `/proposals/${encodeURIComponent(item.id)}` === path) : undefined;
  const repositoryVote = /^\/vote\/(?:happybearlandia|dear_congress|digital_pensieve)(?:\/(?:pr|issue)\/[1-9]\d*)?\/?$/.test(path);
  const found = Object.hasOwn(PAGE_TITLES, path) || path === "/vote/" || !!proposal || repositoryVote;
  const title = proposal ? `${proposal.title} | ${SITE_NAME}` : repositoryVote ? `Repository voting | ${SITE_NAME}` : found ? pageTitle(path === "/vote/" ? "/vote" : path) : `Page not found | ${SITE_NAME}`;
  const description = proposal ? proposal.problem.slice(0, 240) : found ? DEFAULT_DESCRIPTION : "This page could not be found. Explore the proposal feed or citizen votes.";
  let html = shell.replace(/<title>[^<]*<\/title>/, metadata(title, description, path));
  if (path === "/privacy") html = html.replace('<div id="root"></div>', PRIVACY_HTML).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
  if (!found) html = html.replace('<div id="root"></div>', `<main style="max-width:40rem;margin:12vh auto;padding:24px;font:20px/1.6 system-ui"><h1>Page not found</h1><p>The link may have changed, or this page may no longer exist.</p><p><a href="/feed">Go to Feed</a> · <a href="/votes">Go to Votes</a></p><footer><a href="/privacy">Privacy &amp; removal</a></footer></main>`).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
  return new Response(html, { status: found ? 200 : 404, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
}

export function sitemap(proposals: CitizenProposalRecord[]) {
  const paths = [...Object.keys(PAGE_TITLES).filter((path) => path !== "/embed" && path !== "/proposals/new"), ...proposals.map((p) => `/proposals/${encodeURIComponent(p.id)}`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${escapeHTML(SITE_URL + path)}</loc></url>`).join("")}</urlset>`;
}
