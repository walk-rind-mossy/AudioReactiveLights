// DOM handles, global state, params, small helpers
'use strict';
const $ = s => document.querySelector(s);
const audio = $('#audio'), fileInput=$('#fileInput');
const state={ctx:null,analyser:null,source:null,buffer:null,rawBuffer:null,file:null,audioUrl:null,duration:0,playing:false,loop:false,rawFeatures:[],features:[],events:[],sampleRate:44100,raf:0,lastFrame:-1,zoom:1,trackIds:[],featureVisible:{},ab:false,abData:null,selectedFeature:'energy',selectedLightOutput:'lightMain',follow:true,expandedFeatures:{},selectedEvent:null,analysisStartedAt:0,analysisProgress:0,analysisBusy:false,programmaticMapScroll:false,analysisVersion:'3.1-final-clean-timeline-light-audio-fix',inspectorRevision:0,liveAnalysisPending:false,liveAnalysisActive:false,liveAnalyzerSource:null,liveLastSampleTime:-1,liveLastReprocessCount:0,lightPreview:null,lightPreviewDirty:true,lightOutputExpanded:false,lightSelectionActive:false,lightSelectionSnapshot:null,lastTimelineScrollLeft:0,analysisErrorStage:null};
const params={eventSensitivity:.62,eventSpacing:.16,energySmooth:.25,bassBodySmooth:.45,bassImpactSmooth:.06,bassImpactSensitivity:.58,bassImpactBaseline:.35,bassImpactSpacing:.18,beatSensitivity:.58,beatSpacing:.28,beatTolerance:.42,chaosSensitivity:1,dropSensitivity:.58,dropContext:3,dropSpacing:4,shortWin:.25,mediumWin:2.5,longWin:10,calibration:5,noteSmooth:.30,notePersistence:.45,noteHysteresis:.08};
window.MML={audio,state,params,version:state.analysisVersion};
function fmtTime(t){ if(!isFinite(t))t=0; const m=Math.floor(t/60),s=Math.floor(t%60),ms=Math.floor((t%1)*1000); return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+'.'+String(ms).padStart(3,'0'); }
function clamp(x,a=0,b=1){return x<a?a:x>b?b:x}
function median(a){if(!a.length)return 0; const b=a.slice().sort((x,y)=>x-y); const m=Math.floor(b.length/2); return b.length%2?b[m]:(b[m-1]+b[m])/2}
function avg(a){return a.length?a.reduce((s,x)=>s+x,0)/a.length:0}
function download(name,text,type='text/plain'){const blob=new Blob([text],{type}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function param(id){const el=$('#'+id); return +el.value}
