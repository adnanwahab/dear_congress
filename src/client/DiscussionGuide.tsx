import { useState } from "react";
import type { CitizenProposalComment } from "../shared/citizen-proposals";

/** Shared by citations and original comments; no user text becomes a URL. */
export function discussionCommentId(id: string) {
  return `discussion-comment-${encodeURIComponent(id)}`;
}

/** Local, extractive first slice. Never reads drafts, journals, votes or storage. */
export function DiscussionGuide({ comments }: { comments: CitizenProposalComment[] }) {
  const [enabled, setEnabled] = useState(false);
  return <section aria-label="Optional discussion reading guide">
    <h3>Discussion reading guide</h3>
    <p>This local guide repeats every public comment in full and offers the same clarifying prompts for each. It does not infer positions or agreement. No comments are sent to an AI provider or saved by this guide.</p>
    <label><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} /> Show optional reading guide</label>
    <div role="status">{enabled ? `Guide covers all ${comments.length} currently loaded public comments.` : "Guide off. Public discussion remains available."}</div>
    {enabled && <div>
      <p><strong>Machine-generated reading aid · may misrepresent comments</strong></p>
      <p>Template-based, not an AI summary or fact check. Comment order is unchanged. These comments do not represent all residents. Suggestions are advisory and do not cast votes.</p>
      {comments.length === 0 ? <p>No public comments to discuss yet.</p> : <ol>{comments.map((comment, index) => <li key={comment.id}>
        <h4>Source {index + 1}: {comment.displayName}</h4>
        <blockquote style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{comment.text}</blockquote>
        <a href={`#${discussionCommentId(comment.id)}`}>Read original comment {index + 1} in context</a>
        <p>Clarifying question for this author: What would you most like others to understand about this comment?</p>
      </li>)}</ol>}
      <h4>Questions to explore together</h4>
      <p>Which factual questions remain unresolved? What evidence would change each person's view? Ask participants; this guide has not verified any claim.</p>
      <h4>Suggested shared language</h4>
      <p>“Can we describe where we agree and where we still disagree?” This is an invitation, not a claim of consensus.</p>
      <p>If this guide misses your meaning, clarify it in the public comment form below. Formal summary corrections, appeals and comment abuse reporting are not available in this first slice.</p>
    </div>}
  </section>;
}
