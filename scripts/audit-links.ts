import { mkdir } from 'node:fs/promises';
import { auditLinks } from '../src/server/link-audit';
const report = await auditLinks('https://civic-synthesis.fly.dev');
await mkdir('artifacts/link-audit', { recursive: true });
await Bun.write('artifacts/link-audit/report.json', JSON.stringify(report, null, 2));
await Bun.write('artifacts/link-audit/report.md', `# Public link audit\n\nChecked: ${report.checkedAt}\n\nTruncated: ${report.truncated}\n\n| Target | Owner / referring page | Expected | Status | Finding |\n|---|---|---|---|---|\n` + report.results.map(r => `| ${r.url} | ${r.owner} | ${r.expected} | ${r.status ?? 'unavailable'} | ${r.problem ?? 'OK'} |`).join('\n'));
if (report.failed) process.exitCode = 1;
