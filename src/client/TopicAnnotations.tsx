import { useState } from 'react';
import { ANNOTATION_LAYERS, type AnnotationLayer, type TopicAnnotation } from '../shared/topic-annotations';

export function TopicAnnotations({ annotations }: { annotations: readonly TopicAnnotation[] }) {
  const [visible, setVisible] = useState(false);
  const [layers, setLayers] = useState<AnnotationLayer[]>(ANNOTATION_LAYERS.map(l => l.id));
  const [origin, setOrigin] = useState('all');
  const selected = annotations.filter(a => layers.includes(a.layer) && (origin === 'all' || a.origin === origin));
  return <section className="panel topic-annotations" aria-labelledby="annotation-heading">
    <h2 id="annotation-heading">Community annotation layers · read-only beta</h2>
    <p>Annotations are off by default. Only moderated, consented public excerpts belong here; individual accounts are not verified evidence or votes. Seeded fiction and model simulations are excluded.</p>
    <p>Contributions are closed until separate public-topic consent, withdrawal, private abuse reporting and moderator review are available. Do not submit personal details through another comment form for this layer. Location sharing is off; no coordinates or inferred locality are used.</p>
    <a href="/privacy">Privacy and current removal options</a>
    <label><input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} />Show annotation layers</label>
    {visible && <>
      <fieldset><legend>Layers to show</legend>{ANNOTATION_LAYERS.map(l => <label key={l.id}><input type="checkbox" checked={layers.includes(l.id)} onChange={e => setLayers(current => e.target.checked ? [...current, l.id] : current.filter(id => id !== l.id))} />{l.label}</label>)}</fieldset>
      <label>Annotation origin<select value={origin} onChange={e => setOrigin(e.target.value)}><option value="all">All origins, shown separately</option><option value="verified-source">Verified sources</option><option value="individual-account">Individual accounts</option></select></label>
      <p role="status">{selected.length ? `${selected.length} annotations match these layers.` : 'No reviewed annotations match these layers.'}</p>
      {(['verified-source', 'individual-account'] as const).filter(o => origin === 'all' || origin === o).map(o => <section key={o} aria-label={o === 'verified-source' ? 'Verified sources' : 'Individual accounts'}><h3>{o === 'verified-source' ? 'Verified sources · reviewed reference' : 'Individual accounts · personal perspective'}</h3>{selected.filter(a => a.origin === o).slice(0, 5).map(a => <article key={a.id}><h4>{ANNOTATION_LAYERS.find(l => l.id === a.layer)?.label}</h4><p>{a.text}</p>{a.source && <p><a href={a.source.url} rel="noreferrer">{a.source.title}</a> · Reviewed {a.source.reviewedAt}</p>}</article>)}{selected.filter(a => a.origin === o).length > 5 && <p>Showing the first five reviewed annotations. Narrow the layers to reduce the list.</p>}</section>)}
    </>}
  </section>;
}
