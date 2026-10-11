// Timeline rows, hover, scroll, painting, renderTimeline
'use strict';
function buildAudioVariableControl(def){
 const v=valueAt(audio.currentTime||0);
 const enabled=!!state.featureVisible[def.id];
 const expanded=!!state.expandedFeatures[def.id];
 const info=currentForCompact(def,v);
 const ctl=document.createElement('div');
 ctl.className='track-control audio-variable-control'+(expanded?' expanded':'')+(enabled?'':' disabled minimal')+(state.selectedFeature===def.id&&!state.lightSelectionActive?' selected':'');
 ctl.dataset.id=def.id;
 ctl.setAttribute('role','button');
 ctl.tabIndex=0;

 const head=document.createElement('div'); head.className='head';
 const tog=document.createElement('button'); tog.className='ui-btn toggle'; tog.title=(enabled?'Disable ':'Enable ')+def.name; tog.disabled=state.lightSelectionActive; const dot=document.createElement('span');dot.className='toggle-dot '+(enabled?'on':'');tog.appendChild(dot);
 tog.addEventListener('click',e=>{
   e.stopPropagation();
   if(state.lightSelectionActive)return;
   state.featureVisible[def.id]=!enabled;
   if(!state.featureVisible[def.id])state.expandedFeatures[def.id]=false;
   renderTimeline();
 });
 const name=document.createElement('span');name.className='name';name.textContent=def.name;
 head.append(tog,name);
 const cur=document.createElement('span');cur.className='current';cur.textContent=info.value;head.appendChild(cur);
 const pill=document.createElement('span');pill.className='ui-badge state-pill '+(info.badge==='HIGH'?'high':info.badge==='MED'?'med':'');pill.textContent=enabled?(info.badge||'—'):'OFF';pill.title=capsuleHelp(def,info.badge);
 head.appendChild(pill);
 const infoWrap=createInfoTip(def); infoWrap.classList.add('variable-info'); head.appendChild(infoWrap);
 const exp=document.createElement('button');exp.className='ui-btn expand-btn ui-btn-icon';exp.title=expanded?'Collapse controls':'Expand controls';exp.textContent=expanded?'⌃':'⌄';exp.disabled=state.lightSelectionActive||!enabled;
 exp.addEventListener('click',e=>{e.stopPropagation();if(state.lightSelectionActive||!enabled)return;state.expandedFeatures[def.id]=!expanded;renderTimeline();});
 head.appendChild(exp); ctl.appendChild(head);

 if(!expanded){
   if(info.metrics?.length){
     const metricHost=document.createElement('div');metricHost.className='live-metric-row'+(info.metrics.length===3?' three':'');
     metricHost.innerHTML=info.metrics.map(([k,val])=>`<div class="live-metric" data-metric="${k}" data-tip="${metricHelp(k)}"><b>${k}</b><span>${Number(val).toFixed(3)}</span></div>`).join('');
     ctl.appendChild(metricHost);
   }else{
     const micro=document.createElement('div');micro.className='micro';micro.textContent=info.micro||'waiting for analysis';ctl.appendChild(micro);
   }
   const meter=document.createElement('div');meter.className='mini-live-meter';const fill=document.createElement('i');fill.style.width=Math.round((def.meter&&v?clamp(def.meter(v)):0)*100)+'%';meter.appendChild(fill);ctl.appendChild(meter);
 }else{
   ctl.appendChild(buildAdvanced(def));
 }
 applyLiveColors(ctl,def);
 const select=()=>{if(state.lightSelectionActive){restoreLightSelection();} state.selectedFeature=def.id;renderTimeline();};
 ctl.addEventListener('click',e=>{if(e.target.closest('button'))return;select();});
 ctl.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button')){e.preventDefault();select();}});
 return ctl;
}
function buildLightVariableControl(def){
 const info=lightOutputCompact(def);
 const selected=state.lightSelectionActive&&state.selectedLightOutput===def.id;
 const ctl=document.createElement('div');ctl.className='track-control light-variable-control'+(selected?' selected':'');ctl.dataset.lightId=def.id;ctl.setAttribute('role','button');ctl.tabIndex=0;
 const head=document.createElement('div');head.className='head';
 const dot=document.createElement('span');dot.className='toggle-dot '+(selected?'on':'');head.appendChild(dot);
 const name=document.createElement('span');name.className='name';name.textContent=def.name;head.appendChild(name);
 const cur=document.createElement('span');cur.className='current';cur.textContent=info.value;head.appendChild(cur);
 const pill=document.createElement('span');pill.className='ui-badge state-pill med';pill.textContent=selected?'SELECTED':info.badge;head.appendChild(pill);
 const infoWrap=document.createElement('span');infoWrap.className='ui-info variable-info';infoWrap.textContent='i';infoWrap.setAttribute('data-tip',def.name+' — '+def.desc+' Drivers: '+def.drivers.map(id=>featureDefs.find(f=>f.id===id)?.name||id).join(', '));infoWrap.setAttribute('aria-label',def.name+' definition');head.appendChild(infoWrap);
 ctl.appendChild(head);
 const micro=document.createElement('div');micro.className='micro';micro.textContent=def.micro;ctl.appendChild(micro);
 const meter=document.createElement('div');meter.className='mini-live-meter';const fill=document.createElement('i');const p=lightValueAt(audio.currentTime||0);let mv=0;if(p){mv=def.id==='lightMain'?p.main:def.id==='lightBack'?p.back:def.id==='lightArrows'?Math.max(p.left,p.right):def.id==='lightAccent'?p.accent:def.id==='lightDrop'?p.drop:.5;}fill.style.width=Math.round(clamp(mv)*100)+'%';meter.appendChild(fill);ctl.appendChild(meter);
 ctl.addEventListener('click',e=>{if(e.target.closest('button'))return;selectLightOutput(def.id);});
 ctl.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button')){e.preventDefault();selectLightOutput(def.id);}});
 return ctl;
}
function buildTimelineRow(type,control,chart,opts={}){
 const row=document.createElement('div');row.className='timeline-row '+type+(opts.sticky?' light-pinned':'');
 if(opts.sticky)row.style.setProperty('--sticky-top',(opts.stickyTop||0)+'px');
 row.append(control,chart);return row;
}
function makeChartCell(className,minHeight,label){
 const chart=document.createElement('div');chart.className='timeline-chart '+className;chart.style.setProperty('--chart-min-height',minHeight+'px');
 if(label){const lab=document.createElement('div');lab.className='chart-label';lab.textContent=label;chart.appendChild(lab);}
 return chart;
}
function addRowPlayhead(chart){const ph=document.createElement('div');ph.className='timeline-playhead';chart.appendChild(ph);return ph;}
function makeTimelineHeader(){
 const left=document.createElement('div');left.className='row-control timeline-header-control';left.textContent='VARIABLES · compact / expandable';
 const right=makeChartCell('timeline-ruler',RULER_MIN_HEIGHT,'');
 const c=document.createElement('canvas');c.id='timeRulerCanvas';right.appendChild(c);return buildTimelineRow('timeline-header',left,right);
}
function makeLightHeaderRow(stickyTop){
 const left=document.createElement('div');left.className='row-control light-header-control';
 const title=document.createElement('span');title.className='name';title.textContent='LIGHT VARIABLES';left.appendChild(title);
 const select=document.createElement('select');select.className='light-group-select';select.setAttribute('aria-label','Selected light output');
 for(const d of lightOutputDefs){const o=document.createElement('option');o.value=d.id;o.textContent=d.name;select.appendChild(o);}select.value=state.selectedLightOutput||lightOutputDefs[0].id;select.addEventListener('click',e=>e.stopPropagation());select.addEventListener('change',e=>selectLightOutput(e.target.value));left.appendChild(select);
 const toggle=document.createElement('button');toggle.className='ui-btn light-group-toggle';toggle.textContent=state.lightOutputExpanded?'SELECTED ONLY':'SHOW ALL';toggle.title=state.lightOutputExpanded?'Show only the selected light output':'Show all light outputs';toggle.addEventListener('click',e=>{e.stopPropagation();state.lightOutputExpanded=!state.lightOutputExpanded;renderTimeline();});left.appendChild(toggle);
 const right=makeChartCell('light-header-chart',LIGHT_HEADER_HEIGHT,'LIGHT OUTPUT TIMELINE');
 right.appendChild(addRowPlayhead(right));
 return buildTimelineRow('light-header light-pinned',left,right,{sticky:true,stickyTop});
}
function makeLightRow(def,index,stickyTop){
 const control=buildLightVariableControl(def);
 const chart=makeChartCell('light-variable-chart',LIGHT_ROW_HEIGHT,'');chart.dataset.lightId=def.id;
 const canvas=document.createElement('canvas');chart.appendChild(canvas);addRowPlayhead(chart);
 chart.addEventListener('click',e=>{if(e.target.closest('.marker'))return;seekFromChartEvent(e,chart);});
 return buildTimelineRow('light-row light-pinned',control,chart,{sticky:true,stickyTop});
}
function makeWaveformRow(){
 const control=document.createElement('div');control.className='row-control wave-control'+(state.selectedFeature==='waveform'?' selected':'');control.dataset.id='waveform';
 control.innerHTML='<div class="head"><span class="toggle-dot on"></span><span class="name">WAVEFORM</span><span class="current">audio</span></div><div class="subline">source waveform · click the chart to seek</div>';
 control.addEventListener('click',e=>{if(e.target.closest('button'))return;restoreLightSelection();state.selectedFeature='waveform';renderTimeline();});
 const chart=makeChartCell('waveform-chart',WAVEFORM_MIN_HEIGHT,'WAVEFORM');chart.dataset.id='waveform';const canvas=document.createElement('canvas');canvas.id='waveCanvas';chart.appendChild(canvas);const readout=document.createElement('span');readout.id='waveReadout';readout.className='wave-readout';readout.textContent=state.features.length?'audio':'awaiting audio';chart.appendChild(readout);addRowPlayhead(chart);
 chart.addEventListener('click',e=>{if(e.target.closest('.marker'))return;seekFromChartEvent(e,chart);});
 return buildTimelineRow('waveform-row',control,chart);
}
function makeAudioRow(def){
 const control=buildAudioVariableControl(def);control.classList.add('row-control');
 const expanded=!!state.expandedFeatures[def.id];const chart=makeChartCell('track-row audio-variable-chart'+(expanded?' expanded':''),expanded?AUDIO_ROW_EXPANDED_MIN_HEIGHT:AUDIO_ROW_MIN_HEIGHT,'');chart.dataset.id=def.id;
 if(!state.featureVisible[def.id])chart.classList.add('disabled');
 const canvas=document.createElement('canvas');chart.appendChild(canvas);
 if(state.selectedFeature===def.id&&!state.lightSelectionActive){const sel=document.createElement('div');sel.className='selection-line';chart.appendChild(sel);}
 addRowPlayhead(chart);
 chart.addEventListener('click',e=>{if(e.target.closest('.marker'))return;seekFromChartEvent(e,chart);});
 return buildTimelineRow('audio-row',control,chart);
}
function seekFromChartEvent(e,chart){
 if(!state.duration)return;
 const rect=chart.getBoundingClientRect();const ratio=clamp((e.clientX-rect.left)/Math.max(1,rect.width),0,1);audio.currentTime=ratio*state.duration;updatePlayhead();
}
function ensureTimelineScrollBehavior(scroll,grid){
 scroll.onscroll=null;
 scroll.addEventListener('scroll',()=>{
   const left=scroll.scrollLeft;
   if(!state.programmaticMapScroll&&state.playing&&state.follow&&Math.abs(left-state.lastTimelineScrollLeft)>1){state.follow=false;$('#followBtn').textContent='Off';$('#followBtn').title='Auto-follow paused because you moved the timeline manually.';}
   state.lastTimelineScrollLeft=left;
 });
 scroll.addEventListener('mousemove',timelineHoverMove);
 scroll.addEventListener('mouseleave',()=>{const h=$('#hover');if(h)h.style.display='none';});
 scroll.addEventListener('dragover',e=>{if(e.dataTransfer?.types?.includes('Files'))e.preventDefault();});
 scroll.addEventListener('drop',e=>{if(!e.dataTransfer?.files?.length)return;e.preventDefault();const f=[...e.dataTransfer.files].find(x=>x.type.startsWith('audio/')||/\.(mp3|wav|m4a|aac|ogg|oga|opus|webm|flac|aif|aiff)$/i.test(x.name));if(f)loadFile(f);});
}
function lightHoverPayloadAll(p,t){
 const rows=[]; if(!p)return rows;
 rows.push(['MAIN',(p.main*100).toFixed(0)+'%']);
 rows.push(['BACK',(p.back*100).toFixed(0)+'% · '+(p.backColor||'—')]);
 rows.push(['ARROWS L',(p.left*100).toFixed(0)+'%']);
 rows.push(['ARROWS R',(p.right*100).toFixed(0)+'%']);
 rows.push(['ACCENT',(p.accent*100).toFixed(0)+'% · '+(p.accentColor||'—')]);
 rows.push(['DROP',(p.drop*100).toFixed(0)+'%']);
 return rows;
}
function timelineHoverMove(e){
 if(!state.duration)return;
 const target=e.target.closest('.timeline-chart');
 if(!target||!target.classList.contains('timeline-chart')){const h=$('#hover');if(h)h.style.display='none';return;}
 const rect=target.getBoundingClientRect();
 const ratio=clamp((e.clientX-rect.left)/Math.max(1,rect.width),0,1);
 const t=ratio*state.duration;
 const h=$('#hover');if(!h)return;
 h.style.display='block';
 h.style.left=(e.clientX+12)+'px';
 h.style.top=Math.max(64,e.clientY-56)+'px';
 const lightId=target.dataset.lightId;
 if(lightId){
   const p=lightValueAt(t);
   let html='<b>'+fmtTime(t)+'</b><div class="hover-section-label">LIGHT OUTPUTS</div>';
   if(p){
     for(const [k,val] of lightHoverPayloadAll(p,t)) html+='<div class="kv"><span>'+k+'</span><span>'+val+'</span></div>';
   }else{
     html+='<div class="kv"><span>Light outputs</span><span>—</span></div>';
   }
   h.innerHTML=html;
   return;
 }
 const v=valueAt(t);
 if(!v){h.innerHTML='<b>'+fmtTime(t)+'</b><div class="kv"><span>No analyzed frames</span><span>—</span></div>';return;}
 let html='<b>'+fmtTime(t)+'</b><div class="kv"><span>Energy</span><span>'+v.energySmooth.toFixed(2)+'</span></div><div class="kv"><span>Bass</span><span>'+v.bassSmooth.toFixed(2)+'</span></div><div class="kv"><span>Activity</span><span>'+v.activitySmooth.toFixed(2)+'</span></div><div class="kv"><span>Chaos</span><span>'+v.chaos.toFixed(2)+'</span></div><div class="kv"><span>Drop</span><span>'+v.dropScore.toFixed(2)+'</span></div><div class="kv"><span>Note</span><span>'+v.dominantNote+' · '+v.dominantConfidence.toFixed(2)+'</span></div>';
 h.innerHTML=html;
}
function syncTimelineWidth(){
 const scroll=$('#analysisScroll');if(!scroll)return 1100;
 const rail=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--rail'))||310;
 const available=Math.max(420,scroll.clientWidth-rail-2);const width=Math.max(900,Math.floor(available*Math.max(.25,state.zoom)));
 scroll.style.setProperty('--timeline-width',width+'px');return width;
}
function drawRulerCanvas(){
 const c=$('#timeRulerCanvas');if(!c)return;const r=c.parentElement.getBoundingClientRect();const w=c.width=Math.max(1,Math.floor(r.width*devicePixelRatio));const h=c.height=Math.max(1,Math.floor(r.height*devicePixelRatio));const ctx=c.getContext('2d');ctx.clearRect(0,0,w,h);ctx.fillStyle='#0a0f16';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#1e2a39';ctx.lineWidth=devicePixelRatio;
 if(!state.duration){ctx.fillStyle='#627187';ctx.font=`${9*devicePixelRatio}px ui-sans-serif`;ctx.fillText('timeline waits for audio',8*devicePixelRatio,13*devicePixelRatio);return;}
 const pxPerSec=w/state.duration;let step=30;if(pxPerSec>160)step=5;else if(pxPerSec>85)step=10;else if(pxPerSec>40)step=15;else if(pxPerSec<16)step=60;
 ctx.font=`${9*devicePixelRatio}px ui-sans-serif`;ctx.fillStyle='#74839a';
 for(let t=0;t<=state.duration+.001;t+=step){const x=t/state.duration*w;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();ctx.fillText(fmtTime(t).slice(0,5),Math.min(x+4*devicePixelRatio,w-40*devicePixelRatio),13*devicePixelRatio);}
}
function positionPlayheads(){
 const t=audio.currentTime||0;const pct=state.duration?clamp(t/state.duration):0;
 document.querySelectorAll('.timeline-playhead').forEach(ph=>ph.style.left=(pct*100)+'%');
}
function followPlayhead(){
 const scroll=$('#analysisScroll');if(!scroll||!state.playing||!state.follow||!state.duration)return;
 const rail=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--rail'))||310;const timelineWidth=parseFloat(getComputedStyle(scroll).getPropertyValue('--timeline-width'))||900;const x=timelineWidth*(audio.currentTime/state.duration);const desired=Math.max(0,rail+x-scroll.clientWidth*.58);const max=Math.max(0,scroll.scrollWidth-scroll.clientWidth);if(desired>scroll.scrollLeft+80||desired<scroll.scrollLeft+20){state.programmaticMapScroll=true;scroll.scrollLeft=Math.min(max,desired);requestAnimationFrame(()=>{state.programmaticMapScroll=false;});}}
function updateLightOutputValues(){
 document.querySelectorAll('.light-variable-control[data-light-id]').forEach(ctl=>{const d=lightOutputDefs.find(x=>x.id===ctl.dataset.lightId);if(!d)return;const info=lightOutputCompact(d);const cur=ctl.querySelector('.current');if(cur)cur.textContent=info.value;const pill=ctl.querySelector('.state-pill');if(pill)pill.textContent=(state.lightSelectionActive&&state.selectedLightOutput===d.id)?'SELECTED':info.badge;const fill=ctl.querySelector('.mini-live-meter i');const p=lightValueAt(audio.currentTime||0);if(fill&&p){const val=d.id==='lightMain'?p.main:d.id==='lightBack'?p.back:d.id==='lightArrows'?Math.max(p.left,p.right):d.id==='lightAccent'?p.accent:d.id==='lightDrop'?p.drop:.5;fill.style.width=Math.round(clamp(val)*100)+'%';}}
 );
}
function drawLightOutputTrackFinal(cv,def){
 const r=cv.parentElement.getBoundingClientRect();const w=cv.width=Math.max(1,Math.floor(r.width*devicePixelRatio)),h=cv.height=Math.max(1,Math.floor(r.height*devicePixelRatio));const ctx=cv.getContext('2d');ctx.clearRect(0,0,w,h);
 ctx.fillStyle='#090e15';ctx.fillRect(0,0,w,h);
 const gridY=p=>h-p*h*.92;
 ctx.strokeStyle='#162130';ctx.lineWidth=devicePixelRatio;for(const p of [0,.25,.5,.75,1]){const y=gridY(p);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
 ctx.fillStyle='rgba(150,165,190,.38)';ctx.font=`${8*devicePixelRatio}px ui-sans-serif`;ctx.fillText('100%',6*devicePixelRatio,10*devicePixelRatio);ctx.fillText('50%',6*devicePixelRatio,h*.50);ctx.fillText('0%',6*devicePixelRatio,h-5*devicePixelRatio);
 const raw=state.lightPreview||buildLightPreviewSeries();
 if(!raw?.t?.length){ctx.fillStyle='#54647a';ctx.fillText('awaiting analyzed audio',58*devicePixelRatio,h*.55);return;}
 const n=raw.t.length;
 const series=(key,fallback=0)=>{const a=Array.isArray(raw[key])?raw[key]:null;return a&&a.length===n?a:Array.from({length:n},()=>fallback);};
 const colors=(key,fallback='#9d7cff')=>{const a=Array.isArray(raw[key])?raw[key]:null;return a&&a.length===n?a:Array.from({length:n},()=>fallback);};
 const data={...raw,main:series('main'),floor:series('floor',0),back:series('back'),left:series('left'),right:series('right'),accent:series('accent'),drop:series('drop'),backColor:colors('backColor','#7c5cff'),mainColor:colors('mainColor','#ff7fd6'),leftColor:colors('leftColor','#ffd45a'),rightColor:colors('rightColor','#43d6ff'),accentColor:colors('accentColor','#f9a8d4')};
 const X=t=>state.duration?((t/state.duration)*w):0;const Y=v=>h*.92-h*.76*clamp01(Number.isFinite(v)?v:0);
 const line=(vals,color,width=1.7)=>{ctx.strokeStyle=color;ctx.lineWidth=width*devicePixelRatio;ctx.beginPath();for(let i=0;i<n;i++){const x=X(data.t[i]),y=Y(vals[i]);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();};
 const area=(vals,color,fill=.14)=>{ctx.beginPath();for(let i=0;i<n;i++){const x=X(data.t[i]),y=Y(vals[i]);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.lineTo(w,h*.92);ctx.lineTo(0,h*.92);ctx.closePath();ctx.fillStyle=color;ctx.globalAlpha=fill;ctx.fill();ctx.globalAlpha=1;line(vals,color,1.7);};
 if(def.id==='lightMain'){area(data.main,'#ff7fd6',.16);line(data.floor,'rgba(255,255,255,.42)',1.05);}
 else if(def.id==='lightBack'){
   ctx.lineWidth=2.0*devicePixelRatio;for(let i=0;i<n-1;i++){ctx.strokeStyle=data.backColor[i]||'#7c5cff';ctx.beginPath();ctx.moveTo(X(data.t[i]),Y(data.back[i]));ctx.lineTo(X(data.t[i+1]),Y(data.back[i+1]));ctx.stroke();}
   ctx.strokeStyle='rgba(255,255,255,.28)';ctx.lineWidth=devicePixelRatio;ctx.beginPath();ctx.moveTo(0,h*.92);ctx.lineTo(w,h*.92);ctx.stroke();
 }
 else if(def.id==='lightArrows'){line(data.left,'#ffd45a',1.6);line(data.right,'#43d6ff',1.6);line(data.drop,'rgba(251,191,36,.82)',1.05);}
 else if(def.id==='lightAccent'){area(data.accent,'#f9a8d4',.10);for(let i=0;i<n;i++){const v=data.accent[i];if(v<.035)continue;const x=X(data.t[i]);ctx.strokeStyle='#f9a8d4';ctx.lineWidth=1.0*devicePixelRatio;ctx.beginPath();ctx.moveTo(x,h*.92);ctx.lineTo(x,Y(v));ctx.stroke();}}
 else if(def.id==='lightDrop'){for(let i=0;i<n;i++){const v=data.drop[i];if(v<.02)continue;const x=X(data.t[i]);ctx.strokeStyle='#fbbf24';ctx.lineWidth=1.8*devicePixelRatio;ctx.beginPath();ctx.moveTo(x,h*.92);ctx.lineTo(x,Y(v));ctx.stroke();ctx.fillStyle='#fbbf24';ctx.beginPath();ctx.arc(x,Y(v),2.2*devicePixelRatio,0,Math.PI*2);ctx.fill();}}
 else if(def.id==='lightColor'){
   const lanes=[data.mainColor,data.leftColor,data.backColor,data.accentColor];const labels=['MAIN','ARROWS','BACK','ACCENT'];const lane=h/4;
   lanes.forEach((arr,li)=>{const y=(li+.5)*lane;for(let i=0;i<n-1;i++){ctx.strokeStyle=arr[i]||'#9d7cff';ctx.lineWidth=Math.max(1,X(data.t[i+1])-X(data.t[i])+devicePixelRatio);ctx.beginPath();ctx.moveTo(X(data.t[i]),y);ctx.lineTo(X(data.t[i+1]),y);ctx.stroke();}});
   ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=devicePixelRatio;for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(0,i*lane);ctx.lineTo(w,i*lane);ctx.stroke();}ctx.fillStyle='rgba(255,255,255,.55)';ctx.font=`${8*devicePixelRatio}px ui-sans-serif`;labels.forEach((lab,i)=>ctx.fillText(lab,8*devicePixelRatio,(i+.65)*lane));
 }
}
function drawPlaceholderChart(chart,label){
 const canvas=chart.querySelector('canvas');if(!canvas)return;const r=chart.getBoundingClientRect();const w=canvas.width=Math.max(1,Math.floor(r.width*devicePixelRatio));const h=canvas.height=Math.max(1,Math.floor(r.height*devicePixelRatio));const ctx=canvas.getContext('2d');ctx.clearRect(0,0,w,h);ctx.fillStyle='#090e15';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#15202c';ctx.lineWidth=devicePixelRatio;for(const p of [.25,.5,.75]){const y=h*p;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}ctx.fillStyle='#4f6077';ctx.font=`${9*devicePixelRatio}px ui-sans-serif`;ctx.fillText(label||'awaiting audio',8*devicePixelRatio,15*devicePixelRatio);
}
function paintTimelineCanvases(){
  const scroll=$('#analysisScroll');
  if(!scroll)return;
  drawRulerCanvas();
  const wave=$('#waveCanvas');
  if(wave)drawWaveformRedesigned();
  for(const def of featureDefs){
    const tr=document.querySelector('.audio-variable-chart[data-id="'+def.id+'"]');
    if(!tr)continue;
    const cv=tr.querySelector('canvas');
    if(!cv)continue;
    if(state.features.length&&state.duration){
      drawTrackRedesigned(cv,def);
      tr.querySelectorAll('.marker').forEach(m=>m.remove());
      drawMarkersRedesigned(tr,def);
      drawABOverlay(cv,def);
      drawABMarkers(tr,def);
    }else{
      drawPlaceholderChart(tr,'awaiting analysis');
    }
  }
  for(const def of lightOutputDefs){
    const tr=document.querySelector('.light-variable-chart[data-light-id="'+def.id+'"]');
    if(!tr)continue;
    const cv=tr.querySelector('canvas');
    if(cv){try{drawLightOutputTrackFinal(cv,def);}catch(err){console.warn('Light output chart render skipped',{id:def.id,error:err});drawPlaceholderChart(tr,'light output unavailable');}}
  }
  positionPlayheads();
  updateLightTraceUI();
  updateLightOutputValues();
  const h=$('#hover');
  if(h&&(!state.duration||!state.features.length))h.style.display='none';
}
function paintLightOutputCanvases(){paintTimelineCanvases();}
function renderTimeline(){
 const scroll=$('#analysisScroll');if(!scroll)return;
 const oldTop=scroll.scrollTop,oldLeft=scroll.scrollLeft;
 try{
   syncTimelineWidth();
   const grid=document.createElement('div');
   grid.id='timelineGrid';
   grid.className='timeline-grid';
   grid.style.setProperty('--timeline-width',getComputedStyle(scroll).getPropertyValue('--timeline-width'));
   grid.appendChild(makeTimelineHeader());
   const lightHeaderTop=0;
   grid.appendChild(makeLightHeaderRow(lightHeaderTop));
   const selected=lightOutputDefs.find(d=>d.id===state.selectedLightOutput)||lightOutputDefs[0];
   const visibleLights=state.lightOutputExpanded?lightOutputDefs:[selected];
   visibleLights.forEach((def,i)=>{const top=LIGHT_HEADER_HEIGHT+i*LIGHT_ROW_HEIGHT;grid.appendChild(makeLightRow(def,i,top));});
   grid.appendChild(makeWaveformRow());
   for(const def of featureDefs)grid.appendChild(makeAudioRow(def));
   ensureTimelineScrollBehavior(scroll,grid);
   // Only replace the existing content after the complete grid has been built successfully.
   scroll.replaceChildren(grid);
   if(!document.body.contains($('#hover'))){const h=document.createElement('div');h.id='hover';h.className='hover';h.style.display='none';document.body.appendChild(h);}
   requestAnimationFrame(()=>{
     syncTimelineWidth();
     scroll.scrollTop=Math.min(oldTop,Math.max(0,scroll.scrollHeight-scroll.clientHeight));
     scroll.scrollLeft=Math.min(oldLeft,Math.max(0,scroll.scrollWidth-scroll.clientWidth));
     state.lastTimelineScrollLeft=scroll.scrollLeft;
     paintTimelineCanvases();
   });
   updateLightOutputInspector();
   updateInspector();
 }catch(err){
   console.error('Timeline render failed; preserving previous timeline contents.',err);
   // Keep whatever was already visible instead of leaving the timeline blank.
   state.lastTimelineScrollLeft=scroll.scrollLeft;
 }
}
