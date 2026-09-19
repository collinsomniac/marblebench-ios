import {makeSimulation,FIXED_STEP} from './physics.js';
import {makeRenderer} from './render.js';
const $=id=>document.getElementById(id);
const canvas=$('world'),panel=$('panel'),loader=$('loading'),bar=$('bar');
const setProgress=(p,text)=>{bar.style.width=`${p}%`;$('phase').textContent=text;$('progressText').textContent=`${p}% · actual initialization phases`};
const sim=makeSimulation();
// Presentation policy: no decorative fountain or impact spray. Retain the
// particle implementation only as a separately testable reference for now.
sim.options.particles=false;
sim.options.spray=0;
let renderer,paused=false,last=0,acc=0,dropped=0,steps=0,physicalMs=0,renderMs=0,lastStats=0,frames=0,frameTimes=[],lastRaf=0,rafCount=0;
let initError=null;
function showError(error){initError=String(error?.message||error);$('phase').textContent='Graphics initialization failed';$('progressText').textContent=initError;$('loadError').textContent='This 3D build requires WebGL 2. Open the HTTPS version in Safari or Chrome. The original 2D game is still available at the site root.';
 $('indicator').classList.add('bad');console.error(error)}
function toast(text){const el=$('toast');el.textContent=text;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),1400)}
function setupInputs(){const tune=$('settings');const open=value=>{panel.hidden=!value;tune.setAttribute('aria-expanded',String(value));};
 tune.addEventListener('click',()=>open(panel.hidden));$('close').addEventListener('click',()=>open(false));
 $('add').addEventListener('click',()=>{sim.add(1);toast('Another marble released')});
 $('pause').addEventListener('click',()=>{paused=!paused;$('pause').textContent=paused?'Resume':'Pause';});
 $('camera').addEventListener('click',()=>{renderer.camera.yaw+=Math.PI*.35;toast('Camera orbit shifted')});
 $('reset').addEventListener('click',()=>{sim.reset();acc=0;dropped=0;toast('Sculpture reset')});
 const sliders={flow:v=>`${Number(v).toFixed(1)} / s`,capacity:v=>v,quality:v=>`${Number(v).toFixed(2)}×`,speed:v=>`${Number(v).toFixed(2)}×`,spray:v=>v};
 for(const [id,format] of Object.entries(sliders)){$(id).addEventListener('input',()=>{
   const val=Number($(id).value);$(id+'Value').textContent=format(val);
   if(id==='quality')renderer.resize(Math.min(window.devicePixelRatio||1,val));
   else sim.options[id]=val;
 });}
 $('water').addEventListener('change',e=>sim.options.water=e.target.checked);
 $('particles').addEventListener('change',e=>sim.options.particles=e.target.checked);
 $('diagnostics').addEventListener('change',e=>{$('panel').querySelector('.readout').hidden=!e.target.checked});
 // Remove the experimental fountain controls as well as its work from normal play.
 $('spray').value='0';$('sprayValue').textContent='0';$('spray').hidden=true;
 $('spray').previousElementSibling.hidden=true;
 $('particles').checked=false;$('particles').closest('label').hidden=true;
 let points=new Map(),lastDistance=0,pointerMoved=false,down=null;
 const dist=()=>{const v=[...points.values()];return v.length===2?Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y):0};
 canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);points.set(e.pointerId,{x:e.clientX,y:e.clientY});down={x:e.clientX,y:e.clientY};pointerMoved=false;lastDistance=dist()});
 canvas.addEventListener('pointermove',e=>{if(!points.has(e.pointerId))return;const prev=points.get(e.pointerId);points.set(e.pointerId,{x:e.clientX,y:e.clientY});
   const d=dist();if(points.size===2&&lastDistance>0&&d>0){renderer.camera.zoom=Math.max(.62,Math.min(2.3,renderer.camera.zoom*lastDistance/d));lastDistance=d;pointerMoved=true;return}
   const dx=e.clientX-prev.x,dy=e.clientY-prev.y;if(Math.abs(dx)+Math.abs(dy)>0){renderer.camera.yaw+=dx*.007;renderer.camera.pitch=Math.max(-.22,Math.min(.65,renderer.camera.pitch+dy*.005));if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>8)pointerMoved=true}
 });
 const end=e=>{if(!points.has(e.pointerId))return;points.delete(e.pointerId);if(!pointerMoved&&points.size===0&&down)sim.add(1);down=null;lastDistance=dist()};
 canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
 canvas.addEventListener('wheel',e=>{e.preventDefault();renderer.camera.zoom=Math.max(.62,Math.min(2.3,renderer.camera.zoom*(1+e.deltaY*.001)))},{passive:false});
 window.addEventListener('keydown',e=>{if(e.code==='Space'&&e.target?.tagName!=='INPUT'){e.preventDefault();$('pause').click()}if(e.code==='Escape')open(false)});
 window.addEventListener('resize',resize,{passive:true});
}
function resize(){if(renderer)renderer.resize(Math.min(window.devicePixelRatio||1,Number($('quality').value)))}
function percentile(sorted,p){if(!sorted.length)return 0;return sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*p))]}
function stats(t){if(t-lastStats<900)return;const sec=(t-lastStats)/1000||1;lastStats=t;
 const samples=frameTimes.slice().sort((a,b)=>a-b),p50=percentile(samples,.5),p95=percentile(samples,.95);
 const fps=frames/sec;$('fps').textContent=fps?fps.toFixed(0):'—';$('marbles').textContent=sim.balls.length;
 $('present').textContent=`${p50.toFixed(1)} / ${p95.toFixed(1)} ms`;
 $('physics').textContent=steps?`${(physicalMs/steps).toFixed(2)} ms`:'—';
 $('gpu').textContent=renderer.gpuMs==null?'unavailable':`${renderer.gpuMs.toFixed(2)} ms`;
 $('draws').textContent=renderer.draws.toString();$('steps').textContent=(steps/sec).toFixed(0);
 $('pixels').textContent=(renderer.width*renderer.height/1e6).toFixed(2)+' MP';
 $('backend').textContent=`WebGL 2 · ${(renderer.displayScale).toFixed(2)}× DPR · ${dropped} skipped physics steps · ${sim.lastContacts} recent contacts. rAF cadence indicates presented-frame opportunity, not display panel specification.`;
 frames=0;steps=0;physicalMs=0;renderMs=0;frameTimes=[];
}
function tick(t){if(initError||renderer.lost)return;
 if(lastRaf){const interval=t-lastRaf;if(interval>0&&interval<300){frameTimes.push(interval);if(frameTimes.length>300)frameTimes.shift()}}
 lastRaf=t;if(!last)last=t;const wallDelta=Math.max(0,Math.min((t-last)/1000,.08));last=t;
 if(!paused){acc+=wallDelta*sim.options.speed;let count=0;
   while(acc>=FIXED_STEP&&count<12){const before=performance.now();sim.step();physicalMs+=performance.now()-before;acc-=FIXED_STEP;count++;steps++}
   if(acc>=FIXED_STEP){dropped+=Math.floor(acc/FIXED_STEP);acc%=FIXED_STEP}
 }
 const before=performance.now();renderer.render(sim,Math.min(acc/FIXED_STEP,1));renderMs+=performance.now()-before;
 frames++;stats(t);requestAnimationFrame(tick);
}
async function boot(){try{
 setProgress(12,'Creating the 3D simulation…');await Promise.resolve();
 setProgress(35,'Preparing the GPU and shared primitive meshes…');renderer=makeRenderer(canvas);resize();
 renderer.onLost=(what)=>{if(what==='restored')showError(Error('Graphics context was restored. Reload to rebuild GPU resources.'));else showError(Error('Graphics context lost. Reload the page.'))};
 setProgress(72,'Connecting controls and performance instrumentation…');setupInputs();
 setProgress(93,'Presenting the first frame…');renderer.render(sim,0);
 $('backend').textContent='WebGL 2 · running';window.__MARBLEBENCH_3D__={sim,renderer,diagnostics:()=>({marbles:sim.balls.length,steps:sim.steps,drops:dropped,draws:renderer.draws,width:renderer.width,height:renderer.height,gpuMs:renderer.gpuMs})};
 setProgress(100,'Garden ready');requestAnimationFrame(tick);
 loader.classList.add('done');setTimeout(()=>loader.remove(),520);
 }catch(err){showError(err)}}
boot();
