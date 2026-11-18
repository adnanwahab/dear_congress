import { boundedJson, PublicInputError } from "./public-security";
import { moderationAuthorized } from "./moderation";
import { CatalogBallotError, type CatalogBallotStore } from "./catalog-ballots";

/** HTTP adapter: writes are also passed through the app's shared cookie, rate,
 * origin and request-size protections in publicHandler. */
export function catalogBallotHandlers(store: CatalogBallotStore, config: {
  adminToken: string;
  publisherId: string;
  expectedOrigin: (req: Request) => string;
}) {
  const json = (value: unknown, status = 200) => Response.json(value, {
    status, headers: { "cache-control": "private, no-store", vary: "cookie" },
  });
  async function response(run: () => unknown | Promise<unknown>): Promise<Response> {
    try { return json(await run()); }
    catch (error) {
      if (error instanceof CatalogBallotError || error instanceof PublicInputError)
        return json({ error: error.message }, error.status);
      throw error;
    }
  }
  const viewer = (req: Request) => req.headers.get("x-voter-id") || undefined;
  return {
    detail: (req: Request, id: string) => response(() => store.status(id, viewer(req))),
    results: (_req: Request, id: string) => response(() => {
      const { ownChoice: _personal, ...aggregates } = store.status(id);
      return aggregates;
    }),
    ballot: (req: Request, id: string) => response(() => store.status(id, viewer(req))),
    vote: (req: Request, id: string) => response(async () => {
      if (req.headers.get("origin") !== config.expectedOrigin(req))
        throw new CatalogBallotError(403, "same_origin_required");
      // Never accept a browser-provided x-voter-id. Shared middleware replaces it
      // with its signed-cookie-derived identity before this handler executes.
      const voter = viewer(req);
      if (!voter) throw new CatalogBallotError(401, "browser_identity_required");
      return store.cast(id, await boundedJson(req, 4096), voter);
    }),
    publish: (req: Request, id: string) => response(async () => {
      if (!config.adminToken || !moderationAuthorized(req, config.adminToken))
        throw new CatalogBallotError(401, "publisher_auth_required");
      if (req.headers.get("origin") !== config.expectedOrigin(req))
        throw new CatalogBallotError(403, "same_origin_required");
      // This is an operator-configured identity, never an untrusted request field.
      // A future review center should replace this with a verified role session.
      if (!config.publisherId || config.publisherId.length > 120)
        throw new CatalogBallotError(503, "publisher_identity_not_configured");
      return store.publish(id, await boundedJson(req, 4096), config.publisherId);
    }),
  };
}
