import { MutationError } from './mutation-status';
export function writeFailure(error: unknown, timedOut = false): string {
  if (timedOut) return 'The request timed out on a slow connection.';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'You are offline.';
  if (error instanceof MutationError) {
    if (error.status === 429) return 'Too many requests. Wait before retrying.';
    if (error.status >= 500) return 'The server is temporarily unavailable (5xx).';
    return error.message;
  }
  return 'A network error interrupted the request.';
}
export function retryDeadline(error: unknown): number {
  if (!(error instanceof MutationError) || error.status !== 429) return 0;
  const header = error.retryAfter;
  return header && /^\d+$/.test(header) ? Date.now() + Number(header) * 1000 : Math.max(Date.now(), Date.parse(header ?? '') || Date.now() + 60000);
}
