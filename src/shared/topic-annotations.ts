/** No public writes until consent, private reporting and moderator operations ship. */
export const ANNOTATION_LAYERS = [
  { id: 'research', label: 'Research questions' },
  { id: 'experience', label: 'Lived experience' },
  { id: 'correction', label: 'Corrections' },
  { id: 'implementation', label: 'Implementation notes' },
] as const;
export type AnnotationLayer = typeof ANNOTATION_LAYERS[number]['id'];
export type TopicAnnotation = {
  id: string;
  topicId: string;
  layer: AnnotationLayer;
  text: string;
  origin: 'individual-account' | 'verified-source';
  source?: { title: string; url: string; reviewedAt: string };
};
export type AnnotationRecord = TopicAnnotation & {
  moderation: 'pending' | 'approved' | 'hidden';
  consent: 'public-topic' | 'withdrawn';
  provenance: 'public' | 'seeded' | 'simulation';
  // Only reviewed, location-safe public excerpts may be projected.
  locationReviewed: boolean;
};
export function publicTopicAnnotations(topicId: string, records: readonly AnnotationRecord[]): TopicAnnotation[] {
  return records.filter(r => r.topicId === topicId && r.moderation === 'approved'
    && r.consent === 'public-topic' && r.provenance === 'public' && r.locationReviewed === true
    && ANNOTATION_LAYERS.some(l => l.id === r.layer)
    && (r.origin === 'individual-account' || (r.origin === 'verified-source' && r.source
      && /^https:\/\//.test(r.source.url) && Number.isFinite(Date.parse(r.source.reviewedAt)))))
    .map(r => ({ id: r.id, topicId: r.topicId, layer: r.layer, text: r.text, origin: r.origin,
      ...(r.origin === 'verified-source' ? { source: { title: r.source!.title, url: r.source!.url, reviewedAt: r.source!.reviewedAt } } : {}) }));
}
