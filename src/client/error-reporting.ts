import { errorRoute } from '../shared/error-route';

/** No exception object, URL, stack, identity, breadcrumb or journal is inspected. */
export function installErrorReporting(win: Window, buildSha: string | null) {
  let remaining = 10;
  function report(category: 'error' | 'unhandledrejection') {
    if (remaining-- <= 0) return;
    void win.fetch('/api/error-report', {
      method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ buildSha, routeTemplate: errorRoute(win.location.pathname), category }),
    }).catch(() => {});
  }
  win.addEventListener('error', () => report('error'));
  win.addEventListener('unhandledrejection', () => report('unhandledrejection'));
}
