/** Exact server and client allowlist; never accept arbitrary repository paths. */
export const REPOSITORIES = {
 dear_congress: {name: 'Dear Congress', repository: 'adnanwahab/dear_congress'},
 happybearlandia: {name: 'HappyBearLandia', repository: 'adnanwahab/happybearlandia'},
 digital_pensieve: {name: 'Digital Pensieve', repository: 'adnanwahab/digital_pensieve'},
} as const;
export type RepoKey = keyof typeof REPOSITORIES;
export type ItemKind = 'pr' | 'issue';
export function isRepoKey(key: string): key is RepoKey { return Object.hasOwn(REPOSITORIES, key); }
export function votingRoute(location: Pick<Location, 'pathname'|'search'>) {
 const match = /^\/vote(?:\/([^/]+)(?:\/(pr|issue)\/([1-9]\d*))?)?\/?$/.exec(location.pathname);
 if (!match || (match[1] && !isRepoKey(match[1]))) return null;
 const repoKey = (match[1] || 'happybearlandia') as RepoKey;
 const kind: ItemKind = match[2] === 'issue' || (!match[2] && new URLSearchParams(location.search).get('view') === 'issues') ? 'issue' : 'pr';
 return {repoKey, kind, number:match[3], base:`/vote/${repoKey}`, api:`/api/hbl/repos/${repoKey}/${kind === 'issue' ? 'issues' : 'pulls'}`};
}
