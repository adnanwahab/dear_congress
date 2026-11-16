/** Server-only configuration. Unknown nonempty values fail closed. */
export function launchReadOnly(value: string | undefined): boolean {
  return value !== undefined && !['', '0', 'false'].includes(value.trim().toLowerCase());
}

export const READ_ONLY_NOTICE = 'Read-only mode: public submissions and votes are temporarily paused. You can still read labeled samples and follow source links. Rejected attempts are not saved or queued; keep any unsent text before leaving this page.';

/** Call before any handler, body parsing, extraction or persistence. */
export function pausedWrite(req: Request, enabled: boolean): Response | undefined {
  if (!enabled || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
  return Response.json({ error: READ_ONLY_NOTICE, code: 'writes_paused' }, {
    status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' },
  });
}

export function readOnlyShell(shell: string, enabled: boolean): string {
  return enabled ? shell.replace('<body>', `<body><aside role="status" style="padding:1rem;border:2px solid currentColor;font:1rem/1.5 system-ui">${READ_ONLY_NOTICE}</aside>`) : shell;
}
