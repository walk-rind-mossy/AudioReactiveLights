// Playhead, inspectors, event browser
'use strict';
function updatePlayhead(){
 const p=audio.currentTime||0;
 $('#timeNow').textContent=fmtTime(p);
 $('#inspectorTime').textContent=fmtTime(p);
 positionPlayheads();
 followPlayhead();
 refreshCompactControls();
 updateLightOutputValues();
 updateInspector(p);
 updateLightOutputInspector(false);
 if(state.lightPreviewDirty){
   buildLightPreviewSeries();
   paintTimelineCanvases();
 }
 tickSign(); // was a monkey-patch wrapper at the end of the old file
}
function updateLightOutputInspector(force=false){
 const host=$('#lightOutputInspector');if(!host)return;
 if(!state.lightSelectionActive){
   if(host.dataset.lightKey!=='none'||force){
     host.dataset.lightKey='none';
     host.innerHTML='<div class="muted">No light output selected. Click a pinned light variable to inspect its trace.</div>';
   }
   return;
 }
 const def=lightOutputDefs.find(d=>d.id===state.selectedLightOutput)||lightOutputDefs[0];
 const key=def.id;
 const p=lightValueAt(audio.currentTime||0);
 let output='—';
 if(p){
   if(def.id==='lightMain')output=Math.round(p.main*100)+'%';
   else if(def.id==='lightBack')output=Math.round(p.back*100)+'%';
   else if(def.id==='lightArrows')output=Math.round(p.left*100)+' / '+Math.round(p.right*100)+'%';
   else if(def.id==='lightAccent')output=Math.round(p.accent*100)+'%';
   else if(def.id==='lightDrop')output=Math.round(p.drop*100)+'%';
   else output='COLOR';
 }
 if(host.dataset.lightKey!==key||force){
   const v=valueAt(audio.currentTime||0)||{};
   const drivers=def.drivers||[];
   const driverRows=drivers.map(id=>{
     const label=featureDefs.find(d=>d.id===id)?.name||id;
     let val='—';
     if(v){
       if(id==='energy')val=v.energyRelative.toFixed(2);
       if(id==='bass')val=v.bassRelative.toFixed(2);
       if(id==='activity')val=v.activityRelative.toFixed(2);
       if(id==='kick')val=v.bassImpactNorm.toFixed(2);
       if(id==='beat')val=v.rhythmicScore.toFixed(2);
       if(id==='chaos')val=v.chaos.toFixed(2);
       if(id==='drop')val=v.dropScore.toFixed(2);
       if(id==='chroma')val=v.dominantConfidence.toFixed(2);
       if(id==='spectral')val=clamp(v.centroid/5000).toFixed(2);
     }
     return `<div class="kv-block"><div class="k">${label}</div><div class="v" data-light-driver="${id}">${val}</div></div>`;
   }).join('');
   host.dataset.lightKey=key;
   host.innerHTML=`<div class="inspector-label">Selected light output</div><div class="bigtime" style="font-size:18px;margin:4px 0 7px">${def.name} · <span data-light-inspector-output>${output}</span></div><div class="debug-copy">${def.desc}</div><div class="inspector-label">Drivers</div>${driverRows}<div class="inspector-label">Trace</div><div class="debug-copy">${drivers.map(id=>featureDefs.find(d=>d.id===id)?.name||id).join('  →  ')}  →  ${def.name}</div>`;
   return;
 }
 const liveOut=host.querySelector('[data-light-inspector-output]');
 if(liveOut)liveOut.textContent=output;
}
function updateInspector(forceT){
 if(state.lightSelectionActive){
   const card=$('#selectedCard');
   const key=state.selectedLightOutput||'none';
   $('#selectedTitle').textContent='Selected Light Output';
   if(card.dataset.lightSelectKey!==key){
     card.dataset.lightSelectKey=key;
     card.innerHTML='<div class="muted">'+((lightOutputDefs.find(d=>d.id===key)||lightOutputDefs[0]).name)+' is selected. Driver variables are highlighted in the timeline; full output details are in Light Output Trace.</div>';
   }
   updateLightOutputInspector(false);
   return;
 }

 const t=forceT??audio.currentTime??0,v=valueAt(t),selected=featureDefs.find(d=>d.id===state.selectedFeature),host=$('#selectedCard');
 if(v)updateLiveState(t,v);
 if(!selected){host.dataset.key='none';host.innerHTML='<div class="muted">Select a variable row.</div>';return}
 if(!v){host.dataset.key='empty';host.innerHTML='<div class="muted">Load an audio file to inspect '+selected.name+'.</div>';return}
 $('#selectedTitle').textContent=selected.name;
 const info=currentForCompact(selected,v);
 const spectralLive=$('#spectralLive'); if(spectralLive){const vals={centroid:v.centroid.toFixed(0)+' Hz',flatness:v.flatness.toFixed(3),bandwidth:v.bandwidth.toFixed(0)+' Hz',rolloff:v.rolloff.toFixed(0)+' Hz'};Object.entries(vals).forEach(([k,val])=>{const el=spectralLive.querySelector('[data-spectral-live=\"'+k+'\"]');if(el){el.textContent=val;el.style.color='';}});}
 const selectedSpectral=$('#selectedCard'); if(selected.id==='spectral'&&selectedSpectral){const vals={centroid:v.centroid.toFixed(0)+' Hz',flatness:v.flatness.toFixed(3),bandwidth:v.bandwidth.toFixed(0)+' Hz',rolloff:v.rolloff.toFixed(0)+' Hz'};Object.entries(vals).forEach(([k,val])=>{const el=selectedSpectral.querySelector('[data-selected-spectral=\"'+k+'\"]');if(el)el.textContent=val;});}
 const debugOn=!!$('#debugMode').dataset.on;
 const key=[selected.id,debugOn,state.ab&&state.abData?.id===selected.id,state.inspectorRevision].join('|');
 if(host.dataset.key===key){
   const live=host.querySelector('[data-selected-live]'); if(live)live.textContent=info.value;
   const badge=host.querySelector('[data-selected-badge]'); if(badge)badge.textContent=info.badge;
   const fill=host.querySelector('[data-selected-meter]'); if(fill){const meter=Math.min(1,Math.max(0,selected.meter?selected.meter(v):0));fill.style.width=Math.round(meter*100)+'%';}
   return;
 }
 let detail='';
 if(selected.id==='energy')detail=`<div class="kv-block"><div class="k">Raw</div><div class="v" style="color:#9aa7b8">${v.energy.toFixed(4)}</div><div class="k">Smoothed</div><div class="v" style="color:#6ee7ff">${v.energySmooth.toFixed(3)}</div><div class="k">Normalized</div><div class="v" style="color:#a78bfa">${v.energyNorm.toFixed(3)}</div><div class="k">Relative</div><div class="v" style="color:#6ee7a8">${v.energyRelative.toFixed(3)}</div></div>`;
 if(selected.id==='bass')detail=`<div class="kv-block"><div class="k">BODY · Raw</div><div class="v">${v.bassBodyRaw.toFixed(4)}</div><div class="k">BODY · Smoothed</div><div class="v" style="color:#a78bfa">${v.bassSmooth.toFixed(3)}</div><div class="k">BODY · Normalized</div><div class="v">${v.bassNorm.toFixed(3)}</div><div class="k">BODY · Relative</div><div class="v">${v.bassRelative.toFixed(3)}</div><div class="k">IMPACT · Raw</div><div class="v">${v.bassImpactRaw.toFixed(4)}</div><div class="k">IMPACT · Processed</div><div class="v">${v.bassImpactProcessed.toFixed(3)}</div><div class="k">IMPACT · Normalized</div><div class="v" style="color:#ffd166">${v.bassImpactNorm.toFixed(3)}</div><div class="k">IMPACT · Relative</div><div class="v">${v.bassImpactRelative.toFixed(3)}</div><div class="k">Impact confidence</div><div class="v">${v.bassImpactNorm.toFixed(3)}</div></div>`;
 if(selected.id==='activity')detail=`<div class="kv-block"><div class="k">Raw flux</div><div class="v" style="color:#9aa7b8">${v.activity.toFixed(4)}</div><div class="k">Smoothed</div><div class="v" style="color:#6ee7ff">${v.activitySmooth.toFixed(3)}</div><div class="k">Normalized</div><div class="v" style="color:#a78bfa">${v.activityNorm.toFixed(3)}</div><div class="k">Relative</div><div class="v" style="color:#6ee7a8">${v.activityRelative.toFixed(3)}</div></div>`;
 if(selected.id==='transient')detail=`<div class="kv-block"><div class="k">Raw</div><div class="v">${v.transientRaw.toFixed(4)}</div><div class="k">Processed</div><div class="v">${v.transientProcessed.toFixed(3)}</div><div class="k">Normalized</div><div class="v" style="color:#ffd166">${v.transientNorm.toFixed(3)}</div><div class="k">Relative</div><div class="v">${v.transientRelative.toFixed(3)}</div><div class="k">Sensitivity</div><div class="v">${params.eventSensitivity.toFixed(2)}</div><div class="k">Min gap</div><div class="v">${params.eventSpacing.toFixed(2)} s</div><div class="k">Confidence</div><div class="v">${v.transientConfidence.toFixed(3)}</div></div>`;
 if(selected.id==='beat')detail=`<div class="kv-block"><div class="k">Raw candidate</div><div class="v">${v.rhythmicRaw.toFixed(3)}</div><div class="k">Processed</div><div class="v">${v.rhythmicProcessed.toFixed(3)}</div><div class="k">Normalized</div><div class="v" style="color:#6ee7a8">${v.rhythmicNorm.toFixed(3)}</div><div class="k">Relative</div><div class="v">${v.rhythmicRelative.toFixed(3)}</div><div class="k">Confidence</div><div class="v">${v.rhythmicConfidence.toFixed(3)}</div><div class="k">Spacing</div><div class="v">${v.beatSpacing?v.beatSpacing.toFixed(2)+' s':'—'}</div></div>`;
 if(selected.id==='kick')detail=`<div class="kv-block"><div class="k">Raw</div><div class="v">${v.bassImpactRaw.toFixed(4)}</div><div class="k">Processed</div><div class="v">${v.bassImpactProcessed.toFixed(3)}</div><div class="k">Normalized</div><div class="v" style="color:#ffd166">${v.bassImpactNorm.toFixed(3)}</div><div class="k">Relative</div><div class="v">${v.bassImpactRelative.toFixed(3)}</div><div class="k">Confidence</div><div class="v">${v.bassImpactNorm.toFixed(3)}</div><div class="k">Min gap</div><div class="v">${params.bassImpactSpacing.toFixed(2)} s</div></div>`;
 if(selected.id==='spectral')detail=`<div class="kv-block spectral-selected-live"><div class="k">Centroid</div><div class="v" data-selected-spectral="centroid" style="color:#c4b5fd">${v.centroid.toFixed(0)} Hz</div><div class="k">Flatness</div><div class="v" data-selected-spectral="flatness" style="color:#93c5fd">${v.flatness.toFixed(3)}</div><div class="k">Bandwidth</div><div class="v" data-selected-spectral="bandwidth" style="color:#86efac">${v.bandwidth.toFixed(0)} Hz</div><div class="k">Rolloff</div><div class="v" data-selected-spectral="rolloff" style="color:#f9a8d4">${v.rolloff.toFixed(0)} Hz</div></div>`;
 if(selected.id==='chroma')detail=`<div class="kv-block"><div class="k">Dominant note</div><div class="v">${v.dominantNote}</div><div class="k">Confidence</div><div class="v">${v.dominantConfidence.toFixed(3)}</div><div class="k">Persistence</div><div class="v">${v.dominantPersistenceSeconds.toFixed(2)} s</div><div class="k">Previous note</div><div class="v">${v.previousDominantNote||'—'}</div><div class="k">Note-change</div><div class="v">${v.dominantNoteChanged?'YES':'NO'}</div>${debugOn?`<div class="k">12-class normalized chroma</div><div class="v">${(v.chromaNorm||[]).map((x,i)=>notes[i]+': '+x.toFixed(2)).join(' · ')}</div>`:''}</div>`;
 if(selected.id==='chaos')detail=`<div class="kv-block"><div class="k">Raw</div><div class="v">${v.chaosRaw.toFixed(3)}</div><div class="k">Processed</div><div class="v">${v.chaosProcessed.toFixed(3)}</div><div class="k">Normalized</div><div class="v" style="color:#fb7185">${v.chaosNorm.toFixed(3)}</div><div class="k">Relative</div><div class="v">${v.chaosRelative.toFixed(3)}</div>${debugOn?`<div class="k">Feature variability</div><div class="v">${v.chaosComponentFeature.toFixed(3)}</div><div class="k">Event timing irregularity</div><div class="v">${v.chaosComponentTiming.toFixed(3)}</div><div class="k">Event-density change</div><div class="v">${v.chaosComponentDensity.toFixed(3)}</div><div class="k">Spectral instability</div><div class="v">${v.chaosComponentSpectral.toFixed(3)}</div>`:''}</div>`;
 if(selected.id==='drop')detail=`<div class="kv-block"><div class="k">Raw</div><div class="v">${v.dropRaw.toFixed(3)}</div><div class="k">Processed</div><div class="v">${v.dropProcessed.toFixed(3)}</div><div class="k">Normalized</div><div class="v" style="color:#fbbf24">${v.dropNorm.toFixed(3)}</div><div class="k">Relative</div><div class="v">${v.dropRelative.toFixed(3)}</div><div class="k">Confidence</div><div class="v">${v.dropConfidence.toFixed(3)}</div>${debugOn?`<div class="k">Buildup</div><div class="v">${v.dropBuildup.toFixed(3)}</div><div class="k">Energy jump</div><div class="v">${v.dropEnergyJump.toFixed(3)}</div><div class="k">Bass-body change</div><div class="v">${v.dropBassBodyChange.toFixed(3)}</div><div class="k">Bass-impact</div><div class="v">${v.dropBassImpact.toFixed(3)}</div><div class="k">Activity jump</div><div class="v">${v.dropActivityJump.toFixed(3)}</div>`:''}</div>`;
 const meter=Math.min(1,Math.max(0,selected.meter?selected.meter(v):0));
 host.innerHTML=`<div class="inspector-card"><h4>${selected.name} <span class="ui-badge" data-selected-badge>${info.badge}</span>${state.ab&&state.abData?.id===selected.id?' <span class="ui-badge ab-badge">A / B</span>':''}</h4><div class="kv-block"><div class="k">Live</div><div class="v" data-selected-live style="color:${selected.color}">${info.value}</div><div class="meter"><i data-selected-meter style="width:${Math.round(meter*100)}%"></i></div></div>${detail}<div class="inspector-label">Definition</div><div class="debug-copy">${selected.desc}</div><div class="inspector-label">Source</div><div class="debug-copy">${selected.source}</div>${debugOn?`<div class="inspector-label">Pipeline</div><div class="inspector-pipeline">${selected.pipeline.replaceAll(' → ','<br>↓<br>')}</div>`:''}<div class="action-row" style="margin-top:9px"><button class="ui-btn" id="duplicateSelected">${state.ab?'Remove B':'Create B'}</button><button class="ui-btn" id="resetSelected">Reset</button></div></div>`;
 host.dataset.key=key;
 $('#duplicateSelected').addEventListener('click',toggleAB);$('#resetSelected').addEventListener('click',()=>resetFeatureParams(selected.id));
 const ev=state.selectedEvent;if(ev)showEvent(ev);
}
function showEvent(e){state.selectedEvent=e;const host=$('#currentEventCard');host.innerHTML=`<div class="event-card"><div class="top"><span class="type">${e.type}</span><span>${fmtTime(e.t)}</span></div><div class="sub">strength ${e.strength.toFixed(2)} · confidence ${e.confidence.toFixed(2)}</div><div class="sub">${Object.entries(e.values||{}).map(([k,v])=>k+': '+(typeof v==='number'?v.toFixed(2):v)).join(' · ')}</div></div>`;host.querySelector('.event-card').addEventListener('click',()=>{audio.currentTime=e.t;updatePlayhead()});renderEventBrowser(e.t)}
function renderEventBrowser(t){const host=$('#eventBrowser');if(!host)return;const events=state.events.slice().sort((a,b)=>a.t-b.t).slice(-10);host.innerHTML=events.map(e=>`<div class="event-row" data-time="${e.t}"><span class="time">${fmtTime(e.t)}</span><span class="type">${e.type}</span><span class="meta">${e.strength.toFixed(2)}</span></div>`).join('');host.querySelectorAll('.event-row').forEach(row=>row.addEventListener('click',()=>{const ev=state.events.find(x=>Math.abs(x.t-(+row.dataset.time))<1e-7);if(ev){state.selectedEvent=ev;audio.currentTime=ev.t;state.selectedFeature=({TRANSIENT:'transient','RHYTHMIC EVENT':'beat','BASS IMPACT':'kick',DROP:'drop','DOMINANT NOTE CHANGE':'chroma'}[ev.type]||state.selectedFeature);updatePlayhead();showEvent(ev)}}));}
