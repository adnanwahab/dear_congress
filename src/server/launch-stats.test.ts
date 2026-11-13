import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LaunchStats, observePublicResponse, statsAuthorized, statsDay, statsPage, statsRoute } from "./launch-stats";

const vote = { identity: "civic:browser-a", scope: "citizen/advisory", target: "proposal-a" };
test("daily identities, repeat saves, source/revision isolation, returning voters and restart", () => {
  const directory = mkdtempSync(join(tmpdir(), "launch-stats-"));
  let now = Date.parse("2026-11-13T05:59:59Z"); // Nov 12 CT
  let stats = new LaunchStats(join(directory, "stats.sqlite"), () => now);
  try {
    const startedAt = stats.snapshot().startedAt;
    stats.vote(vote); stats.vote(vote);
    expect(stats.snapshot()).toMatchObject({day:"2026-11-12",uniqueVoters:1,votes:1,returningVoters:0});
    now += 1000;
    stats.vote(vote); stats.vote({...vote, target:"proposal-b"});
    stats.vote({...vote, scope:"dear_congress/pr/verified", target:'[1,"head1"]'});
    stats.vote({...vote, scope:"dear_congress/pr/verified", target:'[1,"head2"]'});
    stats.vote({...vote, scope:"digital_pensieve/pr/verified", target:'[1,"head2"]'});
    stats.vote({...vote, identity:"civic:browser-b"});
    stats.journal("real-entry", "real"); stats.journal("real-entry", "real");
    stats.journal("seed-entry", "sample"); stats.journal("sim-entry", "simulated");
    stats.view("/needs"); stats.view("/needs"); stats.view("/proposals/private-id");
    expect(stats.view("/admin/stats")).toBe(false);
    stats.close(); stats = new LaunchStats(join(directory, "stats.sqlite"), () => now);
    expect(stats.snapshot()).toMatchObject({day:"2026-11-13",startedAt,uniqueVoters:2,votes:6,returningVoters:1,journals:{real:1,sample:1,simulated:1},pageViews:[{route:"/needs",count:2},{route:"/proposals/:id",count:1}]});
    now += 2 * 86400000;
    stats.vote(vote);
    expect(stats.snapshot().returningVoters).toBe(0);
  } finally { stats.close(); rmSync(directory, {recursive:true,force:true}); }
});
test("Chicago dates cover midnight, year change and both DST transitions", () => {
  for (const [time,day] of [
    ["2026-01-01T05:59:59Z","2025-12-31"], ["2026-01-01T06:00:00Z","2026-01-01"],
    ["2026-03-08T07:59:59Z","2026-03-08"], ["2026-03-08T08:00:00Z","2026-03-08"],
    ["2026-11-01T06:30:00Z","2026-11-01"], ["2026-11-01T07:30:00Z","2026-11-01"],
    ["2026-07-01T04:59:59Z","2026-06-30"], ["2026-07-01T05:00:00Z","2026-07-01"],
  ]) expect(statsDay(Date.parse(time!))).toBe(day!);
});
test("admin authentication fails closed; Basic and Bearer use existing token", () => {
  const req = (authorization?:string) => new Request("https://local/admin/stats", {headers:authorization?{authorization}:{}});
  expect(statsAuthorized(req(), "")).toBe(false);
  expect(statsAuthorized(req("Bearer secret"), "")).toBe(false);
  expect(statsAuthorized(req(), "secret")).toBe(false);
  expect(statsAuthorized(req("Bearer wrong!"), "secret")).toBe(false);
  expect(statsAuthorized(req("Bearer secret"), "secret")).toBe(true);
  expect(statsAuthorized(req(`Basic ${btoa("admin:secret")}`), "secret")).toBe(true);
  expect(statsAuthorized(req(`Basic ${btoa("other:secret")}`), "secret")).toBe(false);
});
test("route aggregation drops identifiers and rejects API/admin/unknown routes", () => {
  expect(statsRoute("/vote/dear_congress/pr/123")).toBe("/vote/dear_congress/pr/:number");
  expect(statsRoute("/vote/happybearlandia/issue/123")).toBe("/vote/happybearlandia/issue/:number");
  for (const path of ["/api/state", "/admin/stats", "/unknown", "/needs?token=secret", "/vote/unknown/pr/1"]) expect(statsRoute(path)).toBeNull();
});
test("success observer counts real/simulated journal aliases and nonempty votes only", async () => {
  const stats = new LaunchStats(":memory:"); let errors = 0;
  const observe = async (path:string,body:unknown,result:unknown,status=200) => {
    const req = new Request(`https://local${path}`, {method:"POST",headers:{"x-voter-id":"signed-browser"},body:JSON.stringify(body)});
    const response = Response.json(result,{status});
    expect(await observePublicResponse(stats,req,response,()=>errors++)).toBe(response);
  };
  try {
    await observe("/api/journal",{}, {id:"journal-1"});
    await observe("/api/entries",{}, {entry:{id:"journal-2"}});
    await observe("/api/publish_draft",{}, {mode:"journal",entry:{id:"journal-3",synthetic:true}});
    await observe("/api/publish_draft",{}, {mode:"journal",entry:{id:"journal-4",seeded:true}});
    await observe("/api/publish_draft",{}, {mode:"answer"});
    await observe("/api/journal",{}, {error:"rejected"},429);
    await observe("/api/citizen-proposals/a/vote",{}, {proposal:{id:"a",ownVote:"support"}});
    await observe("/api/citizen-proposals/a/vote",{}, {proposal:{id:"a",ownVote:"oppose"}});
    await observe("/api/citizen-proposals/a/vote",{}, {proposal:{id:"a",ownVote:null}});
    await observe("/api/citizen-proposals/b/vote",{}, {proposal:{id:"b",ownVote:"support"}},403);
    await observe("/api/votes",{votes:[{proposalId:"p1"}],goalVotes:{housing:false},allocation:{housing:100}}, {ok:true});
    await observe("/api/votes",{votes:[],goalVotes:{},allocation:{}},{ok:true});
    expect(stats.snapshot()).toMatchObject({uniqueVoters:1,votes:4,journals:{real:2,sample:1,simulated:1}});
    expect(errors).toBe(0);
    const html = statsPage(stats.snapshot(),false);
    expect(html).toContain("Metrics recording failed");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("signed-browser");
  } finally {stats.close();}
});
test("metrics failure does not change a successful public write response", async () => {
  const stats = new LaunchStats(":memory:");stats.close(); let errors=0;
  const req = new Request("https://local/api/journal",{method:"POST",body:"{}"});
  const response = Response.json({id:"saved"});
  expect(await observePublicResponse(stats,req,response,()=>errors++)).toBe(response);
  expect(errors).toBe(1);
});
