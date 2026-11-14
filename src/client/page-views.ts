/** First-party aggregate route counts. No cookies, identifiers, query strings or referrers. */
export function startPageViews(browser: Pick<Window, "location" | "history" | "addEventListener"> & { document?: Document } = window, send: typeof fetch = fetch) {
  let previous = "";
  const record = () => {
    if ((browser.document as (Document & { prerendering?: boolean }) | undefined)?.prerendering) return;
    const path = browser.location.pathname;
    if (path === previous) return;
    previous = path;
    void send("/api/page-view", {
      method: "POST", credentials: "omit", keepalive: true,
      headers: { "content-type": "application/json" }, body: JSON.stringify({ path }),
    }).catch(() => {});
  };
  for (const method of ["pushState", "replaceState"] as const) {
    const original = browser.history[method].bind(browser.history);
    browser.history[method] = (...args: Parameters<History[typeof method]>) => { original(args[0], args[1], args[2]); record(); };
  }
  browser.addEventListener("popstate", record);
  browser.document?.addEventListener("prerenderingchange", record, { once: true });
  record();
}
