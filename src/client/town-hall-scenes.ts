export const HALL_SCENES = [
  {
    title: 'Make room in the queue', time: '6 minutes · three 2-minute slots',
    queue: ['Mira: first turn; must leave in 2 minutes; asks about evening access.', 'Dev: already spoke twice; asks for another turn about opening hours.', 'Sol: first turn; needs time to read a written question about quiet space.'],
    choices: [
      ['Invite Mira, then Sol with reading time, then Dev if time remains.', 'You explain the departure constraint, protect a first turn and offer Dev the same time limit. Equal opportunity can require different accommodations.', true],
      ['Give Dev all three slots because the question sounds persuasive.', 'Persuasiveness does not justify monopolizing the queue. A published turn rule and first-turn priority protect quieter participants.', false],
    ],
  },
  {
    title: 'Listen through disagreement', time: '4 minutes · two 2-minute slots',
    queue: ['Sol: asks for quiet space; has not finished reading.', 'Dev: interrupts to request lively evening events.', 'Mira: left; her written evening-access question remains in the queue.'],
    choices: [
      ['Stop discussion until everyone agrees on the same activities.', 'Agreement is not the goal. Preserve both concerns and apply the same interruption rule to every speaker.', false],
      ['Return Sol’s remaining time, summarize both needs, and ask each speaker to confirm.', 'You protect the interrupted turn and check your understanding without endorsing either preference. Record Mira’s unanswered question for follow-up.', true],
    ],
  },
  {
    title: 'Close without erasing needs', time: '2 minutes · one closing slot',
    queue: ['Sol: wants confirmation that quiet-space concerns were recorded.', 'Dev: wants an immediate promise of evening events.', 'Mira: absent; needs an accessible written follow-up.'],
    choices: [
      ['Read back both concerns, name unresolved trade-offs and offer the same written follow-up to everyone.', 'You make the record inspectable, acknowledge uncertainty and provide equal follow-up. Fair procedure does not require consensus or a policy promise.', true],
      ['Announce a winning preference and remove the other concerns from the notes.', 'A winning preference cannot erase another person’s needs. Keep an accurate record and explain what remains unresolved.', false],
    ],
  },
] as const;

