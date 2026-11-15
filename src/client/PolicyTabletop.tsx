import {useState} from 'react';

type Action = {id:number;label:string;editable:boolean};
/** A bounded discussion layout, never a geographic model input. */
export function PolicyTabletop({actions,disabled,onPlace}:{
  actions:readonly Action[];disabled:boolean;onPlace:(lawId:number)=>void;
}) {
  const [enabled,setEnabled]=useState(false);
  const [selected,setSelected]=useState(83);
  const [placed,setPlaced]=useState<Action|null>(null);
  function place(id:number) {
    const action=actions.find(row=>row.id===id);
    if(disabled||!action)return;
    setSelected(id);setPlaced(action);onPlace(id);
  }
  return <section id="policy-tabletop" aria-label="Policy Holodeck tabletop" className="policy-tabletop">
    <h4>Policy Holodeck · 2D tabletop prototype</h4>
    <p><strong>Simulation not forecast</strong> · Fictional city discussion board. No governmental authorization or public consensus is implied.</p>
    <p>Opt in, choose an intervention, then place it and explicitly run the model below. One intervention at a time; placement replaces the previous choice. No run starts on placement.</p>
    <button type="button" disabled={disabled} aria-pressed={enabled} onClick={()=>setEnabled(!enabled)}>{enabled?'Close tabletop':'Open tabletop'}</button>
    {enabled&&<>
      <p>Low-power mode: native 2D controls, no map tiles, animation or location access. Drag a card onto the board, or select it and use Place selected intervention with keyboard or touch.</p>
      <fieldset disabled={disabled}>
        <legend>Allowlisted model interventions</legend>
        {actions.map(action=><label key={action.id} className="tabletop-action" draggable={!disabled}
          onDragStart={event=>event.dataTransfer.setData('application/x-civic-law',String(action.id))}>
          <input type="radio" name="tabletop-action" value={action.id} checked={selected===action.id} onChange={()=>setSelected(action.id)}/>{action.label}
        </label>)}
        <p>Drainage unavailable: no reviewed mechanism or receipt contract. Combined and spatial effects are unavailable.</p>
        <div className="tabletop-slot" onDragOver={event=>event.preventDefault()} onDrop={event=>{
          event.preventDefault();const raw=event.dataTransfer.getData('application/x-civic-law');
          if(/^(21|22|23|83)$/.test(raw))place(Number(raw));
        }}>
          <strong>Fictional city · intervention slot</strong>
          <p role="status">{placed?`${placed.label} placed. Use Run two futures below to request model evidence.`:'No intervention placed. No consequences calculated.'}</p>
          <button type="button" onClick={()=>place(selected)}>Place selected intervention</button>
        </div>
      </fieldset>
      <p>Source: the reviewed HBL law mappings used by the model controls below. Labels are mechanism references, not enacted-law status. Placement is a discussion aid and is not sent as a geographic input. Changing the model controls below supersedes this card.</p>
      <p>Costs: unavailable in this receipt contract; no budget or cost savings are calculated. Empirical effect estimates, observation timestamps and calibrated uncertainty intervals are unavailable. Only returned synthetic checkpoints are displayed below, with model version, seed and model clock.</p>
      <p>Local page memory only; reload clears this board. No journal, vote, identity or location is sent. Running sends only the reviewed law, strength, fixed seed and bounded synthetic population to the existing model provider. Participation remains advisory; placing a card records no vote.</p>
    </>}
  </section>;
}
