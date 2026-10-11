// FFT and offline feature extraction
'use strict';
function hann(i,n){return .5*(1-Math.cos(2*Math.PI*i/(n-1)))}
function dftMagnitudes(samples, bins){ // compact radix-2 FFT, returns first bins
 let n=samples.length; let re=new Float32Array(n), im=new Float32Array(n); for(let i=0;i<n;i++)re[i]=samples[i]*hann(i,n);
 for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t}}
 for(let len=2;len<=n;len<<=1){let ang=-2*Math.PI/len,wr=Math.cos(ang),wi=Math.sin(ang);for(let i=0;i<n;i+=len){let ur=1,ui=0;for(let j=0;j<len/2;j++){let p=i+j,q=p+len/2,vr=re[q]*ur-im[q]*ui,vi=re[q]*ui+im[q]*ur;re[q]=re[p]-vr;im[q]=im[p]-vi;re[p]+=vr;im[p]+=vi;let tr=ur*wr-ui*wi;ui=ur*wi+ui*wr;ur=tr}}}
 const out=new Float32Array(bins); for(let k=0;k<bins;k++)out[k]=Math.hypot(re[k],im[k])/n*2; return out;
}
function sampleWindow(ch0,ch1,start,len){const out=new Float32Array(len); const end=Math.min(ch0.length,start+len), count=Math.max(0,end-start); for(let i=0;i<count;i++) out[i]=(ch0[start+i]+(ch1?ch1[start+i]:ch0[start+i]))*.5; if(count<len)out.fill(0,count); return out}
async function analyzeOffline(buf){
 const sr=buf.sampleRate, ch0=buf.getChannelData(0), ch1=buf.numberOfChannels>1?buf.getChannelData(1):null; state.sampleRate=sr; state.analysisBusy=true; state.analysisStartedAt=performance.now();
 const hop=Math.max(1024,Math.floor(sr*.10)), frame=Math.min(4096,Math.pow(2,Math.floor(Math.log2(sr*.10)))); const count=Math.floor((buf.length-frame)/hop)+1; const step=hop/sr;
 const feats=[]; let prevSpec=null, prevEnergy=0; const progressEvery=Math.max(10,Math.floor(count/100));
 for(let fi=0;fi<count;fi++){
   const start=fi*hop,t=fi*step,w=sampleWindow(ch0,ch1,start,frame); let sum=0; for(const x of w)sum+=x*x; const rms=Math.sqrt(sum/w.length); const rawEnergy=rms;
   // spectral descriptors
   const mags=dftMagnitudes(w,frame/2), nyq=sr/2, hzPer=nyq/mags.length; let total=1e-12,weighted=0; for(let k=0;k<mags.length;k++){const v=mags[k];total+=v;weighted+=v*(k*hzPer)} const centroid=weighted/total;
   let bwSum=0,flatLog=0,flux=0,rollTarget=total*.85,roll=0,cum=0; const prev=prevSpec; for(let k=0;k<mags.length;k++){const v=mags[k];bwSum+=v*Math.abs(k*hzPer-centroid);flatLog+=Math.log(v+1e-9); if(prev) {const d=mags[k]-prev[k]; if(d>0)flux+=d*d} cum+=v; if(!roll&&cum>=rollTarget)roll=k*hzPer} const bandwidth=bwSum/total; const flatness=Math.exp(flatLog/mags.length)/(total/mags.length+1e-9);
   // bands
   let bass=0,low=0; const bassMax=Math.min(180,sr/2),lowMax=Math.min(120,sr/2); for(let k=1;k<mags.length;k++){const hz=k*hzPer,v=mags[k]*mags[k]; if(hz<bassMax)bass+=v; if(hz<lowMax)low+=v} bass=Math.sqrt(bass/mags.length); low=Math.sqrt(low/mags.length);
   // zero crossing / pitch roughness
   let zc=0; for(let i=1;i<w.length;i++)if((w[i]>=0)!==(w[i-1]>=0))zc++;
   const activity=Math.sqrt(flux);
   // chroma from harmonic fold
   const chroma=new Float32Array(12); for(let k=1;k<mags.length;k++){const hz=k*hzPer;if(hz<60||hz>4000)continue; let p=12*Math.log2(hz/440)+69; let pc=((Math.round(p)-69)%12+12)%12; chroma[pc]+=mags[k]*mags[k];}
   let dom=0,domv=0,totalCh=1e-9;for(let k=0;k<12;k++){totalCh+=chroma[k];if(chroma[k]>domv){domv=chroma[k];dom=k}} const conf=domv/totalCh;
   feats.push({t,energy:rawEnergy,bass,lowTransient:low,activity,centroid,flatness,bandwidth,rolloff:roll,zeroCrossing:zc/w.length,chroma:Array.from(chroma),dominantNote:notes[dom],dominantNoteIndex:dom,dominantConfidence:conf,flux});
   prevSpec=mags;
   if(fi%progressEvery===0){const pct=Math.round(fi/count*100);state.analysisProgress=pct;$('#statusChip').textContent='analyzing '+pct+'%'; await new Promise(requestAnimationFrame)}
 }
 state.analysisProgress=100; state.rawFeatures=feats.map(x=>({...x,chroma:[...(x.chroma||[])]})); state.features=postProcess(cloneFrames(state.rawFeatures),step); detectEvents(); renderTimeline(); updateInspector(); updateCalib(); $('#statusChip').textContent='analysis ready · '+state.features.length+' frames'; state.analysisBusy=false;
}
