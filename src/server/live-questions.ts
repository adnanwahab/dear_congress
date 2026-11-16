import { PublicInputError } from './public-security';

export type QuestionAction =
  | { kind: 'submit'; text: string; author?: string }
  | { kind: 'approve'; id: string; groupId?: string }
  | { kind: 'hide' | 'upvote' | 'report'; id: string }
  | { kind: 'next' };
type Question = { id: string; text: string; author?: string; key: string; status: 'pending' | 'approved' | 'hidden'; duplicates: number; shown: number; supporters: Set<string>; reporters: Set<string> };
const normalized = (text: string) => text.normalize('NFKC').toLocaleLowerCase('en').replace(/[\p{P}\p{Z}\s]+/gu, ' ').trim();

/** Ephemeral discussion only. No ballots, attendance, civic records or database writes. */
export class LiveQuestions {
  private questions: Question[] = [];
  private submissions = new Map<string, number>();
  private current?: string;
  act(action: QuestionAction, browser: string, moderator: boolean) {
    if (!action || typeof action !== 'object') throw new PublicInputError('Invalid question action');
    if (action.kind === 'submit') {
      if (typeof action.text !== 'string' || !action.text.trim() || action.text.length > 500 || !normalized(action.text)) throw new PublicInputError('Enter a question of 1–500 characters');
      if (action.author !== undefined && (typeof action.author !== 'string' || action.author.length > 60)) throw new PublicInputError('Use a display name of at most 60 characters');
      if (this.questions.length >= 200 || (this.submissions.get(browser) ?? 0) >= 5) throw new PublicInputError('Question submission limit reached', 429);
      this.submissions.set(browser, (this.submissions.get(browser) ?? 0) + 1);
      this.questions.push({ id: crypto.randomUUID(), text: action.text.trim(), author: action.author?.trim() || undefined, key: normalized(action.text), status: 'pending', duplicates: 1, shown: 0, supporters: new Set(), reporters: new Set() });
      return;
    }
    if (action.kind === 'next') {
      if (!moderator) throw new PublicInputError('Only the starting browser can moderate questions', 403);
      const next = this.questions.filter(q => q.status === 'approved').sort((a,b) => a.shown - b.shown)[0];
      this.current = next?.id;
      if (next) next.shown++;
      return;
    }
    if (!['approve', 'hide', 'upvote', 'report'].includes(action.kind)) throw new PublicInputError('Unknown question action');
    if ((action.kind === 'approve' || action.kind === 'hide') && !moderator) throw new PublicInputError('Only the starting browser can moderate questions', 403);
    const q = this.questions.find(q => q.id === action.id);
    if (!q || (!moderator && q.status !== 'approved')) throw new PublicInputError('Question not found', 404);
    if (action.kind === 'approve') {
      if (q.status !== 'pending') throw new PublicInputError('Only pending questions can be approved', 409);
      const group = this.questions.find(other => other !== q && other.status === 'approved' && (action.groupId ? other.id === action.groupId : other.key === q.key));
      if (action.groupId && !group) throw new PublicInputError('Choose an approved question in this round');
      if (group) { group.duplicates++; q.status = 'hidden'; }
      else q.status = 'approved';
    } else if (action.kind === 'hide') {
      q.status = 'hidden';
      if (this.current === q.id) this.current = undefined;
    } else {
      if (q.status !== 'approved') throw new PublicInputError('Question not available', 409);
      const set = action.kind === 'upvote' ? q.supporters : q.reporters;
      if (set.size >= 10000 && !set.has(browser)) throw new PublicInputError('Question interaction limit reached', 429);
      set.add(browser);
    }
  }
  snapshot(browser: string, moderator: boolean) {
    return { current: this.current, questions: this.questions.filter(q => moderator ? q.status !== 'hidden' : q.status === 'approved').map(q => ({ id:q.id, text:q.text, author:q.author, status:q.status, duplicates:q.duplicates, shown:q.shown, upvotes:q.supporters.size, upvoted:q.supporters.has(browser), reported:q.reporters.has(browser), reports:moderator ? q.reporters.size : undefined })) };
  }
}
