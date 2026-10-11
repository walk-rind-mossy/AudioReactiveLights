// Canvas drawing of feature tracks and waveform
'use strict';
function drawTrackRedesigned(cv,def,alt=false){
 const r=cv.parentElement.getBoundingClientRect();
 const w=cv.width=Math.max(1,Math.floor(r.width*devicePixelRatio));
 const h=cv.height=Math.max(1,Math.floor(r.height*devicePixelRatio));
 const ctx=cv.getContext('2d'); ctx.clearRect(0,0,w,h);
 if(!state.features.length || !state.duration)return;
 const f=state.features, enabled=state.featureVisible[def.id]??true;
 const alpha=enabled?1:.18;
 ctx.save(); ctx.globalAlpha=alpha;
 const X=t=>t/state.duration*w;
 const norm=(v,min=0,max=1)=>clamp((v-min)/(max-min||1));
 const grid=(y)=>{ctx.strokeStyle='#17212d';ctx.lineWidth=Math.max(1,devicePixelRatio);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()};
 const baseline=(y)=>{grid(y)};
 const line=(getter,y0,y1,color,width=1.5,dash=[])=>{
   ctx.beginPath(); ctx.strokeStyle=color; ctx.lineWidth=width*devicePixelRatio; ctx.setLineDash(dash);
   for(let i=0;i<f.length;i++){
     const x=X(f[i].t), y=y1-(y1-y0)*norm(getter(f[i]));
     if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
   }
   ctx.stroke(); ctx.setLineDash([]);
 };
 const area=(getter,y0,y1,color,fillAlpha=.16)=>{
   ctx.beginPath();
   for(let i=0;i<f.length;i++){
     const x=X(f[i].t), y=y1-(y1-y0)*norm(getter(f[i]));
     if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
   }
   ctx.lineTo(w,y1);ctx.lineTo(0,y1);ctx.closePath();
   ctx.fillStyle=color;ctx.globalAlpha=alpha*fillAlpha;ctx.fill();ctx.globalAlpha=alpha;
   line(getter,y0,y1,color,1.65);
 };
 const spikeField=(getter,yBase,color,maxHeight=.78,barW=1.6,threshold=null)=>{
   ctx.strokeStyle=color;ctx.lineWidth=barW*devicePixelRatio;
   for(let i=0;i<f.length;i++){
     const val=clamp(getter(f[i]));
     if(threshold!=null && val<threshold)continue;
     const x=X(f[i].t), top=yBase-maxHeight*val*(h*.65);
     if(val<.05)continue;
     ctx.beginPath();ctx.moveTo(x,yBase);ctx.lineTo(x,top);ctx.stroke();
   }
 };
 const dots=(getter,yBase,color,scale=1)=>{
   ctx.fillStyle=color;
   for(let i=0;i<f.length;i++){
     const val=clamp(getter(f[i])); if(val<.08)continue;
     const x=X(f[i].t); const yy=yBase-(val*scale*h*.55);
     ctx.beginPath();ctx.arc(x,yy,Math.max(1.2,2*devicePixelRatio),0,Math.PI*2);ctx.fill();
   }
 };

 // Primary mapping stays intentionally stable on first render. Expanded mode adds detail, it does not replace the base mapping.
 if(def.id==='energy'){
   baseline(h*.92,'0'); baseline(h*.50,'0.5'); baseline(h*.08,'1');
   area(v=>v.energyNorm,h*.08,h*.92,def.color,.18);
   line(v=>v.energySmooth,h*.08,h*.92,'#dbe5f1',2.0);
   if(state.expandedFeatures.energy){
     const laneH=h/4;
     let maxRaw=.0001;for(const z of f)maxRaw=Math.max(maxRaw,z.energy||0);
     const lanes=[
       ['RAW',v=>v.energy/maxRaw,'#9aa7b8',1.05],
       ['SMOOTH',v=>norm(v.energySmooth),'#6ee7ff',1.7],
       ['NORM',v=>v.energyNorm,'#a78bfa',1.5],
       ['REL',v=>norm(v.energyRelative,-1,2),'#6ee7a8',1.4]
     ];
     ctx.fillStyle='#0a0f16';ctx.fillRect(0,0,w,h);
     lanes.forEach(([lab,g,c,sw],i)=>{
       const y0=i*laneH+12*devicePixelRatio,y1=(i+1)*laneH-8*devicePixelRatio;
       grid((i+1)*laneH);
       ctx.fillStyle='rgba(142,158,181,.60)';ctx.font=`${8*devicePixelRatio}px ui-sans-serif`;ctx.fillText(lab,8*devicePixelRatio,(i*laneH+11*devicePixelRatio));
       line(g,y0,y1,c,sw);
     });
   }
 } else if(def.id==='bass'){
   baseline(h*.90,'0'); baseline(h*.50,'0.5'); baseline(h*.10,'1');
   area(v=>v.bassNorm,h*.10,h*.90,def.color,.20);
   line(v=>v.bassSmooth,h*.10,h*.90,'#e4eaf2',1.9);
   spikeField(v=>v.bassImpactNorm,h*.90,'#ffd166',.95,1.5,params.bassImpactSensitivity);
   if(state.expandedFeatures.bass){
     const laneH=h/2; const lanes=[['BODY',v=>v.bassSmooth,'#a78bfa'],['IMPACT',v=>v.bassImpactNorm,'#ffd166']];
     ctx.fillStyle='#0a0f16';ctx.fillRect(0,0,w,h);
     lanes.forEach(([lab,g,c],i)=>{
       const y0=i*laneH+12*devicePixelRatio,y1=(i+1)*laneH-8*devicePixelRatio;
       grid((i+1)*laneH);
       ctx.fillStyle='rgba(142,158,181,.60)';ctx.font=`${8*devicePixelRatio}px ui-sans-serif`;ctx.fillText(lab,8*devicePixelRatio,(i*laneH+11*devicePixelRatio));
       if(lab==='IMPACT')spikeField(g,y1,c,.95,1.7,params.bassImpactSensitivity); else line(g,y0,y1,c,1.8);
     });
   }
 } else if(def.id==='activity'){
   baseline(h*.90,'0'); baseline(h*.50,'0.5'); baseline(h*.10,'1');
   area(v=>v.activityNorm,h*.10,h*.90,def.color,.16);
   line(v=>v.activitySmooth,h*.10,h*.90,'#f0f4fa',1.9);
   if(state.expandedFeatures.activity){
     const laneH=h/4; const lanes=[['RAW',v=>v.activity,'#9aa7b8'],['SMOOTH',v=>v.activitySmooth,'#6ee7ff'],['NORM',v=>v.activityNorm,'#a78bfa'],['REL',v=>norm(v.activityRelative,-1,2),'#6ee7a8']];
     ctx.fillStyle='#0a0f16';ctx.fillRect(0,0,w,h);
     let maxRaw=.0001;for(const z of f)maxRaw=Math.max(maxRaw,z.activity||0);
     lanes.forEach(([lab,g,c],i)=>{
       const y0=i*laneH+12*devicePixelRatio,y1=(i+1)*laneH-8*devicePixelRatio;
       grid((i+1)*laneH);
       ctx.fillStyle='rgba(142,158,181,.60)';ctx.font=`${8*devicePixelRatio}px ui-sans-serif`;ctx.fillText(lab,8*devicePixelRatio,(i*laneH+11*devicePixelRatio));
       line(v=>lab==='RAW'?(g(v)/maxRaw):g(v),y0,y1,c,lab==='SMOOTH'?1.8:1.25);
     });
   }
 } else if(def.id==='transient'){
   grid(h*.88);
   spikeField(v=>v.transient,h*.88,def.color,.95,1.4,.03);
 } else if(def.id==='beat'){
   grid(h*.86);
   ctx.strokeStyle=def.color;ctx.lineWidth=1.35*devicePixelRatio;
   for(const e of state.events.filter(x=>x.type==='BEAT')){
     const x=X(e.t), val=clamp(e.confidence);ctx.beginPath();ctx.moveTo(x,h*.86);ctx.lineTo(x,h*.86-val*h*.62);ctx.stroke();
     ctx.fillStyle=def.color;ctx.beginPath();ctx.arc(x,h*.86-val*h*.62,2.2*devicePixelRatio,0,Math.PI*2);ctx.fill();
   }
 } else if(def.id==='kick'){
   grid(h*.88);
   spikeField(v=>v.bassImpactNorm,h*.88,def.color,.95,1.7,params.bassImpactSensitivity);
   line(v=>v.bassSmooth,h*.32,h*.80,'rgba(167,139,250,.45)',1.0);
 } else if(def.id==='spectral'){
   const laneH=h/4;
   const lanes=[['CENTROID',v=>norm(v.centroid,0,5000),'#c4b5fd'],['FLATNESS',v=>norm(v.flatness),'#93c5fd'],['BANDWIDTH',v=>norm(v.bandwidth,0,5000),'#86efac'],['ROLLOFF',v=>norm(v.rolloff,0,5000),'#f9a8d4']];
   ctx.fillStyle='#0a0f16';ctx.fillRect(0,0,w,h);
   lanes.forEach(([lab,g,c],i)=>{const y0=i*laneH+7*devicePixelRatio,y1=(i+1)*laneH-7*devicePixelRatio;grid((i+1)*laneH);area(g,y0,y1,c,.10);line(g,y0,y1,c,1.25);});
 } else if(def.id==='chroma'){
   ctx.fillStyle='#0a0f16';ctx.fillRect(0,0,w,h); const laneH=h/12;
   for(let n=0;n<12;n++){
     const y=n*laneH; grid(y+laneH);
     for(let i=0;i<f.length-1;i++){
       const x=X(f[i].t),nx=X(f[i+1].t);const val=clamp((f[i].chromaNorm||f[i].chroma||[])[n]);
       const alpha=.07+.75*val; ctx.strokeStyle=`rgba(249,168,212,${alpha})`;ctx.lineWidth=Math.max(1,nx-x+devicePixelRatio);ctx.beginPath();ctx.moveTo(x,y+laneH*.5);ctx.lineTo(nx,y+laneH*.5);ctx.stroke();
     }
   }
   const dom=f.map(v=>v.dominantNoteIndex||0);ctx.strokeStyle='#f5f7fb';ctx.lineWidth=1.35*devicePixelRatio;ctx.beginPath();for(let i=0;i<f.length;i++){const x=X(f[i].t),y=(dom[i]+.5)*laneH;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.stroke();
 } else if(def.id==='chaos'){
   baseline(h*.90,'stable'); baseline(h*.50,'mid'); baseline(h*.10,'unstable');
   area(v=>v.chaos,h*.10,h*.90,def.color,.18);
   line(v=>v.chaos,h*.10,h*.90,'#f7f9fc',1.7);
 } else if(def.id==='drop'){
   grid(h*.88);
   const threshold=params.dropSensitivity;
   ctx.strokeStyle='rgba(251,191,36,.35)';ctx.lineWidth=devicePixelRatio;ctx.setLineDash([4*devicePixelRatio,4*devicePixelRatio]);const ty=h-(h*.70*threshold)-h*.08;ctx.beginPath();ctx.moveTo(0,ty);ctx.lineTo(w,ty);ctx.stroke();ctx.setLineDash([]);
   // block-like structural score rather than a generic line
   const stepW=Math.max(1,w/Math.max(1,f.length-1));
   ctx.fillStyle='rgba(251,191,36,.25)';
   for(let i=0;i<f.length;i++){
     const val=clamp(f[i].dropScore);if(val<.02)continue;const x=X(f[i].t);const bh=val*h*.72;ctx.fillRect(x,h*.88-bh,Math.max(1,stepW+.5),bh);
   }
 } else {
   line(v=>0,h*.08,h*.92,def.color,1.5);
 }
 ctx.restore();
}
function drawWaveformRedesigned(){
 const c=$('#waveCanvas'),r=c.getBoundingClientRect();const w=c.width=Math.max(1,Math.floor(r.width*devicePixelRatio)),h=c.height=Math.max(1,Math.floor(r.height*devicePixelRatio)),ctx=c.getContext('2d');ctx.clearRect(0,0,w,h);
 if(state.buffer){const ch=state.buffer.getChannelData(0),step=Math.max(1,Math.ceil(ch.length/w)),mid=h/2;ctx.strokeStyle='#314153';ctx.lineWidth=devicePixelRatio;ctx.beginPath();for(let x=0;x<w;x++){let min=1,max=-1;const s=x*step,e=Math.min(ch.length,s+step);for(let i=s;i<e;i++){const v=ch[i];if(v<min)min=v;if(v>max)max=v}ctx.moveTo(x,mid+min*mid*.82);ctx.lineTo(x,mid+max*mid*.82)}ctx.stroke();return;}
 // Browser playback fallback: show the measured amplitude envelope rather than an invented PCM waveform.
 if(state.features?.length&&state.duration){const mid=h/2;ctx.strokeStyle='#314153';ctx.lineWidth=devicePixelRatio;ctx.beginPath();state.features.forEach((f,i)=>{const x=(i/(state.features.length-1||1))*w;const amp=Math.min(1,f.energy*8);const y=mid-amp*mid*.82;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});for(let i=state.features.length-1;i>=0;i--){const f=state.features[i];const x=(i/(state.features.length-1||1))*w;const amp=Math.min(1,f.energy*8);const y=mid+amp*mid*.82;ctx.lineTo(x,y)}ctx.closePath();ctx.stroke();ctx.fillStyle='rgba(49,65,83,.10)';ctx.fill();}
}
function drawMarkersRedesigned(track,def){
 const types={transient:'TRANSIENT',beat:'RHYTHMIC EVENT',kick:'BASS IMPACT',drop:'DROP',chroma:'DOMINANT NOTE CHANGE'};const type=types[def.id];if(!type||!state.duration)return;
 const events=state.events.filter(x=>x.type===type).sort((a,b)=>a.t-b.t);if(!events.length)return;
 const width=Math.max(1,track.getBoundingClientRect().width||900);const minPx=4.5;let lastPx=-Infinity,fan=0;
 const fanOffsets=[-4,-2,0,2,4];
 for(const e of events){
   const px=e.t/state.duration*width;
   if(px-lastPx<minPx)fan=Math.min(fan+1,fanOffsets.length-1);else fan=0;
   const m=document.createElement('div');m.className='marker '+def.id;m.style.color=def.color;m.style.left=(e.t/state.duration*100)+'%';m.style.setProperty('--marker-offset',(fanOffsets[fan]||0)+'px');m.title=e.type+' '+fmtTime(e.t);m.setAttribute('aria-label',e.type+' '+fmtTime(e.t));
   m.addEventListener('click',ev=>{ev.stopPropagation();audio.currentTime=e.t;state.selectedEvent=e;state.selectedFeature=def.id;updatePlayhead();updateInspector();showEvent(e)});track.appendChild(m);lastPx=px;
 }
}
