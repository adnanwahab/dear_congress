import { expect, test } from "bun:test";
import { LaunchStats } from "./launch-stats";
import { createStatsHTTP } from "./launch-stats-http";

function setup(env:Record<string,string|undefined>={}) {
  const stats = new LaunchStats(":memory:");
  const http = createStatsHTTP({stats,token:"test-admin-token",healthy:()=>true,record:run=>run(),env});
  return {stats,http};
}
test("stats HTML is protected, uncacheable, script-free and never issues a cookie", async () => {
  const {stats,http} = setup();
  try {
    for (const authorization of [undefined,"Bearer wrong",`Basic ${btoa("visitor:test-admin-token")}`]) {
      const response = http.admin(new Request("https://local/admin/stats",{headers:authorization?{authorization}:{}}));
      expect(response.status).toBe(401);
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    const headers = {authorization:`Basic ${btoa("admin:test-admin-token")}`};
    const response = http.admin(new Request("https://local/admin/stats",{headers}));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(response.headers.get("content-security-policy")).toContain("script-src 'self'");
    const html = await response.text();
    expect(html).toContain("Real journal posts"); expect(html).not.toContain("<script");
    expect(html).not.toContain("test-admin-token");
    expect(await http.admin(new Request("https://local/admin/stats",{method:"HEAD",headers})).text()).toBe("");
    expect(http.admin(new Request("https://local/admin/stats",{method:"POST",headers})).status).toBe(405);
  } finally {stats.close();}
});
test("page views reject cross-origin, malformed, private and oversized routes without cookies", async () => {
  const {stats,http} = setup();
  const request = (body:string,origin="https://local",method="POST") => http.pageView(new Request("https://local/api/page-view",{method,headers:{origin,"content-type":"application/json"},...(method==='POST'?{body}:{})}),"127.0.0.1");
  try {
    for (const [body,origin,status] of [
      ['{"path":"/needs"}',"https://evil.test",403], ['{"path":"/needs"}',"",403],
      ['{"path":"/admin/stats"}',"https://local",400],['{"path":"/needs?token=private"}',"https://local",400],
      ['{"path":"/unknown"}',"https://local",400],['{"path":"/api/state"}',"https://local",400],
      ['{',"https://local",400],['x'.repeat(1025),"https://local",400],
      ['{"path":"/needs"}',"https://local",204],
    ] as const) {
      const response = await request(body,origin);
      expect(response.status).toBe(status);
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect((await request("","https://local","GET")).status).toBe(405);
    expect(stats.snapshot().pageViews).toEqual([{route:"/needs",count:1}]);
  } finally {stats.close();}
});
test("page view rate limits use trusted Fly IP and do not mint identities", async () => {
  const {stats,http} = setup({TRUST_FLY_PROXY:"1"});
  const send = (ip:string) => http.pageView(new Request("http://local/api/page-view",{method:"POST",headers:{origin:"https://local","fly-client-ip":ip,"content-type":"application/json"},body:'{"path":"/feed"}'}),"127.0.0.1");
  try {
    for(let i=0;i<120;i++) expect((await send("192.0.2.1")).status).toBe(204);
    const rejected = await send("192.0.2.1");
    expect(rejected.status).toBe(429);expect(rejected.headers.get("retry-after")).not.toBeNull();
    expect(rejected.headers.get("set-cookie")).toBeNull();
    expect((await send("192.0.2.2")).status).toBe(204);
  } finally {stats.close();}
});
