import { LaunchStats, statsAuthorized, statsPage } from "./launch-stats";
import { boundedJson, createPublicSecurity, securityHeaders } from "./public-security";

export function createStatsHTTP(options: {
  stats: LaunchStats; token: string; healthy: () => boolean;
  record: (run: () => unknown) => void;
  env?: Record<string, string | undefined>;
}) {
  // Independent from voting budgets. This limiter never issues an identity/cookie.
  const security = createPublicSecurity({ ...options.env, PUBLIC_IP_LIMIT: "120", PUBLIC_ID_LIMIT: "1000000" });
  function finish(response: Response) {
    response.headers.set("cache-control", "no-store");
    return securityHeaders(response);
  }
  return {
    admin(req: Request) {
      const headers = { "x-robots-tag": "noindex, nofollow" };
      if (!statsAuthorized(req, options.token)) return finish(new Response("Admin authentication required", { status: 401, headers: { ...headers, "www-authenticate": 'Basic realm="Launch stats", charset="UTF-8"' } }));
      if (req.method !== "GET" && req.method !== "HEAD") return finish(new Response("Method not allowed", { status: 405, headers: { ...headers, allow: "GET, HEAD" } }));
      return finish(new Response(req.method === "HEAD" ? null : statsPage(options.stats.snapshot(), options.healthy()), { headers: { ...headers, "content-type": "text/html; charset=utf-8" } }));
    },
    async pageView(req: Request, peer: string) {
      if (req.method !== "POST") return finish(new Response(null, { status: 405, headers: { allow: "POST" } }));
      if (req.headers.get("origin") !== security.origin(req)) return finish(new Response(null, { status: 403 }));
      const limited = security.check(req, peer, "page-views", false);
      if (limited) return finish(limited);
      try {
        const body = await boundedJson(req, 1024);
        if (typeof body.path !== "string" || body.path.length > 250 || body.path.includes("?") || body.path.includes("#")) return finish(new Response(null, { status: 400 }));
        let accepted = false;
        options.record(() => { accepted = options.stats.view(body.path as string); });
        return finish(new Response(null, { status: accepted ? 204 : options.healthy() ? 400 : 503 }));
      } catch { return finish(new Response(null, { status: 400 })); }
    },
  };
}
