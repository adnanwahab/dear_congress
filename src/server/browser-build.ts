export async function buildBrowser(production: boolean) {
  const worker = await Bun.build({ entrypoints: ["./src/client/county-worker.ts"], target: "browser", naming: "county-worker.js", minify: production });
  const browser = await Bun.build({
    entrypoints: ["./index.html"], target: "browser", publicPath: "/",
    splitting: true,
    naming: "[name]-[hash].[ext]", minify: production,
    define: { "process.env.NODE_ENV": JSON.stringify(production ? "production" : "development") },
  });
  return { ...browser, success: browser.success && worker.success, outputs: [...browser.outputs, ...worker.outputs], logs: [...browser.logs, ...worker.logs] };
}

/** Bun rewrites HTML module tags and drops blocking; restore it in the served shell. */
export function transitionShell(html: string): string {
  return html.replace(/<script\b(?=[^>]*type="module")/g, '<script blocking="render"');
}
