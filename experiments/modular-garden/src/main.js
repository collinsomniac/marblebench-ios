import * as THREE from 'three/webgpu';
import RAPIER from '@dimforge/rapier3d-compat';
import {GardenSimulation,FIXED_DT} from './physics.js';
import {CameraRig} from './camera.js';

const $=id=>document.getElementById(id);
const canvas=$('world'),overlay=$('loading'),progress=$('fill');
const query=new URLSearchParams(location.search);
const requested=query.get('backend')==='webgl2'?'webgl2':'auto';
const DEFAULT_PACE=1.15; // Reversible presentation choice; physics stays fixed at 120 Hz.
$('backend').value=requested;
let renderer=null,sim=null,rig=null,scene=null,camera=null;
let raf=0,last=0,accumulator=0,steps=0,physicsMs=0,frameIntervals=[],lastHud=0,errors=0;
let paused=false,frames=0,ready=false,quality=1.25;
const pct=(a,p)=>a.length?a[Math.min(a.length-1,Math.floor((a.length-1)*p))]:0;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function phase(p,text){progress.style.width=`${p}%`;$('phase').textContent=text;}
function failure(error){console.error(error);$('error').textContent=String(error?.message||error);$('phase').textContent='Experimental renderer unavailable';overlay.classList.remove('done');$('build').textContent='Startup failed: '+String(error);ready=false;}
function resize(){
  if(!renderer||!camera)return;
  const dpr=Math.min(window.devicePixelRatio||1,quality);
  renderer.setPixelRatio(dpr);
  renderer.setSize(Math.max(1,innerWidth),Math.max(1,innerHeight),false);
  camera.aspect=innerWidth/Math.max(1,innerHeight);
  camera.updateProjectionMatrix();
}
function initUI(){
  const panel=$('panel'),tune=$('settings');
  const setOpen=open=>{panel.hidden=!open;tune.setAttribute('aria-expanded',String(open));};
  tune.addEventListener('click',()=>setOpen(panel.hidden));
  $('close').addEventListener('click',()=>setOpen(false));
  $('add').addEventListener('click',()=>sim.addMarbles(1));
  $('pause').addEventListener('click',()=>{paused=!paused;$('pause').textContent=paused?'Resume':'Pause';accumulator=0;});
  const modes={orbit:'Drag the sculpture to orbit · two fingers pan and zoom',explore:'Left pad moves · drag anywhere else to look around',third:'Drag to look around the selected marble · Next ball switches subject',first:'Marble-eye camera · drag to look · Next ball switches subject'};
  const mode=$('mode');
  mode.addEventListener('change',()=>{
    mode.value=rig.setMode(mode.value,sim.balls);
    $('next').hidden=mode.value==='orbit'||mode.value==='explore';
    $('notice').textContent=modes[mode.value];
  });
  $('next').addEventListener('click',()=>rig.nextMarble(sim.balls));
  const sliders={flow:v=>`${v.toFixed(2)}/s`,capacity:v=>String(v),quality:v=>`${v.toFixed(2)}×`,speed:v=>`${v.toFixed(2)}×`};
  for(const [id,format] of Object.entries(sliders)){
    const el=$(id),output=$(id+'Val');
    el.addEventListener('input',()=>{const v=Number(el.value);output.textContent=format(v);if(id!=='quality')sim.options[id]=v;});
  }
  $('quality').addEventListener('change',()=>{quality=Number($('quality').value);resize();});
  $('water').addEventListener('change',()=>{sim.options.water=$('water').checked;});
  $('reload').addEventListener('click',()=>{const url=new URL(location.href);url.searchParams.set('backend',$('backend').value);location.assign(url.href);});
  $('copy').addEventListener('click',async()=>{
    const snapshot=JSON.stringify({at:new Date().toISOString(),simulation:sim.snapshot(),settings:{...sim.options},renderer:renderer.backend?.constructor?.name??'unknown',request:requested,viewport:[innerWidth,innerHeight],dpr:renderer.getPixelRatio?.(),displayStats:{fps:$('fps').textContent,frame:$('frameTime').textContent,physics:$('physicsTime').textContent,draws:$('draws').textContent},ua:navigator.userAgent},null,2);
    try{await navigator.clipboard.writeText(snapshot);$('copy').textContent='Copied';}catch{console.info(snapshot);$('copy').textContent='Clipboard unavailable';}
  });
  window.addEventListener('resize',resize,{passive:true});
  window.addEventListener('keydown',event=>{
    if(event.target?.tagName==='INPUT'||event.target?.tagName==='SELECT')return;
    if(event.code==='Space'){event.preventDefault();$('pause').click();}
    if(event.code==='Escape')setOpen(false);
  });
}
function updateStats(t){
  if(t-lastHud<1000)return;
  const elapsed=(t-lastHud)/1000||1;
  const sorted=frameIntervals.slice().sort((a,b)=>a-b);
  $('fps').textContent=(frames/elapsed).toFixed(1);
  $('count').textContent=String(sim.balls.length);
  $('frameTime').textContent=`rAF p50/p95: ${pct(sorted,.5).toFixed(1)}/${pct(sorted,.95).toFixed(1)}ms`;
  $('physicsTime').textContent=`Physics: ${steps?(physicsMs/steps).toFixed(3):'—'}ms/step`;
  $('draws').textContent=`Draw calls: ${renderer.info?.render?.calls??'n/a'}`;
  $('rendered').textContent=`Backbuffer: ${(Math.round(innerWidth*renderer.getPixelRatio?.()||0)*Math.round(innerHeight*renderer.getPixelRatio?.()||0)/1e6).toFixed(2)} MP`;
  $('errors').textContent=`Errors/loss: ${errors}`;
  frames=0;steps=0;physicsMs=0;frameIntervals.length=0;lastHud=t;
}
function tick(t){
  if(!ready)return;
  try{
    if(last){const interval=t-last;if(interval>0&&interval<250){frameIntervals.push(interval);if(frameIntervals.length>160)frameIntervals.shift();}}
    const dt=last?clamp((t-last)/1000,0,.075):0;
    last=t;
    if(!paused){
      accumulator+=dt*sim.options.speed;
      let count=0;
      while(accumulator>=FIXED_DT&&count<12){
        const t0=performance.now();
        sim.step();
        physicsMs+=performance.now()-t0;
        accumulator-=FIXED_DT;steps++;count++;
      }
      // Clamp stale accumulated time; never teleport bodies to compensate for a frame stall.
      if(accumulator>=FIXED_DT)accumulator%=FIXED_DT;
    }
    const alpha=clamp(accumulator/FIXED_DT,0,1);
    rig.update(dt,sim.balls,alpha);
    sim.syncInstances(alpha,rig.mode==='first'?sim.balls.find(ball=>ball.id===rig.focusId):null);
    renderer.render(scene,camera);
    frames++;
    updateStats(t);
  }catch(error){errors++;failure(error);renderer.setAnimationLoop(null);}
}
async function boot(){
  try{
    phase(7,'Loading Rapier WebAssembly…');
    await RAPIER.init();
    phase(29,'Creating shared materials, rails and rigid-body colliders…');
    scene=new THREE.Scene();scene.background=new THREE.Color(0xeff5f2);
    scene.add(new THREE.HemisphereLight(0xe8fbff,0xb6b6ac,2.1));
    const key=new THREE.DirectionalLight(0xfff2dc,2.75);key.position.set(-5,13,8);scene.add(key);
    const fill=new THREE.DirectionalLight(0xb4d9ff,1.05);fill.position.set(8,8,-7);scene.add(fill);
    camera=new THREE.PerspectiveCamera(47,1,.045,110);
    sim=new GardenSimulation(RAPIER,scene);
    sim.options.speed=DEFAULT_PACE;
    $('speed').value=String(DEFAULT_PACE);
    $('speedVal').textContent=DEFAULT_PACE.toFixed(2)+'×';
    phase(55,'Initializing a single GPU renderer…');
    renderer=new THREE.WebGPURenderer({canvas,antialias:true,alpha:false,forceWebGL:requested==='webgl2'});
    await renderer.init();
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.12;
    quality=Math.min(1.25,window.devicePixelRatio||1.25);
    $('quality').value=String(quality);
    $('qualityVal').textContent=quality.toFixed(2)+'×';
    resize();
    rig=new CameraRig(camera,canvas,$('movement'),$('thumb'));
    phase(83,'Connecting touch controls and performance metrics…');
    initUI();
    $('engine').textContent='Rapier WASM + Three';
    const actual=renderer.backend?.constructor?.name??'backend not exposed';
    $('build').textContent=`Requested ${requested}; initialized ${actual}. Fixed physics ${Math.round(1/FIXED_DT)} Hz. No fluid solver yet.`;
    phase(100,'Ready to explore');
    lastHud=performance.now();
    ready=true;
    renderer.setAnimationLoop(tick);
    overlay.classList.add('done');
    setTimeout(()=>overlay.remove(),500);
    window.__MARBLEBENCH_MODULAR__={simulation:sim,rig,renderer,snapshot:()=>sim.snapshot()};
  }catch(error){failure(error);}
}
document.addEventListener('visibilitychange',()=>{last=0;accumulator=0;frameIntervals.length=0;});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();errors++;$('build').textContent='Graphics context lost; reload to rebuild GPU resources.';});
boot();
