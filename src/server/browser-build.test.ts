import { expect, test } from "bun:test";
import counties from "../client/data/counties.json";
import { buildBrowser, transitionShell } from "./browser-build";

test("production shell stays under budget and defers county geometry, map modules and MapLibre JS/CSS", async () => {
  const build = await buildBrowser(true);
  expect(build.success).toBe(true);
  const outputs = new Map(await Promise.all(build.outputs.map(async output => [
    "/" + output.path.split("/").pop(), { text: await output.text(), output },
  ] as const)));
  const html = [...outputs.values()].find(({ output }) => output.type.startsWith("text/html"))!.text;
  const entry = html.match(/<script[^>]+src="([^"]+)"/)![1]!;
  const initial = new Set<string>();
  const dynamic = new Set<string>();
  const scanner = new Bun.Transpiler({ loader: "js" });
  function visit(path: string) {
    if (initial.has(path)) return;
    initial.add(path);
    const asset = outputs.get(path);
    expect(asset).toBeDefined();
    for (const dependency of scanner.scanImports(asset!.text)) {
      if (dependency.kind === "dynamic-import") dynamic.add(dependency.path);
      else visit(dependency.path);
    }
  }
  visit(entry);
  let gzipBytes = 0;
  for (const path of initial) {
    const asset = outputs.get(path)!;
    gzipBytes += Bun.gzipSync(await asset.output.arrayBuffer()).length;
    expect(asset.text).not.toContain("maplibregl-");
    expect(asset.text).not.toContain(counties[0]!.path);
    expect(asset.text).not.toContain("Hypothetical model requests changes");
    expect(asset.text).not.toMatch(/deck\.gl|@deck\.gl/);
  }
  expect(gzipBytes).toBeLessThan(250_000);
  const county = [...outputs.entries()].find(([path, asset]) => path.endsWith(".js") && asset.text.includes(counties[0]!.path));
  expect(county).toBeDefined();
  expect(initial.has(county![0])).toBe(false);
  // Geometry may live in a shared static dependency of the lazy MapScreen chunk.
  const deferred = new Set<string>();
  function visitDeferred(path: string) {
    if (deferred.has(path)) return;
    deferred.add(path);
    const asset = outputs.get(path);
    if (!asset) return;
    for (const dependency of scanner.scanImports(asset.text)) visitDeferred(dependency.path);
  }
  for (const path of dynamic) visitDeferred(path);
  expect(deferred.has(county![0])).toBe(true);
  expect(html).not.toMatch(/modulepreload|prefetch/);
  const map = [...outputs.entries()].find(([path, asset]) => path.endsWith(".js") && asset.text.includes("maplibregl-"));
  expect(map).toBeDefined();
  expect(initial.has(map![0])).toBe(false);
  expect(dynamic.has(map![0])).toBe(true);
  // Bun collects imported CSS even across split JS; never import the map CSS there.
  for (const [path, asset] of outputs) {
    if (path.endsWith(".css")) expect(asset.text).not.toContain(".maplibregl-");
  }
  expect(html).not.toContain("maplibre.css");
  expect(html).not.toMatch(/<<<<<<<|=======|>>>>>>>/);
  expect(html.match(/<script[^>]+type="module"/g)).toHaveLength(1);
});

test("served shell keeps its bundled entry render-blocking in the head", async () => {
  const build = await buildBrowser(true);
  const html = transitionShell(await build.outputs.find(output => output.type.startsWith("text/html"))!.text());
  const head = html.slice(0, html.indexOf('</head>'));
  expect(head).toMatch(/<script blocking="render"[^>]*type="module"[^>]*src=/);
  expect(html).toContain('<div id="root"></div>');
});
