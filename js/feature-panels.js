// Advanced parameter panels and help text
'use strict';
function levelLabel(v){if(v==null||!isFinite(v))return '—';return v>=.72?'HIGH':v>=.38?'MED':'LOW'}
function currentForCompact(def,v){
 if(!v)return {value:'—',badge:'—',micro:'',metrics:[]};
 if(def.id==='energy')return {value:v.energySmooth.toFixed(2),badge:levelLabel(v.energySmooth),micro:'smoothed energy',metrics:[['RAW',v.energy],['SMOOTH',v.energySmooth],['NORM',v.energyNorm],['REL',v.energyRelative]]};
 if(def.id==='bass')return {value:v.bassSmooth.toFixed(2),badge:levelLabel(v.bassSmooth),micro:'body + independent low-frequency impact',metrics:[['BODY',v.bassSmooth],['IMPACT',v.bassImpactNorm]]};
 if(def.id==='activity')return {value:v.activitySmooth.toFixed(2),badge:levelLabel(v.activitySmooth),micro:'spectral change',metrics:[['RAW',v.activity],['SMOOTH',v.activitySmooth],['NORM',v.activityNorm],['REL',v.activityRelative]]};
 if(def.id==='transient')return {value:v.transientNorm.toFixed(2),badge:'EVENT',micro:`sensitivity ${params.eventSensitivity.toFixed(2)} · gap ${params.eventSpacing.toFixed(2)}s`,metrics:[]};
 if(def.id==='beat')return {value:v.rhythmicScore.toFixed(2),badge:'RHYTHM',micro:`confidence ${v.rhythmicConfidence.toFixed(2)} · gap ${params.beatSpacing.toFixed(2)}s`,metrics:[]};
 if(def.id==='kick')return {value:v.bassImpactNorm.toFixed(2),badge:'IMPACT',micro:`sensitivity ${params.bassImpactSensitivity.toFixed(2)} · gap ${params.bassImpactSpacing.toFixed(2)}s`,metrics:[]};
 if(def.id==='spectral')return {value:`${(v.centroid/1000).toFixed(1)}k`,badge:'SPECT',micro:`flat ${v.flatness.toFixed(2)} · bw ${(v.bandwidth/1000).toFixed(1)}k · roll ${(v.rolloff/1000).toFixed(1)}k`,metrics:[]};
 if(def.id==='chroma')return {value:`${v.dominantNote} · ${v.dominantConfidence.toFixed(2)}`,badge:'NOTE',micro:`persist ${(v.dominantPersistenceSeconds||0).toFixed(2)}s · prev ${v.previousDominantNote||'—'}`,metrics:[]};
 if(def.id==='chaos')return {value:v.chaos.toFixed(2),badge:levelLabel(v.chaos),micro:`sensitivity ${params.chaosSensitivity.toFixed(2)} · window ${params.shortWin.toFixed(2)}s`,metrics:[]};
 if(def.id==='drop')return {value:v.dropScore.toFixed(2),badge:v.dropScore>=params.dropSensitivity?'ACTIVE':'INACTIVE',micro:`sensitivity ${params.dropSensitivity.toFixed(2)} · context ${params.dropContext.toFixed(1)}s · gap ${params.dropSpacing.toFixed(1)}s`,metrics:[]};
 return {value:'—',badge:'—',micro:'',metrics:[]}
}
function paramSpec(def){
 const specs={
  energy:[['energySmooth','Smoothing','s',.05,2,.01]],
  bass:[['bassBodySmooth','Body smoothing','s',.10,2,.01],['bassImpactSmooth','Impact smoothing','s',.02,.25,.01],['bassImpactSensitivity','Impact sensitivity','x',.1,1,.01],['bassImpactBaseline','Impact baseline','s',.15,1,.01],['bassImpactSpacing','Impact min gap','s',.05,1.5,.01]],
  activity:[['mediumWin','Context','s',1,6,.1]],
  transient:[['eventSensitivity','Sensitivity','x',.1,1,.01],['eventSpacing','Min gap','s',.05,1.5,.01]],
  beat:[['beatSensitivity','Sensitivity','x',.1,1,.01],['beatSpacing','Min gap','s',.08,2,.01],['beatTolerance','Spacing tolerance','x',.15,.9,.01]],
  kick:[['bassImpactSensitivity','Sensitivity','x',.1,1,.01],['bassImpactSpacing','Min gap','s',.05,1.5,.01]],
  spectral:[],chroma:[['noteSmooth','Smoothing','s',.05,1,.01],['notePersistence','Persistence','s',.1,2,.05],['noteHysteresis','Hysteresis','x',.01,.3,.01]],
  chaos:[['chaosSensitivity','Sensitivity','x',.1,2,.01],['shortWin','Window','s',.1,.8,.01]],
  drop:[['dropSensitivity','Sensitivity','x',.1,1,.01],['dropContext','Buildup context','s',1,8,.25],['dropSpacing','Min gap','s',1,12,.25]]};
 return specs[def.id]||[];
}
function formatParam2(v,unit){if(unit==='s')return (v<1?v.toFixed(2):v.toFixed(1))+' s';return v.toFixed(2)}
function capsuleHelp(def,badge){const m={LOW:'Current value is in the lower part of the normalized range.',MED:'Current value is in the middle part of the normalized range.',HIGH:'Current value is in the upper part of the normalized range.',EVENT:'Transient/event strength. The marker appears when the detector crosses its configured conditions.',BEAT:'Beat-like detector confidence at the current time.',KICK:'Low-frequency transient / kick-like detector at the current time.',SPECT:'Spectral-character summary; the current value shown is the spectral centroid.',NOTE:'Dominant pitch-class estimate and its confidence. This is experimental, not guaranteed note recognition.',ACTIVE:'Drop detector currently exceeds its configured threshold.',INACTIVE:'Drop detector is currently below its configured threshold.'};return m[badge]||('Live state for '+def.name+'.')}
function metricHelp(k){const m={RAW:'The direct feature measurement before processing.',SMOOTH:'The feature after temporal smoothing.',NORM:'Robustly normalized for comparison across this track.',REL:'A robust track-relative measure used to answer how unusual this value is within this song.',BODY:'Sustained low-frequency body after slow smoothing.',IMPACT:'Short low-frequency rise / impact signal; it should fall during sustained bass.',TRANSIENT:'General short-term spectral-change strength, independent of bass impact.',NORMAL:'Normalized low-frequency body representation.'};return m[k]||'A live value from the current analysis pipeline.'}
function buildAdvanced(def){
 const box=document.createElement('div'); box.className='advanced';
 const specs=paramSpec(def);
 const v=valueAt(audio.currentTime||0);
 let metrics='';
 if(v){
  const list=[];
  if(def.id==='energy') list.push(['RAW',v.energy.toFixed(3)],['SMOOTH',v.energySmooth.toFixed(3)],['NORM',v.energyNorm.toFixed(3)],['REL',v.energyRelative.toFixed(3)]);
  if(def.id==='bass') list.push(['BODY',v.bassSmooth.toFixed(3)],['IMPACT',v.bassImpactNorm.toFixed(3)]);
  if(def.id==='activity') list.push(['RAW',v.activity.toFixed(3)],['SMOOTH',v.activitySmooth.toFixed(3)],['NORM',v.activityNorm.toFixed(3)],['REL',v.activityRelative.toFixed(3)]);
  if(list.length) metrics='<div class="expanded-metrics">'+list.map(([k,x])=>`<div class="metric-mini" data-tip="${metricHelp(k)}"><b>${k}</b><span data-live-metric="${k}" style="color:${liveColors[k]||def.color}">${x}</span></div>`).join('')+'</div>';
 }
 box.insertAdjacentHTML('beforeend',metrics);
 const grid=document.createElement('div'); grid.className='advanced-grid';
 for(const [id,label,unit,min,max,step] of specs){
   const block=document.createElement('div'); block.className='param-block';
   const top=document.createElement('div'); top.className='param-top';
   const lab=document.createElement('span'); lab.className='param-label'; lab.textContent=label;
   const num=document.createElement('input'); num.type='text'; num.inputMode='decimal'; num.className='ui-input param-number'; num.value=formatParam2(params[id],unit); num.setAttribute('aria-label',label+' numeric value');
   const range=document.createElement('input'); range.type='range'; range.min=min; range.max=max; range.step=step; range.value=params[id]; range.className='ui-range param-range'; range.title='Adjust the slider or enter an exact value above.'; range.setAttribute('aria-label',label+' slider');
   const sync=(raw)=>{
    const cleaned=String(raw).replace(',','.'); let value=parseFloat(cleaned); if(!isFinite(value)) value=params[id];
    value=Math.max(min,Math.min(max,value)); params[id]=value; range.value=value; num.value=formatParam2(value,unit);
    if(state.features.length) reprocess();
   };
   range.addEventListener('click',e=>e.stopPropagation()); range.addEventListener('input',e=>{e.stopPropagation();sync(e.target.value)});
   num.addEventListener('click',e=>e.stopPropagation()); num.addEventListener('keydown',e=>{if(e.code==='Space')e.stopPropagation()}); num.addEventListener('change',e=>sync(e.target.value)); num.addEventListener('blur',e=>sync(e.target.value));
   top.append(lab,num); block.append(top,range); grid.appendChild(block);
 }
 box.appendChild(grid);
 return box;
}
