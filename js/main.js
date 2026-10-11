// Event wiring and startup. Loaded last: everything it calls is defined in the other files.
'use strict';
$('#loopBtn').addEventListener('click',()=>{state.loop=!state.loop;audio.loop=state.loop;$('#loopBtn').textContent='Loop: '+(state.loop?'on':'off')});
$('#volume').addEventListener('input',e=>audio.volume=+e.target.value);
$('#restartBtn').addEventListener('click',()=>{audio.currentTime=0; updatePlayhead();});
$('#playBtn').addEventListener('click',togglePlay);
window.addEventListener('keydown',e=>{
  const tag=(e.target&&e.target.tagName||'').toLowerCase();
  const editing=['input','textarea','select','button'].includes(tag)||e.target?.isContentEditable;
  if(e.code==='Space' && !e.repeat && !editing){ e.preventDefault(); togglePlay(); return; }
  if(editing || !audio.src || !state.duration) return;
  if(e.code==='ArrowLeft'){ e.preventDefault(); audio.currentTime=Math.max(0,audio.currentTime-(e.shiftKey?5:1)); updatePlayhead(); }
  if(e.code==='ArrowRight'){ e.preventDefault(); audio.currentTime=Math.min(state.duration,audio.currentTime+(e.shiftKey?5:1)); updatePlayhead(); }
  if(e.code==='KeyR' && !e.repeat){ e.preventDefault(); audio.currentTime=0; updatePlayhead(); }
});
$('#openBtn').addEventListener('click',()=>fileInput.click());
fileInput.addEventListener('change',e=>{if(e.target.files[0])loadFile(e.target.files[0])});
$('#dropZone').addEventListener('dragover',e=>{e.preventDefault();e.currentTarget.style.borderColor='#6ee7ff'});
$('#dropZone').addEventListener('dragleave',e=>e.currentTarget.style.borderColor='');
$('#dropZone').addEventListener('drop',e=>{e.preventDefault();e.currentTarget.style.borderColor='';const f=e.dataTransfer.files[0];if(f)loadFile(f)});
const __analysisScrollReady=$('#analysisScroll'); if(__analysisScrollReady){__analysisScrollReady.addEventListener('dragover',e=>{if(e.dataTransfer?.types?.includes('Files'))e.preventDefault();});}
let dragDepth=0; const dropOverlay=$('#dropOverlay');
window.addEventListener('dragenter',e=>{if(e.dataTransfer?.types?.includes('Files')){dragDepth++;dropOverlay?.classList.add('active')}});
window.addEventListener('dragover',e=>{if(e.dataTransfer?.types?.includes('Files'))e.preventDefault()});
window.addEventListener('dragleave',e=>{if(e.dataTransfer?.types?.includes('Files')){dragDepth=Math.max(0,dragDepth-1);if(dragDepth===0)dropOverlay?.classList.remove('active')}});
window.addEventListener('drop',e=>{if(e.dataTransfer?.files?.length){e.preventDefault();dragDepth=0;dropOverlay?.classList.remove('active');const f=[...e.dataTransfer.files].find(x=>x.type.startsWith('audio/')||/\.(mp3|wav|m4a|aac|ogg|oga|opus|webm|flac|aif|aiff)$/i.test(x.name));if(f)loadFile(f)}});
$('#debugMode').addEventListener('click',()=>{const on=!$('#debugMode').dataset.on;state.inspectorRevision++; $('#debugMode').dataset.on=on?'1':'';$('#debugLabel').textContent='Debug details: '+(on?'on':'off');updateInspector()});
$('#zoomRange').addEventListener('input',e=>setZoom(+e.target.value));
$('#fitBtn').addEventListener('click',()=>setZoom(1));
$('#followBtn').addEventListener('click',()=>{state.follow=!state.follow;$('#followBtn').textContent=state.follow?'On':'Off';$('#followBtn').title=state.follow?'Playback will auto-scroll the map to keep the playhead visible.':'Auto-follow is off; horizontal map position will stay where you leave it.'});
$('#fitHeightBtn').addEventListener('click',()=>{const anyExpanded=Object.values(state.expandedFeatures||{}).some(Boolean);for(const d of featureDefs)state.expandedFeatures[d.id]=!anyExpanded;$('#fitHeightBtn').textContent=anyExpanded?'Expand all':'Compact all';renderTimeline();});
$('#calibrationToolbar').addEventListener('input',e=>setCalibrationValue(e.target.value));
$('#calibrationNumber').addEventListener('change',e=>setCalibrationValue(e.target.value));
$('#calibrationNumber').addEventListener('blur',e=>setCalibrationValue(e.target.value));
$('#calibrationNumber').addEventListener('keydown',e=>{if(e.code==='Space')e.stopPropagation()});
$('#jsonBtn').addEventListener('click',exportJSON);$('#csvBtn').addEventListener('click',exportCSV);$('#eventsCsvBtn').addEventListener('click',exportEvents);
audio.addEventListener('play',async()=>{
 state.playing=true; $('#playBtn').textContent='❚❚';
 if(state.liveAnalysisPending && !state.liveAnalysisActive){
   try{ await startLivePlaybackAnalysis(); }catch(err){ console.error('Live analysis start failed',err); state.liveAnalysisPending=true; $('#statusChip').textContent='playing · analysis unavailable'; }
 }
 startRAF();
});
audio.addEventListener('pause',()=>{state.playing=false;$('#playBtn').textContent='▶'; if(state.liveAnalysisActive) $('#statusChip').textContent='analysis paused · '+Math.round(state.analysisProgress)+'%'});
audio.addEventListener('ended',()=>{state.playing=false;$('#playBtn').textContent='▶';updatePlayhead(); if(state.liveAnalysisActive){state.liveAnalysisActive=false;state.liveAnalysisPending=false;$('#statusChip').textContent='analysis ready · '+state.features.length+' frames';}});
audio.addEventListener('timeupdate',updatePlayhead);
$('#clearEventBtn').addEventListener('click',()=>{state.selectedEvent=null;$('#currentEventCard').textContent='No event selected.'})




