import { buildIdentity } from './build-identity';
import { securityHeaders } from './public-security';

const repository = 'https://github.com/adnanwahab/dear_congress';
const release = {
  tag: 'v2026.11.14',
  commit: '795c6944dc4055499562d674b98db9837d8f1db9',
  base: '0028e961578ca3d906550b07648daa9e4c6c3631',
  date: '2026-11-14',
  paths: ['src/client/bill-catalog.css', 'docs/evidence/catalog-contrast-20261114.md'],
} as const;
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Editorial release history, independent of resident records and runtime telemetry. */
export function changelog(req: Request, identity = buildIdentity): Response {
  const matches = identity.commit === release.commit;
  const source = `${repository}/blob/${release.commit}`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Launch changelog · Civic Synthesis</title><style>body{font:1rem/1.6 system-ui;margin:0;padding:1rem;color:#172333;background:#fff;overflow-wrap:anywhere}main{max-width:48rem;margin:auto}a{color:#0645ad}a:focus-visible{outline:3px solid currentColor;outline-offset:3px}li{margin:.6rem 0}article{border-top:1px solid;padding-top:1rem}code{font-size:.9em}</style></head><body><main>
  <nav aria-label="Changelog navigation"><a href="/">Home</a> · <a href="/version">Build identity JSON</a> · <a href="/documentation">Public guide</a></nav>
  <h1>Launch changelog</h1><p>Independently operated, non-binding beta. Code releases revise a demo; they do not establish government action, policy outcomes or meaningful participation.</p>
  <h2>Build serving this page</h2><p>Commit: ${identity.commit ? `<a href="${repository}/commit/${identity.commit}"><code>${identity.commit}</code></a>` : 'Unavailable — this build cannot be matched to a release.'}<br>Build date (UTC): ${escape(identity.builtAt ?? 'Unavailable')}<br>Environment: ${escape(identity.environment)}</p>
  <p>${matches ? 'This build matches the documented release commit below. This match alone is not a live reliability check.' : 'This build does not match the documented release below. Treat a shared preview as an unverified demo revision; it is not evidence of a new production release.'}</p>
  <p>Build date is not release date. Historical records below are not live service status. Incident coverage is incomplete; no incident record does not mean no incidents occurred.</p>
  <article id="v2026.11.14"><h2>${release.tag} — documented code release</h2><p>Release date: <time datetime="${release.date}">${release.date}</time> (exact publication time unavailable).</p>
  <p>Catalog dark-theme section headings were corrected for contrast. This entry covers only the final correction relative to its parent, not every change in the release.</p>
  <ul><li><a href="${repository}/releases/tag/${release.tag}">Release record</a> · <a href="${repository}/commit/${release.commit}">Exact tested source commit</a>: <code>${release.commit}</code></li>
  <li><a href="${repository}/compare/${release.base}...${release.commit}">Changed paths and diff for the final correction</a><ul>${release.paths.map(path => `<li><a href="${source}/${path}">${path}</a></li>`).join('')}</ul></li>
  <li><a href="${source}/docs/evidence/catalog-contrast-20261114.md">Dated local test report</a>: 536 tests, typecheck, route smoke and five browser projects reported passing on 2026-11-14. The report requires a hosted rerun; hosted results are not attested here.</li>
  <li><a href="${repository}/blob/a732468915bda1ab4bf20a963d576d14b8a82a06/docs/launch-merge-policy.md">Rollout and parity account</a>: maintainer-recorded release and parity follow-up. This is a source account, not independently verified deployment telemetry.</li>
  <li>Reliability incident: no release-specific incident record supplied. <a href="${source}/docs/evidence/catalog-contrast-20261114.md">Related accessibility failure and correction</a> documents the earlier failed catalog check. Operational incident status remains unknown.</li></ul></article>
  <p>No newer release or operational status update is recorded here. <a href="${repository}">Source repository</a>. Human review and a human-published tagged release remain required.</p>
  </main></body></html>`;
  return securityHeaders(new Response(req.method === 'HEAD' ? null : html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }));
}
