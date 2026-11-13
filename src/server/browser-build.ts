export function buildBrowser(production: boolean) {
  return Bun.build({
    entrypoints: ["./index.html"], target: "browser", publicPath: "/",
    splitting: true,
    naming: "[name]-[hash].[ext]", minify: production,
    define: { "process.env.NODE_ENV": JSON.stringify(production ? "production" : "development") },
  });
}