/* --- Integrated light/sign layer driven by MUSIC MAP --- */
const signThemes={
  pink:{main:'#ff7fd6',arrowL:'#ffd45a',arrowR:'#43d6ff'},
  cyan:{main:'#5de9ff',arrowL:'#87d8ff',arrowR:'#5de9ff'},
  amber:{main:'#ffd45a',arrowL:'#ffb24c',arrowR:'#ffd45a'},
  blue:{main:'#8ab6ff',arrowL:'#7fe7ff',arrowR:'#a78bfa'}
};
$('#lightAutoCalibrate')?.addEventListener('click',()=>{signState.autoCalibrate=!signState.autoCalibrate;markLightPreviewDirty();$('#lightAutoCalibrate').textContent=signState.autoCalibrate?'ON':'OFF';$('#lightAutoCalibrate').classList.toggle('active',signState.autoCalibrate);buildLightProfile();paintSign(audio.currentTime||0,0,true);});
$('#signDriveToggle')?.addEventListener('click',()=>{signState.drive=!signState.drive;$('#signDriveToggle').textContent=signState.drive?'ON':'OFF';$('#signDriveToggle').classList.toggle('active',signState.drive);$('#signDriveState').textContent=signState.drive?'MAP → LIGHT':'MAP OFF';paintSign(audio.currentTime||0,0,true);});
$('#lightNoteColor')?.addEventListener('click',()=>{signState.noteColor=!signState.noteColor;markLightPreviewDirty();$('#lightNoteColor').textContent=signState.noteColor?'ON':'OFF';$('#lightNoteColor').classList.toggle('active',signState.noteColor);paintLightOutputCanvases();});
document.querySelectorAll('.sign-theme').forEach(b=>b.addEventListener('click',()=>setTheme(b.dataset.theme)));
document.querySelectorAll('.sign-preset').forEach(b=>b.addEventListener('click',()=>applyPreset(b.dataset.preset)));
// Initial unified timeline render: variables, light outputs and graph lanes must exist before any audio is loaded.
for(const d of featureDefs){state.featureVisible[d.id]=true;state.expandedFeatures[d.id]=false;}
try{renderTimeline();}catch(err){console.error('Initial timeline render failed',err);}
updateCalib(); updateLightControls(); const ac=$('#lightAutoCalibrate');if(ac){ac.textContent=signState.autoCalibrate?'ON':'OFF';ac.classList.toggle('active',signState.autoCalibrate);} updateLightProfileUI(); resetSignVisual();
let resizePaintTimer=0;
window.addEventListener('resize',()=>{
  clearTimeout(resizePaintTimer);
  resizePaintTimer=setTimeout(()=>{if(state.features.length)renderTimeline();else{syncTimelineWidth();paintTimelineCanvases();}},120);
});
$('#calibrationToolbar').value=params.calibration; $('#calibrationNumber').value=params.calibration.toFixed(1); $('#calibrationValue').textContent=params.calibration.toFixed(1)+' s'; const zr=$('#zoomRange'); if(zr)zr.value=state.zoom; setZoom(1);
