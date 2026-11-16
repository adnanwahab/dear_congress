/** Page-memory rehearsal only; never a ballot or a verified participant record. */
export const JURY_AGENDA = ['Read the proposal and sources', 'Questions and concerns', 'Draft a shared summary'] as const;
export const TURN_SECONDS = 60;
export interface JurySeat { alias: string; consent: boolean; summaryConsent: boolean }
export interface JuryRoom { seats: JurySeat[]; turn: number; remaining: number; paused: boolean; reported: boolean; summary: string }
export function createJury(): JuryRoom {
  return { seats: ['Willow', 'Cedar', 'River'].map(alias => ({ alias, consent: false, summaryConsent: false })), turn: 0, remaining: TURN_SECONDS, paused: true, reported: false, summary: '' };
}
export function juryReady(room: JuryRoom): boolean { return room.seats.every(s => s.consent); }
export function nextTurn(room: JuryRoom): JuryRoom {
  if (!juryReady(room) || room.reported || room.turn >= JURY_AGENDA.length * room.seats.length) return room;
  return { ...room, turn: room.turn + 1, remaining: TURN_SECONDS, paused: true };
}
export function tickJury(room: JuryRoom): JuryRoom {
  if (room.paused || room.reported || !juryReady(room) || room.remaining <= 0 || room.turn >= 9) return room;
  return { ...room, remaining: room.remaining - 1, paused: room.remaining <= 1 };
}
export function consentedSummary(room: JuryRoom): string | null {
  if (room.turn !== 9 || room.reported || !juryReady(room) || !room.seats.every(s => s.summaryConsent) || !room.summary.trim()) return null;
  return `LOCAL DEMO SUMMARY — ${room.seats.length} opt-in rehearsal seats; non-representative group. No verified civic participation.\n${room.summary.trim()}`;
}
