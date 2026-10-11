// Light preview series and light output selection
'use strict';
function markLightPreviewDirty(){state.lightPreviewDirty=true;}
function deterministicJitter(n){const x=Math.sin(n*12.9898)*43758.5453;return x-Math.floor(x);}
function noteColorForPreview(v){const ni=Number.isFinite(v.dominantNote)?v.dominantNote:-1;if(signState.noteColor&&ni>=0&&(v.dominantConfidence||0)>.18)return noteColors[(ni+1)%12];return signState.theme==='auto'?currentSpaceColor(v):(signThemes[signState.theme]||signThemes.pink).main;}
function buildLightPreviewSeries(){
 if(!state.features?.length||!state.duration){state.lightPreview=null;state.lightPreviewDirty=false;return null;}
 const f=state.features,out={t:[],main:[],floor:[],back:[],left:[],right:[],accent:[],drop:[],backColor:[],mainColor:[],leftColor:[],rightColor:[],accentColor:[]};
 let main=signState.profile?signState.profile.mainFloor:signState.manualFloor,back=.02,left=.05,right=.05,dropPulse=0,lastT=f[0].t||0;
 const evs=state.events.slice().sort((a,b)=>a.t-b.t);let ei=0;const accentQueue=[];
 for(const v of f){const t=v.t,step=Math.min(.06,Math.max(.016,t-lastT||.016));
  while(ei<evs.length&&evs[ei].t<=t){const e=evs[ei++];if(e.type==='RHYTHMIC EVENT'){const rhythm=mapRel(v.rhythmicScore||e.strength||.4,'rhythmic'),chaos=mapRel(v.chaosNorm||0,'chaos');const j=.78+.44*deterministicJitter(Math.round(e.t*1000)+17);const peak=clamp01((.10+.82*rhythm)*signState.accentGain*(.90+.58*signState.accentChaos*chaos)*j);accentQueue.push({t:e.t,target:peak,decay:(.65+.55*deterministicJitter(Math.round(e.t*1000)+31)+.85*signState.accentChaos)*signState.accentDecay});}else if(e.type==='DROP')dropPulse=Math.max(dropPulse,clamp01(e.strength||0));}
  const theme=signState.theme==='auto'?{main:currentSpaceColor(v),arrowL:currentSpaceColor(v),arrowR:currentSpaceColor(v)}:(signThemes[signState.theme]||signThemes.pink);
  const energy=mapRel(v.energyRelative,'energy'),bass=mapRel(v.bassRelative,'bass'),activity=mapRel(v.activityRelative,'activity'),impact=mapRel(v.bassImpactNorm,'impact');
  const pressure=clamp01(.58*bass+.24*impact+.18*energy),sustained=clamp01(.58*energy+.30*bass+.12*activity);const autoFloor=signState.autoCalibrate&&signState.profile?signState.profile.mainFloor:signState.manualFloor;const floor=clamp01(autoFloor+(signState.autoCalibrate?clamp(signState.mainBase,-.15,.15):0));const mainDynamic=clamp01(.55*Math.pow(sustained,1.20)+.45*Math.pow(pressure,1.05));const mainTarget=clamp01(floor+(1-floor)*signState.mainEnergy*.72*mainDynamic+(1-floor)*signState.mainBass*.48*Math.pow(pressure,1.18));
  const medium=clamp01(.44*energy+.34*bass+.18*activity+.04*clamp01(v.centroid/5000)),arrowTarget=clamp01(.035+.66*medium*signState.arrowGain),directional=.10*signState.arrowContrast*(activity-.5),leftTarget=clamp01(arrowTarget+directional),rightTarget=clamp01(arrowTarget-directional),arrowAlpha=1-Math.exp(-step*Math.max(.08,signState.arrowResponse));
  main=interp(main,mainTarget,1-Math.exp(-step*.62));left=interp(left,leftTarget,arrowAlpha);right=interp(right,rightTarget,arrowAlpha);const arrowImpact=dropPulse*signState.dropGain;const backTarget=clamp01(.014+.90*Math.pow(bass,.92)*signState.backBass+.12*Math.pow(impact,1.12));back=interp(back,backTarget,1-Math.exp(-step*(.46+.22*activity)));dropPulse=interp(dropPulse,0,1-Math.exp(-step*1.05));
  while(accentQueue.length&&t-accentQueue[0].t>5)accentQueue.shift();let accent=.01;for(const a of accentQueue){const age=t-a.t;if(age<0)continue;accent=Math.max(accent,clamp01(a.target*Math.exp(-age/Math.max(.25,a.decay))));}
  const quiet=energy<.16&&activity<.17&&bass<.14,breath=quiet?((Math.sin(t*.42)*.5+.5)*signState.quietBreath):0,scale=signState.brightness;
  out.t.push(t);out.main.push(clamp01((main+breath)*scale));out.floor.push(clamp01(floor*scale));out.back.push(clamp01(back));out.left.push(clamp01((left+arrowImpact*.8+breath)*scale));out.right.push(clamp01((right+arrowImpact+breath)*scale));out.accent.push(clamp01(accent*scale));out.drop.push(clamp01(arrowImpact));out.backColor.push(currentSpaceColor(v));out.mainColor.push(theme.main);out.leftColor.push(theme.arrowL);out.rightColor.push(theme.arrowR);out.accentColor.push(noteColorForPreview(v));lastT=t;
 }
 state.lightPreview=out;state.lightPreviewDirty=false;return out;
}
function lightPreviewValueAt(t){const p=state.lightPreview||buildLightPreviewSeries();if(!p||!p.t.length)return null;let lo=0,hi=p.t.length-1;while(lo<hi){const m=(lo+hi)>>1;if(p.t[m]<t)lo=m+1;else hi=m;}const i=lo>0&&Math.abs(p.t[lo-1]-t)<Math.abs(p.t[lo]-t)?lo-1:lo;return {main:p.main[i],back:p.back[i],left:p.left[i],right:p.right[i],accent:p.accent[i],drop:p.drop[i],backColor:p.backColor[i],mainColor:p.mainColor[i],leftColor:p.leftColor[i],rightColor:p.rightColor[i],accentColor:p.accentColor[i]};}
const LIGHT_ROW_HEIGHT=70;
const LIGHT_HEADER_HEIGHT=44;
const WAVEFORM_MIN_HEIGHT=76;
const RULER_MIN_HEIGHT=32;
const AUDIO_ROW_MIN_HEIGHT=70;
const AUDIO_ROW_EXPANDED_MIN_HEIGHT=176;
const lightTraceMap=Object.fromEntries(lightOutputDefs.map(d=>[d.id,{features:[...d.drivers]}]));
function styleLiveValue(el,color){if(el&&color)el.style.color=color;}
function applyLiveColors(ctl,def){if(!ctl)return;ctl.querySelectorAll('[data-metric] span,[data-live-metric]').forEach(el=>{const key=el.dataset.liveMetric||el.closest('[data-metric]')?.dataset.metric;styleLiveValue(el,liveColors[key]||def.color);});}
function lightValueAt(t){
 const p=lightPreviewValueAt(t);
 if(!p)return null;
 return p;
}
function lightOutputCompact(def){
 const p=lightValueAt(audio.currentTime||0);
 if(!p)return {value:'—',badge:'—'};
 if(def.id==='lightMain')return {value:(p.main*100).toFixed(0)+'%',badge:'INT'};
 if(def.id==='lightBack')return {value:(p.back*100).toFixed(0)+'%',badge:'INT'};
 if(def.id==='lightArrows')return {value:(p.left*100).toFixed(0)+' / '+(p.right*100).toFixed(0)+'%',badge:'L / R'};
 if(def.id==='lightAccent')return {value:(p.accent*100).toFixed(0)+'%',badge:'PULSE'};
 if(def.id==='lightDrop')return {value:(p.drop*100).toFixed(0)+'%',badge:'SPIKE'};
 return {value:'COLOR',badge:'COLOR'};
}
function restoreLightSelection(){
 if(!state.lightSelectionActive)return false;
 if(state.lightSelectionSnapshot){
   state.featureVisible={...state.lightSelectionSnapshot};
 }
 state.lightSelectionSnapshot=null;
 state.lightSelectionActive=false;
 updateLightTraceUI();
 return true;
}
function activateLightSelection(id){
 if(!id)return;
 if(!state.lightSelectionActive){state.lightSelectionSnapshot={...state.featureVisible};}
 state.lightSelectionActive=true;
 state.selectedLightOutput=id;
 const drivers=new Set(lightTraceMap[id]?.features||[]);
 for(const def of featureDefs)state.featureVisible[def.id]=drivers.has(def.id);
 updateLightTraceUI();
}
function selectLightOutput(id){
 if(!lightOutputDefs.some(d=>d.id===id))return;
 activateLightSelection(id);
 state.selectedFeature=null;
 renderTimeline();
 updateLightOutputInspector();
}
function updateLightTraceUI(){
 const active=!!state.lightSelectionActive;
 const id=state.selectedLightOutput;
 const traced=new Set(lightTraceMap[id]?.features||[]);
 document.querySelectorAll('.audio-variable-control[data-id],.audio-variable-chart[data-id]').forEach(el=>{
   const featureId=el.dataset.id;
   const source=active&&traced.has(featureId);
   el.classList.toggle('trace-source',!!source);
   el.classList.toggle('trace-dim',active&&!source);
   el.classList.toggle('temporary-disabled',active&&!source);
 });
 document.querySelectorAll('.light-variable-control[data-light-id],.light-variable-chart[data-light-id]').forEach(el=>{
   el.classList.toggle('selected',active&&el.dataset.lightId===id);
 });
}
