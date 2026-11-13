export function buildBrowser(production: boolean) {
  return Bun.build({
    entrypoints: ["./index.html"], target: "browser", publicPath: "/",
    splitting: true,
    naming: "[name]-[hash].[ext]", minify: production,
    define: { "process.env.NODE_ENV": JSON.stringify(production ? "production" : "development") },
  });
}

/** Bun rewrites HTML module tags and drops blocking; restore it in the served shell. */
export function transitionShell(html: string): string {
  return html.replace(/<script\b(?=[^>]*type="module")/g, '<script blocking="render"');
}
