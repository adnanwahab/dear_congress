/** Fixed aggregate taxonomy; never add proposal, stance, identity or session properties. */
export const ACTIVATION_EVENTS = {
  landing: 'Landing opened',
  proposal_read: 'Sample proposal displayed',
  argument_opened: 'Sample argument expanded',
  choice_saved: 'Advisory choice save accepted',
  choice_withdrawn: 'Advisory choice withdrawal accepted',
  share_opened: 'Sample share preview opened',
} as const;
export type ActivationEvent = keyof typeof ACTIVATION_EVENTS;
export const BROWSER_ACTIVATION_EVENTS = ['proposal_read', 'argument_opened', 'share_opened'] as const;
