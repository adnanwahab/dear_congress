import { expect, test } from "bun:test";
import { buildBrowser } from "./browser-build";

test("production shell stays under budget and defers MapLibre JS and CSS", async () => {
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
  }
  expect(gzipBytes).toBeLessThan(250_000);
  const map = [...outputs.entries()].find(([path, asset]) => path.endsWith(".js") && asset.text.includes("maplibregl-"));
  expect(map).toBeDefined();
  expect(initial.has(map![0])).toBe(false);
  expect(dynamic.has(map![0])).toBe(true);
  // Bun collects imported CSS even across split JS; never import the map CSS there.
  for (const [path, asset] of outputs) {
    if (path.endsWith(".css")) expect(asset.text).not.toContain(".maplibregl-");
  }
  expect(html).not.toContain("maplibre.css");
});
