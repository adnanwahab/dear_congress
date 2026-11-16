export async function buildBrowser(production: boolean) {
  const mapCSS = await Bun.build({
    entrypoints: [
      new URL("./maplibre-gl.css", import.meta.resolve("maplibre-gl")).pathname,
      new URL("./maplibre-gl-worker.mjs", import.meta.resolve("maplibre-gl")).pathname,
      "./public/social-preview.png",
    ],
    loader: { ".png": "file" },
    target: "browser", naming: "[name]-[hash].[ext]", minify: production,
  });
  if (!mapCSS.success) return mapCSS;
  const mapURL = "/" + mapCSS.outputs.find(o => o.path.endsWith(".css"))!.path.split("/").pop();
  const workerURL = "/" + mapCSS.outputs.find(o => /maplibre-gl-worker-.*\.js$/.test(o.path))!.path.split("/").pop();
  const build = await Bun.build({
    entrypoints: ["./index.html"], target: "browser", publicPath: "/",
    splitting: true,
    naming: "[name]-[hash].[ext]", minify: production,
    define: { "MAPLIBRE_CSS_URL": JSON.stringify(mapURL), "MAPLIBRE_WORKER_URL": JSON.stringify(workerURL), "process.env.NODE_ENV": JSON.stringify(production ? "production" : "development") },
  });
  return { ...build, outputs: [...build.outputs, ...mapCSS.outputs] };
}

/** Bun rewrites HTML module tags and drops blocking; restore it in the served shell. */
export function transitionShell(html: string): string {
  return html.replace(/<script\b(?=[^>]*type="module")/g, '<script blocking="render"');
}
