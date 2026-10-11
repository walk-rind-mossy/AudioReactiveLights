// File loading, decoding, playback, live analysis
'use strict';
function guessAudioMime(file){
 const known={mp3:'audio/mpeg',m4a:'audio/mp4',mp4:'audio/mp4',aac:'audio/aac',wav:'audio/wav',wave:'audio/wav',ogg:'audio/ogg',oga:'audio/ogg',opus:'audio/ogg',webm:'audio/webm',flac:'audio/flac',aiff:'audio/aiff',aif:'audio/aiff'};
 const ext=(file.name.split('.').pop()||'').toLowerCase();
 return file.type || known[ext] || 'application/octet-stream';
}
function waitForMediaReady(media, timeoutMs=12000){
 return new Promise((resolve,reject)=>{
   if(Number.isFinite(media.duration) && media.readyState>=2){resolve();return;}
   let done=false;
   const cleanup=()=>{media.removeEventListener('loadedmetadata',onReady);media.removeEventListener('canplay',onReady);media.removeEventListener('error',onError);clearTimeout(timer)};
   const onReady=()=>{if(done)return;done=true;cleanup();resolve()};
   const onError=()=>{if(done)return;done=true;cleanup();reject(media.error||new Error('The browser could not load this audio file.'))};
   const timer=setTimeout(()=>{if(done)return;done=true;cleanup();reject(new Error('Timed out while loading the audio media element.'))},timeoutMs);
   media.addEventListener('loadedmetadata',onReady);
   media.addEventListener('canplay',onReady);
   media.addEventListener('error',onError);
 });
}
async function decodeAudioBufferRobust(arrayBuffer){
 const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;
 async function tryDecode(ctx){try{return await ctx.decodeAudioData(arrayBuffer.slice(0));}catch{return null}}
 if(Offline){
   try{const probe=new Offline(1,1,44100);const decoded=await tryDecode(probe);if(decoded)return decoded;}catch{}
 }
 if(state.ctx && state.ctx.state!=='closed'){
   const decoded=await tryDecode(state.ctx);if(decoded)return decoded;
 }
 throw new Error('The browser could not decode this complete file into PCM for offline analysis.');
}
async function ensureRealtimeAudioGraph(){
 const Ctx=window.AudioContext||window.webkitAudioContext;
 if(!Ctx) throw new Error('Web Audio API is unavailable in this browser.');
 if(!state.ctx || state.ctx.state==='closed') state.ctx=new Ctx();
 await state.ctx.resume();
 if(!state.source) connectRealtime(state.ctx);
 return state.ctx;
}
async function startLivePlaybackAnalysis(){
  if(state.liveAnalysisActive || !state.duration) return;
  await ensureRealtimeAudioGraph();
  state.liveAnalysisActive=true;
  state.liveAnalysisPending=false;
  state.liveLastSampleTime=-1;
  state.liveLastReprocessCount=0;
  state.analysisBusy=false;
  if(!document.querySelector('.track-row')) renderTimeline();
  $('#statusChip').textContent='building map from playback… 0%';
  $('#waveReadout').textContent='audio · live analysis';
  if(audio.currentTime<0.02 && state.features.length===0){
    state.rawFeatures=[]; state.features=[]; state.events=[];
  }
}
function sampleLivePlaybackAnalysis(){
  if(!state.liveAnalysisActive || !state.analyser || !state.playing) return;
  const t=audio.currentTime||0;
  if(t<=state.liveLastSampleTime || t-state.liveLastSampleTime<0.09) return;
  state.liveLastSampleTime=t;
  const analyser=state.analyser;
  const fftSize=analyser.fftSize;
  const timeData=new Float32Array(fftSize), freqData=new Float32Array(fftSize/2);
  analyser.getFloatTimeDomainData(timeData);
  analyser.getFloatFrequencyData(freqData);
  const sr=state.ctx?.sampleRate||44100, hzPer=(sr/2)/freqData.length;
  const mags=new Float32Array(freqData.length);
  let rms=0,total=1e-12,weighted=0,bwSum=0,flatLog=0,cum=0,roll=0,prev=state.rawFeatures.length?state.rawFeatures[state.rawFeatures.length-1]:null;
  let flux=0;
  for(let i=0;i<timeData.length;i++) rms+=timeData[i]*timeData[i];
  rms=Math.sqrt(rms/timeData.length);
  for(let k=0;k<freqData.length;k++){const mag=Math.pow(10,freqData[k]/20);mags[k]=mag;total+=mag;weighted+=mag*(k*hzPer)}
  const centroid=weighted/total; const rollTarget=total*.85;
  const prevMag=prev?.__liveSpectrum;
  for(let k=0;k<mags.length;k++){
    const v=mags[k];bwSum+=v*Math.abs(k*hzPer-centroid);flatLog+=Math.log(v+1e-9);cum+=v;if(!roll&&cum>=rollTarget)roll=k*hzPer;if(prevMag){const d=v-prevMag[k];if(d>0)flux+=d*d}
  }
  let bass=0,low=0;for(let k=1;k<mags.length;k++){const hz=k*hzPer,v=mags[k]*mags[k];if(hz<180)bass+=v;if(hz<120)low+=v}
  bass=Math.sqrt(bass/mags.length);low=Math.sqrt(low/mags.length);
  let zc=0;for(let i=1;i<timeData.length;i++)if((timeData[i]>=0)!==(timeData[i-1]>=0))zc++;
  const chroma=new Float32Array(12);for(let k=1;k<mags.length;k++){const hz=k*hzPer;if(hz<60||hz>4000)continue;const midi=12*Math.log2(hz/440)+69;const pc=((Math.round(midi)-69)%12+12)%12;chroma[pc]+=mags[k]*mags[k]}
  let dom=0,domv=0,totalCh=1e-9;for(let k=0;k<12;k++){totalCh+=chroma[k];if(chroma[k]>domv){domv=chroma[k];dom=k}}
  const f={t,energy:rms,bass,lowTransient:low,activity:Math.sqrt(flux),centroid,flatness:Math.exp(flatLog/mags.length)/(total/mags.length+1e-9),bandwidth:bwSum/total,rolloff:roll,zeroCrossing:zc/timeData.length,chroma:Array.from(chroma),dominantNote:notes[dom],dominantNoteIndex:dom,dominantConfidence:domv/totalCh,flux,__liveSpectrum:mags};
  state.rawFeatures.push(f);
  // Reprocess at most about 10 Hz; update existing canvases without rebuilding controls.
  if(state.rawFeatures.length-state.liveLastReprocessCount>=5){
    state.liveLastReprocessCount=state.rawFeatures.length;
    const clean=state.rawFeatures.map(x=>{const y={...x};delete y.__liveSpectrum;return y});
    const step=clean.length>1?Math.max(.01,clean[clean.length-1].t-clean[clean.length-2].t):.1;
    state.features=postProcess(cloneFrames(clean),step);
    detectEvents();
    refreshMapVisuals();
  }
  state.analysisProgress=state.duration?Math.min(100,(t/state.duration)*100):0;
  $('#statusChip').textContent='building map from playback… '+Math.round(state.analysisProgress)+'%';
  $('#waveReadout').textContent='audio · live analysis';
}
async function loadFile(file){
 if(state.lightSelectionActive){state.featureVisible={...state.lightSelectionSnapshot};state.lightSelectionSnapshot=null;state.lightSelectionActive=false;}

 state.analysisErrorStage=null;
 state.analysisBusy=true; state.analysisProgress=0; state.rawFeatures=[]; state.features=[]; state.events=[]; state.buffer=null; state.rawBuffer=null; state.analysisFallback=false; state.ab=false; state.abData=null; state.lightPreview=null; state.lightPreviewDirty=true; state.analysisStartedAt=performance.now();
 $('#statusChip').textContent='loading audio…'; $('#emptyState')?.style.setProperty('display','none'); $('#songName').textContent=file.name; state.file=file;
 if(state.audioUrl)try{URL.revokeObjectURL(state.audioUrl)}catch{}
 state.audioUrl=URL.createObjectURL(file);
 audio.pause(); if(state.ctx){try{await state.ctx.close()}catch{}} state.ctx=null; state.liveAnalyzerSource=null; state.analyser=null; state.source=null; state.gain=null; audio.removeAttribute('src'); audio.load(); audio.src=state.audioUrl; audio.volume=+$('#volume').value; audio.muted=false; audio.playbackRate=1; audio.load();
 try{
   const mime=guessAudioMime(file);
   if(audio.canPlayType(mime)==='') throw new Error(`The browser reports no playback support for ${mime}.`);
   $('#statusChip').textContent='loading media…';
   await waitForMediaReady(audio,12000);
   state.duration=audio.duration;
   $('#duration').textContent=fmtTime(state.duration);
   $('#waveReadout').textContent='audio · decoding…';
   const arr=await file.arrayBuffer();
   let decoded=null;
   try{ decoded=await decodeAudioBufferRobust(arr); }
   catch(decodeErr){
     state.analysisErrorStage='decode';
     console.warn('Offline PCM decode failed; preserving native playback and switching to progressive live analysis.',decodeErr);
   }
   if(decoded){
     state.rawBuffer=decoded;
     state.liveAnalysisPending=false; state.liveAnalysisActive=false;
     state.buffer=decoded;
     state.duration=decoded.duration;
     $('#duration').textContent=fmtTime(state.duration);
     $('#waveReadout').textContent='audio · analyzing…';
     try{
       await analyzeOffline(state.buffer);
       $('#waveReadout').textContent='audio';
       $('#statusChip').textContent='analysis ready · '+state.features.length+' frames';
     }catch(analysisErr){
       state.analysisErrorStage='analysis';
       console.error('MUSIC MAP LAB analysis/render failed',{error:analysisErr});
       throw new Error('Analysis failed after audio decoding succeeded. Check the console for the render/analysis error.');
     }
   }else{
     state.buffer=null;
     state.rawBuffer=null;
     state.liveAnalysisPending=true;
     state.liveAnalysisActive=false;
     state.duration=audio.duration;
     $('#duration').textContent=fmtTime(state.duration);
     $('#waveReadout').textContent='audio · Play to build map';
     $('#statusChip').textContent='audio ready · click Play to analyze';
     renderTimeline();
   }
   updateCalib(); updatePlayhead(); refreshCompactControls();
 }catch(err){
   console.error('MUSIC MAP LAB audio load failed',{fileName:file.name,type:file.type,size:file.size,error:err});
   state.analysisBusy=false;
   $('#statusChip').textContent='audio load failed'; $('#waveReadout').textContent='audio error'; $('#emptyState')?.style.setProperty('display','flex');
   const mime=guessAudioMime(file), canPlay=audio.canPlayType(mime);
   let msg=`Could not prepare “${file.name}” for analysis.\n\n`;
   if(state.analysisErrorStage==='analysis') msg+='The browser decoded the audio, but timeline analysis/rendering failed. The audio itself is not the problem.\n\n';
   else if(err?.name==='NotAllowedError') msg+='The browser blocked the accelerated playback-analysis fallback. Click Play once to start native playback analysis.\n\n';
   else if(canPlay) msg+=`The browser can play ${mime}, but PCM decoding was unavailable. Native playback analysis can be built after you press Play.\n\n`;
   else msg+=`The browser reports ${mime} is not supported here.\n\n`;
   msg+='The browser console contains the detailed error.';
   alert(msg);
 }
}
function connectRealtime(ac){
 if(state.source)return;
 state.source=ac.createMediaElementSource(audio);
 state.analyser=ac.createAnalyser();
 state.analyser.fftSize=2048;
 state.analyser.smoothingTimeConstant=0;
 state.gain=ac.createGain();
 state.gain.gain.value=1;
 state.source.connect(state.analyser);
 state.analyser.connect(state.gain);
 state.gain.connect(ac.destination);
}
async function togglePlay(){
 if(!audio.src)return;
 if(audio.paused){
   await ensureRealtimeAudioGraph();
   if(state.liveAnalysisPending) await startLivePlaybackAnalysis();
   await audio.play();
 }else audio.pause();
}
