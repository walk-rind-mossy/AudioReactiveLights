// Zoom, calibration, per-feature parameter controls, helpers
'use strict';
function setCalibrationValue(value){const v=Math.max(0,Math.min(15,+value||0));params.calibration=v;$('#calibrationToolbar').value=v;$('#calibrationNumber').value=v;$('#calibrationValue').textContent=v.toFixed(1)+' s';if(state.features.length){reprocess();updateCalib();}}
function renderEvents(){}
function setZoom(z){state.zoom=+z;$('#zoomValue').textContent=Math.round(state.zoom*100)+'%';const zr=$('#zoomRange');if(zr)zr.value=state.zoom;renderTimeline()}
function createInfoTip(def){const b=document.createElement('span');b.className='ui-info';b.textContent='i';b.setAttribute('data-tip',def.name+' — '+def.desc+' WHAT: '+def.source+' PIPELINE: '+def.pipeline);b.setAttribute('aria-label',def.name+' definition');return b}
function valueAt(t){const f=state.features;if(!f.length)return null;let lo=0,hi=f.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(f[mid].t<t)lo=mid+1;else hi=mid}return f[lo]}
function updateLiveState(t,v){
 const host=$('#liveState'); if(!host||!v)return;
 const vals={time:fmtTime(t),energy:v.energySmooth.toFixed(2),bass:v.bassSmooth.toFixed(2),activity:v.activitySmooth.toFixed(2),chaos:v.chaos.toFixed(2),drop:v.dropScore.toFixed(2),note:v.dominantNote||'—',confidence:v.dominantConfidence?.toFixed(2)||'—'};
 Object.entries(vals).forEach(([key,val])=>{const el=host.querySelector('[data-live-state="'+key+'"]');if(el){el.textContent=val;el.style.color='';}});
}
function resetFeatureParams(id){state.inspectorRevision++;const defaults={energy:{energySmooth:.25},bass:{bassBodySmooth:.45,bassImpactSmooth:.06,bassImpactSensitivity:.58,bassImpactBaseline:.35,bassImpactSpacing:.18},activity:{mediumWin:2.5},transient:{eventSensitivity:.62,eventSpacing:.16},beat:{beatSensitivity:.58,beatSpacing:.28,beatTolerance:.42},kick:{bassImpactSensitivity:.58,bassImpactSpacing:.18},chroma:{noteSmooth:.30,notePersistence:.45,noteHysteresis:.08},chaos:{chaosSensitivity:1,shortWin:.25},drop:{dropSensitivity:.58,dropContext:3,dropSpacing:4}}[id]||{};Object.assign(params,defaults);for(const [k,v] of Object.entries(defaults)){const el=$('#'+k);if(el)el.value=v}renderTimeline();if(state.features.length)reprocess()}
function updateCalib(){if(!state.features.length){signState.profile=null;updateLightProfileUI();return;}const n=Math.min(Math.max(1,Math.round(params.calibration/.1)),state.features.length);const all={energy:state.features.map(x=>x.energy),bass:state.features.map(x=>x.bass),activity:state.features.map(x=>x.activity),bassImpact:state.features.map(x=>x.bassImpactProcessed||0),chaos:state.features.map(x=>x.chaosProcessed||0),drop:state.features.map(x=>x.dropProcessed||0)};state.calibrationBaseline={energy:robustBaseline(all.energy,n),bass:robustBaseline(all.bass,n),activity:robustBaseline(all.activity,n),bassImpact:robustBaseline(all.bassImpact,n),chaos:robustBaseline(all.chaos,n),drop:robustBaseline(all.drop,n)};if(typeof buildLightProfile==='function')buildLightProfile();}
function startRAF(){
 cancelAnimationFrame(state.raf);
 const tick=()=>{
   updatePlayhead();
   if(state.liveAnalysisActive && state.playing) sampleLivePlaybackAnalysis();
   if(state.playing) state.raf=requestAnimationFrame(tick);
 };
 state.raf=requestAnimationFrame(tick);
}
function refreshCompactControls(){
  const t=audio.currentTime||0,v=valueAt(t);
  for(const def of featureDefs){
    const ctl=document.querySelector('.track-control[data-id="'+def.id+'"]'); if(!ctl)continue;
    const info=currentForCompact(def,v);
    const cur=ctl.querySelector('.current'); if(cur){cur.textContent=info.value}
    const metricHost=ctl.querySelector('.live-metric-row'); if(metricHost&&info.metrics){info.metrics.forEach(([k,val])=>{const box=metricHost.querySelector('[data-metric="'+k+'"]');if(box){const el=box.querySelector('span');if(el){el.textContent=Number(val).toFixed(3);styleLiveValue(el,liveColors[k]||def.color);}}})}
    const pill=ctl.querySelector('.state-pill'); if(pill){const enabled=state.featureVisible[def.id];pill.textContent=enabled?info.badge:'OFF';pill.className='ui-badge state-pill '+(enabled?(info.badge==='HIGH'?'high':info.badge==='MED'?'med':''):'off');}
    const micro=ctl.querySelector('.micro'); if(micro)micro.textContent=info.micro;
    const fill=ctl.querySelector('.mini-live-meter i'); if(fill)fill.style.width=Math.round((def.meter&&v?clamp(def.meter(v)):0)*100)+'%';
    const expandedMetrics=ctl.querySelector('.expanded-metrics'); if(expandedMetrics&&info.metrics){info.metrics.forEach(([k,val])=>{const el=expandedMetrics.querySelector('[data-live-metric="'+k+'"]');if(el){el.textContent=Number(val).toFixed(3);styleLiveValue(el,liveColors[k]||def.color);}})}
  }
}
function refreshMapVisuals(){
  renderTimeline();
  updateInspector();
  updateLightOutputInspector();
  updateCalib();
}
function reprocess(){if(!state.rawFeatures.length)return;state.inspectorRevision++;const raw=cloneFrames(state.rawFeatures);const step=raw.length>1?raw[1].t-raw[0].t:.1;state.features=postProcess(raw,step);detectEvents();refreshMapVisuals();refreshCompactControls()}
function buildABProfile(id){
 const base={...params};
 const factorMap={
   energy:{energySmooth:Math.min(2,Math.max(.05,base.energySmooth*2))},
   bass:{bassBodySmooth:Math.min(2,Math.max(.1,base.bassBodySmooth*1.6)),bassImpactSensitivity:clamp(base.bassImpactSensitivity*.82,.1,1)},
   activity:{mediumWin:Math.min(6,Math.max(1,base.mediumWin*1.4))},
   transient:{eventSensitivity:clamp(base.eventSensitivity*.78,.1,1),eventSpacing:Math.min(1.5,base.eventSpacing*1.35)},
   beat:{beatSensitivity:clamp(base.beatSensitivity*.78,.1,1),beatSpacing:Math.min(2,base.beatSpacing*1.15),beatTolerance:Math.min(.9,base.beatTolerance*1.15)},
   kick:{bassImpactSensitivity:clamp(base.bassImpactSensitivity*.78,.1,1),bassImpactSpacing:Math.min(1.5,base.bassImpactSpacing*1.25)},
   chaos:{chaosSensitivity:Math.min(2,Math.max(.1,base.chaosSensitivity*1.35)),shortWin:Math.min(.8,Math.max(.1,base.shortWin*1.6))},
   drop:{dropSensitivity:clamp(base.dropSensitivity*.8,.1,1),dropContext:Math.min(8,Math.max(1,base.dropContext*1.25)),dropSpacing:Math.min(12,Math.max(1,base.dropSpacing*1.2))}
 };
 return {...base,...(factorMap[id]||{})};
}
function toggleAB(){
 state.inspectorRevision++; const id=state.selectedFeature;
 if(!id || id==='waveform' || !state.features.length)return;
 if(state.ab && state.abData?.id===id){state.ab=false;state.abData=null;renderTimeline();return;}
 const originalParams={...params};
 const altParams=buildABProfile(id);
 const raw=cloneFrames(state.rawFeatures);
 const step=raw.length>1?raw[1].t-raw[0].t:.1;
 Object.assign(params,altParams);
 const altFeatures=postProcess(raw,step);
 const originalFeatures=state.features, originalEvents=state.events;
 state.features=altFeatures; detectEvents(); const altEvents=state.events.slice();
 state.features=originalFeatures; state.events=originalEvents; Object.assign(params,originalParams);
 state.ab=true; state.abData={id,features:altFeatures,events:altEvents,params:altParams};
 renderTimeline(); updateInspector();
}
function drawABOverlay(cv,def){
 if(!state.ab || !state.abData || state.abData.id!==def.id || !state.abData.features.length)return;
 if(!['energy','bass','activity','chaos','drop'].includes(def.id))return;
 const r=cv.parentElement.getBoundingClientRect(),w=cv.width,h=cv.height,ctx=cv.getContext('2d');const f=state.abData.features;const X=t=>t/state.duration*w;
 const get=(v)=>def.id==='energy'?v.energySmooth:def.id==='bass'?v.bassSmooth:def.id==='activity'?v.activitySmooth:def.id==='chaos'?v.chaos:v.dropScore;
 const raw=f.map(get);let mn=Infinity,mx=-Infinity;for(const q of raw){if(q<mn)mn=q;if(q>mx)mx=q}const n=x=>mx>mn?(x-mn)/(mx-mn):0.5;
 ctx.save();ctx.strokeStyle='#a78bfa';ctx.lineWidth=1.5*devicePixelRatio;ctx.setLineDash([5*devicePixelRatio,4*devicePixelRatio]);ctx.beginPath();for(let i=0;i<f.length;i++){const x=X(f[i].t),y=h*.92-(h*.84)*n(raw[i]);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();ctx.setLineDash([]);ctx.restore();
}
function drawABMarkers(track,def){
 if(!state.ab || !state.abData || state.abData.id!==def.id || !state.duration)return;
 const typeMap={transient:'TRANSIENT',beat:'RHYTHMIC EVENT',kick:'BASS IMPACT',drop:'DROP'};const type=typeMap[def.id];if(!type)return;
 const events=state.abData.events.filter(x=>x.type===type).sort((a,b)=>a.t-b.t);const width=Math.max(1,track.getBoundingClientRect().width||900);const minPx=4.5;let lastPx=-Infinity,fan=0;const offsets=[-4,-2,0,2,4];
 for(const e of events){const px=e.t/state.duration*width;if(px-lastPx<minPx)fan=Math.min(fan+1,offsets.length-1);else fan=0;const m=document.createElement('div');m.className='marker ab-marker '+def.id;m.style.color='#a78bfa';m.style.left=(e.t/state.duration*100)+'%';m.style.setProperty('--marker-offset',(offsets[fan]||0)+'px');m.title='B · '+e.type+' '+fmtTime(e.t);track.appendChild(m);lastPx=px;}
}
