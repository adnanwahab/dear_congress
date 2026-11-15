import { useId, useRef, useState } from 'react';
import { explainAssembly, provisionGroups, type Assembly } from './amendment-jigsaw';
import './amendment-jigsaw.css';

export function AmendmentJigsaw({ onStart }: { onStart?: () => void }) {
  const [open, setOpen] = useState(false);
  const [assembly, setAssembly] = useState<Assembly>({});
  const [checked, setChecked] = useState(false);
  const launch = useRef<HTMLButtonElement>(null);
  const id = useId();
  const result = explainAssembly(assembly);
  function close() { setOpen(false); setAssembly({}); setChecked(false); launch.current?.focus(); }
  return <section className="amendment-jigsaw" aria-label="Fictional amendment jigsaw" data-amendment-jigsaw>
    <span className="chip">Fictional teaching fixture · Local only</span>
    <h2>Amendment jigsaw</h2>
    <p>Assemble a hypothetical reading-room clause. No legal sufficiency is assessed. No votes, proposals, advisory participation or rewards are affected.</p>
    <button ref={launch} aria-expanded={open} onClick={() => { onStart?.(); setOpen(true); }}>Play amendment jigsaw</button>
    {open && <div>
      <p>Fictional Lantern Bay / Lantern Isles · Select one piece in each slot by touch or Tab and arrow keys. Choose Check assembly to inspect consistency.</p>
      <div className="jigsaw-slots">{provisionGroups.map(group => <fieldset key={group.id}><legend>{group.title}</legend><p>{group.why}</p>{group.pieces.map((text, index) => <label key={text}><input type="radio" name={`${id}-${group.id}`} checked={assembly[group.id] === index} onChange={() => { setAssembly(a => ({ ...a, [group.id]: index })); setChecked(false); }} />{text}</label>)}</fieldset>)}</div>
      <button onClick={() => setChecked(true)}>Check assembly</button>
      <p role="status">{checked ? result.complete ? 'Internally consistent under the fictional puzzle rules. Read the explanation below; this is not legal approval.' : `${result.missing.length} slots missing; ${result.conflicts.length} conflicts. Read the explanation below.` : 'Select or revise pieces, then check the assembly.'}</p>
      <details><summary>Complete text and explanation</summary><h3>Hypothetical amendment text</h3>{provisionGroups.map(group => <p key={group.id}><strong>{group.title}: </strong>{group.pieces[assembly[group.id] ?? -1] ?? '[Piece not selected]'}</p>)}<h3>How the pieces fit</h3>{provisionGroups.map(group => <p key={group.id}>{group.why}</p>)}{result.missing.map(group => <p key={group.id}>Missing: {group.title}.</p>)}{result.conflicts.map(text => <p key={text}>{text}</p>)}<p>These checks only compare invented geography, authority and timing. They do not establish legality, fiscal adequacy, rights compliance or real-world feasibility. Both geographic choices can form a coherent clause; no political preference is scored.</p><p>Source: repository-authored fictional teaching pieces, not official legislation or catalog text.</p></details>
      <div className="jigsaw-actions"><button onClick={() => { setAssembly({}); setChecked(false); }}>Restart</button><button onClick={close}>Skip</button><button onClick={close}>Exit jigsaw</button></div>
    </div>}
  </section>;
}
