/* Marble Garden prototype. No external runtime dependencies. MIT. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const WORLD={w:960,h:1440};const FIXED=1/120;const MAX_STEPS=8;const R=10;
const palette=['#6ce4ce','#f4bc6b','#e778a4','#8fa8fb','#b9dd85','#89d7f6'];
const scene=$('scene'),gpuCanvas=$('gpu'),board=$('board'),ctx=scene.getContext('2d',{alpha:false});
const state={balls:[],segments:[],bumpers:[],spinners:[],paused:false,last:0,acc:0,stepCount:0,frames:0,elapsed:0,physicsMs:0,statsPhysics:0,seed:16722,renderer:'Canvas 2D',gpu:null,width:1,height:1,dpr:1,dropSteps:0,runTime:0,benchText:'',lastStats:0};
const rand=()=>{state.seed=(1664525*state.seed+1013904223)>>>0;return state.seed/4294967296};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const stage=(n,message)=>{ $('phase').textContent=message;$('fill').style.width=`${n*25}%`;$('progress-text').textContent=`Stage ${n} of 4 · setup progress, not download bytes`;};
function segment(x1,y1,x2,y2,type='track'){state.segments.push({x1,y1,x2,y2,type})}
function buildScene(){state.segments=[];state.bumpers=[];state.spinners=[];
  // Guard rails, paths and a looping lower reservoir; all geometry in world units.
  segment(65,90,65,1355,'wall');segment(895,90,895,1355,'wall');
  segment(102,220,725,390);segment(725,390,852,450);segment(852,450,770,590);
  segment(770,590,235,735);segment(235,735,105,825);segment(105,825,285,915);
  segment(285,915,755,1000);segment(755,1000,852,1125);segment(852,1125,655,1244);
  segment(655,1244,130,1244);segment(130,1244,185,1335);segment(185,1335,770,1335);
  segment(770,1335,835,1240);segment(85,1400,875,1400,'wall');
  // Funnel rails and pinball-shaped local obstacles.
  segment(240,455,400,515);segment(720,455,548,515);segment(400,515,466,590);segment(548,515,485,590);
  segment(130,1110,360,1180);segment(605,1170,815,1100);
  for(const [x,y,r] of [[345,322,22],[550,430,18],[435,804,22],[602,867,24],[405,1088,23],[540,1160,20],[235,1030,15],[730,750,16]])state.bumpers.push({x,y,r});
  state.spinners.push({x:500,y:665,len:107,phase:0,speed:1.14});state.spinners.push({x:555,y:1068,len:83,phase:1.2,speed:-1.32});
}
function marble(x=150+rand()*130,y=80+rand()*75){return {x,y,px:x,py:y,vx:(rand()-.5)*75,vy:rand()*15,r:R+(rand()-.5)*1.2,c:Math.floor(rand()*palette.length),age:0}}
function spawn(count=1,x,y){for(let i=0;i<count;i++){if(state.balls.length>=450)break;const b=marble(x===undefined?undefined:x+(rand()-.5)*22,y===undefined?undefined:y+(rand()-.5)*15);state.balls.push(b)}}
function closest(ax,ay,bx,by,x,y){const dx=bx-ax,dy=by-ay;const t=clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1),0,1);return [ax+t*dx,ay+t*dy,t]}
function resolveSegment(b,s,vx=0,vy=0){const [qx,qy]=closest(s.x1,s.y1,s.x2,s.y2,b.x,b.y);let dx=b.x-qx,dy=b.y-qy;const min=b.r+5,ds=dx*dx+dy*dy;if(ds>=min*min)return;let d=Math.sqrt(ds);if(d<1e-5){dx=0;dy=-1;d=1}const nx=dx/d,ny=dy/d,overlap=min-d;b.x+=nx*overlap;b.y+=ny*overlap;const rel=(b.vx-vx)*nx+(b.vy-vy)*ny;if(rel<0){const bounce=s.type==='wall'?.55:.38;b.vx-=(1+bounce)*rel*nx;b.vy-=(1+bounce)*rel*ny;const tx=-ny,ty=nx,fr=(b.vx-vx)*tx+(b.vy-vy)*ty;b.vx-=fr*.028*tx;b.vy-=fr*.028*ty}}
function resolveBumper(b,p){let dx=b.x-p.x,dy=b.y-p.y;const min=b.r+p.r,ds=dx*dx+dy*dy;if(ds>=min*min)return;const d=Math.sqrt(ds)||1;const nx=dx/d,ny=dy/d;b.x+=nx*(min-d);b.y+=ny*(min-d);const vn=b.vx*nx+b.vy*ny;if(vn<0){b.vx-=(1+1.02)*vn*nx;b.vy-=(1+1.02)*vn*ny;b.vy-=10}}
function step(dt){state.runTime+=dt;const grid=new Map(),cell=32;
  for(const b of state.balls){b.px=b.x;b.py=b.y;b.age+=dt;b.vy+=930*dt;b.vx*=.9997;b.vy*=.9997;b.x+=b.vx*dt;b.y+=b.vy*dt;
    for(const s of state.segments)resolveSegment(b,s);
    for(const p of state.bumpers)resolveBumper(b,p);
    for(const sp of state.spinners){const a=sp.phase+state.runTime*sp.speed,ex=Math.cos(a)*sp.len,ey=Math.sin(a)*sp.len;const q={x1:sp.x-ex,y1:sp.y-ey,x2:sp.x+ex,y2:sp.y+ey,type:'spinner'};const [cx,cy]=closest(q.x1,q.y1,q.x2,q.y2,b.x,b.y);resolveSegment(b,q,-sp.speed*(cy-sp.y),sp.speed*(cx-sp.x))}
    if(b.y>WORLD.h+30||b.age>24||(b.y>1270&&b.x>740&&b.x<865)){b.x=145+rand()*120;b.y=72+rand()*50;b.px=b.x;b.py=b.y;b.vx=rand()*50;b.vy=0;b.age=0}
    b.x=clamp(b.x,50,910);b.y=Math.max(40,b.y);
  }
  // Uniform-grid broad phase. Dynamic-dynamic contacts resolved once per unordered pair.
  for(let i=0;i<state.balls.length;i++){const b=state.balls[i],gx=Math.floor(b.x/cell),gy=Math.floor(b.y/cell);const key=gx+','+gy;let a=grid.get(key);if(!a){a=[];grid.set(key,a)}a.push(i)}
  for(let i=0;i<state.balls.length;i++){const b=state.balls[i],gx=Math.floor(b.x/cell),gy=Math.floor(b.y/cell);
    for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const ids=grid.get((gx+ox)+','+(gy+oy));if(!ids)continue;
      for(const j of ids){if(j<=i)continue;const c=state.balls[j];const dx=c.x-b.x,dy=c.y-b.y,min=b.r+c.r,ds=dx*dx+dy*dy;if(ds>=min*min)continue;
        const d=Math.sqrt(ds)||.0001,nx=dx/d,ny=dy/d,pen=(min-d)*.5;b.x-=nx*pen;b.y-=ny*pen;c.x+=nx*pen;c.y+=ny*pen;
        const rv=(c.vx-b.vx)*nx+(c.vy-b.vy)*ny;if(rv<0){const impulse=-(1+.65)*rv*.5;b.vx-=impulse*nx;b.vy-=impulse*ny;c.vx+=impulse*nx;c.vy+=impulse*ny}
      }
    }
  }
  state.stepCount++;
}
const bg=document.createElement('canvas');bg.width=WORLD.w;bg.height=WORLD.h;const bgc=bg.getContext('2d');
function background(){const g=bgc.createLinearGradient(0,0,960,1440);g.addColorStop(0,'#123440');g.addColorStop(.5,'#0a202d');g.addColorStop(1,'#08202b');bgc.fillStyle=g;bgc.fillRect(0,0,960,1440);
 bgc.strokeStyle='#3a718029';bgc.lineWidth=1;for(let y=75;y<1440;y+=48){bgc.beginPath();bgc.moveTo(0,y);bgc.lineTo(960,y);bgc.stroke()}for(let x=50;x<960;x+=48){bgc.beginPath();bgc.moveTo(x,0);bgc.lineTo(x,1440);bgc.stroke()}
 for(const s of state.segments){bgc.beginPath();bgc.moveTo(s.x1,s.y1);bgc.lineTo(s.x2,s.y2);bgc.lineCap='round';bgc.strokeStyle='#04141c';bgc.lineWidth=27;bgc.stroke();bgc.strokeStyle='#335c66';bgc.lineWidth=20;bgc.stroke();bgc.strokeStyle=s.type==='wall'?'#40717a':'#7fc4bd';bgc.lineWidth=5;bgc.stroke()}
 for(const p of state.bumpers){const gr=bgc.createRadialGradient(p.x-5,p.y-7,1,p.x,p.y,p.r+9);gr.addColorStop(0,'#ffe6a6');gr.addColorStop(.5,'#c18d64');gr.addColorStop(1,'#5d5260');bgc.fillStyle=gr;bgc.beginPath();bgc.arc(p.x,p.y,p.r+5,0,Math.PI*2);bgc.fill();bgc.strokeStyle='#f2d39a';bgc.lineWidth=2;bgc.stroke()}
 bgc.fillStyle='#d0eae9a1';bgc.font='bold 16px system-ui';bgc.fillText('01  THE DESCENT',110,168);bgc.fillText('02  THE FUNNEL',340,456);bgc.fillText('03  THE SPINNERS',365,631);bgc.fillText('04  THE RETURN',160,1308);
}
function roundRect(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r);c.fill()}
function ball2d(c,b){const r=b.r;const grad=c.createRadialGradient(b.x-r*.37,b.y-r*.45,r*.08,b.x,b.y,r*1.14);grad.addColorStop(0,'#ffffff');grad.addColorStop(.18,palette[b.c]);grad.addColorStop(.84,palette[b.c]);grad.addColorStop(1,'#10242a');c.fillStyle=grad;c.beginPath();c.arc(b.x,b.y,r,0,Math.PI*2);c.fill();c.strokeStyle='#dfffffac';c.lineWidth=.7;c.stroke()}
function dynamicScene(alpha){const {width:w,height:h}=state;const scale=Math.min(w/WORLD.w,h/WORLD.h),offx=(w-WORLD.w*scale)/2,offy=(h-WORLD.h*scale)/2;ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#081923';ctx.fillRect(0,0,w,h);ctx.setTransform(scale,0,0,scale,offx,offy);ctx.drawImage(bg,0,0);
 for(const sp of state.spinners){const a=sp.phase+state.runTime*sp.speed,ex=Math.cos(a)*sp.len,ey=Math.sin(a)*sp.len;ctx.beginPath();ctx.moveTo(sp.x-ex,sp.y-ey);ctx.lineTo(sp.x+ex,sp.y+ey);ctx.lineWidth=16;ctx.lineCap='round';ctx.strokeStyle='#d7a76e';ctx.stroke();ctx.beginPath();ctx.arc(sp.x,sp.y,17,0,Math.PI*2);ctx.fillStyle='#f4d4a0';ctx.fill();ctx.beginPath();ctx.arc(sp.x,sp.y,7,0,Math.PI*2);ctx.fillStyle='#153a43';ctx.fill()}
 // The GPU backend draws only marbles; overlay remains a real Canvas 2D reference scene.
 if(!state.gpu){for(const b of state.balls)ball2d(ctx,b)}
}
const SHADER=`
struct Screen { viewport: vec4f, };
struct Ball { pos: vec2f, radius: f32, color: f32, };
@group(0) @binding(0) var<uniform> screen: Screen;
@group(0) @binding(1) var<storage, read> balls: array<Ball>;
struct Out { @builtin(position) clip: vec4f, @location(0) local: vec2f, @location(1) col: vec3f, };
@vertex fn vertex(@builtin(vertex_index) vertexIndex:u32,@builtin(instance_index) instanceIndex:u32)->Out {
 let quad=array<vec2f,6>(vec2f(-1.0,-1.0),vec2f(1.0,-1.0),vec2f(-1.0,1.0),vec2f(-1.0,1.0),vec2f(1.0,-1.0),vec2f(1.0,1.0));
 let b=balls[instanceIndex];let offset=vec2f(screen.viewport.w,(screen.viewport.y-1440.0*screen.viewport.z)*0.5);let xy=(b.pos+quad[vertexIndex]*b.radius)*screen.viewport.z+offset;
 var o:Out;o.clip=vec4f(xy.x/screen.viewport.x*2.0-1.0,1.0-xy.y/screen.viewport.y*2.0,0.0,1.0);
 o.local=quad[vertexIndex];let colors=array<vec3f,6>(vec3f(.42,.89,.81),vec3f(.96,.74,.42),vec3f(.91,.47,.64),vec3f(.56,.66,.98),vec3f(.73,.87,.52),vec3f(.54,.84,.96));o.col=colors[min(u32(b.color),5u)];return o;
}
@fragment fn fragment(in:Out)->@location(0) vec4f {
 let d=length(in.local);if(d>1.0){discard;}
 let light=clamp(1.16-0.42*d+max(0.0,1.0-length(in.local-vec2f(-.32,-.40))*1.9)*.34,0.0,1.45);
 let edge=smoothstep(.83,1.0,d);let color=mix(in.col*light,vec3f(.08,.18,.23),edge*.64);
 return vec4f(color,1.0);
}`;
async function tryGPU(){if(!navigator.gpu){gpuCanvas.remove();$('backend').textContent='Canvas 2D · no WebGPU';return}let device;
 try{const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw Error('No GPU adapter');device=await adapter.requestDevice();const context=gpuCanvas.getContext('webgpu');if(!context)throw Error('No WebGPU canvas');const format=navigator.gpu.getPreferredCanvasFormat();
 context.configure({device,format,alphaMode:'premultiplied'});
 const module=device.createShaderModule({code:SHADER});const compilation=await module.getCompilationInfo();if(compilation.messages.some(m=>m.type==='error'))throw Error('WGSL compilation: '+compilation.messages.filter(m=>m.type==='error').map(m=>m.message).join('; '));const pipeline=device.createRenderPipeline({layout:'auto',vertex:{module,entryPoint:'vertex'},fragment:{module,entryPoint:'fragment',targets:[{format}]},primitive:{topology:'triangle-list'}});
 const screenBuffer=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});const maxBalls=450;
 const ballsBuffer=device.createBuffer({size:maxBalls*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
 const bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:screenBuffer}},{binding:1,resource:{buffer:ballsBuffer}}]});
 state.gpu={device,context,pipeline,screenBuffer,ballsBuffer,bind,payload:new Float32Array(maxBalls*4)};gpuCanvas.style.display='block';state.renderer='WebGPU marbles + Canvas tracks';$('backend').textContent='WebGPU · active';
 device.lost.then(()=>{state.gpu=null;state.renderer='Canvas 2D (GPU lost)';gpuCanvas.remove();$('backend').textContent='Canvas 2D · GPU lost'});
 }catch(e){state.gpu=null;gpuCanvas.remove();state.renderer='Canvas 2D (WebGPU fallback)';$('backend').textContent='Canvas 2D · fallback';console.warn('WebGPU initialization failed; Canvas 2D fallback',e);if(device)device.destroy()}
}
function gpuRender(){const g=state.gpu;if(!g||!state.balls.length)return;const a=g.payload;for(let i=0;i<state.balls.length;i++){const b=state.balls[i],j=i*4;a[j]=b.x;a[j+1]=b.y;a[j+2]=b.r;a[j+3]=b.c}try{
 g.device.queue.writeBuffer(g.screenBuffer,0,new Float32Array([state.width,state.height,Math.min(state.width/WORLD.w,state.height/WORLD.h),(state.width-WORLD.w*Math.min(state.width/WORLD.w,state.height/WORLD.h))/2]));g.device.queue.writeBuffer(g.ballsBuffer,0,a,0,state.balls.length*4);
 const encoder=g.device.createCommandEncoder(),pass=encoder.beginRenderPass({colorAttachments:[{view:g.context.getCurrentTexture().createView(),loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:0}}]});pass.setPipeline(g.pipeline);pass.setBindGroup(0,g.bind);pass.draw(6,state.balls.length);pass.end();g.device.queue.submit([encoder.finish()]);
 }catch(e){console.warn('WebGPU draw failed, using Canvas 2D',e);state.gpu=null;gpuCanvas.remove();$('backend').textContent='Canvas 2D · recovered'}
}
function resize(){const rect=board.getBoundingClientRect();if(rect.width<=0||rect.height<=0)return;const physicalDPR=Math.max(1,window.devicePixelRatio||1);const target=Math.min(physicalDPR,2);state.dpr=target;state.width=Math.max(1,Math.floor(rect.width*target));state.height=Math.max(1,Math.floor(rect.height*target));
 for(const c of [scene,gpuCanvas]){if(c.width!==state.width)c.width=state.width;if(c.height!==state.height)c.height=state.height}
 if(state.gpu)state.gpu.context.configure({device:state.gpu.device,format:navigator.gpu.getPreferredCanvasFormat(),alphaMode:'premultiplied'});
 // Both renderers letterbox the same fixed world coordinates.
}
function tick(t){if(!state.last)state.last=t;let delta=clamp((t-state.last)/1000,0,.1);state.last=t;if(!state.paused){state.acc+=delta;let steps=0;
 while(state.acc>=FIXED&&steps<MAX_STEPS){const start=performance.now();step(FIXED);state.statsPhysics+=performance.now()-start;state.acc-=FIXED;steps++}if(steps===MAX_STEPS&&state.acc>=FIXED){state.dropSteps+=Math.floor(state.acc/FIXED);state.acc=state.acc%FIXED}}
 dynamicScene(state.acc/FIXED);gpuRender();state.frames++;state.elapsed+=delta;
 if(state.elapsed>=.7){const s=state.elapsed;$('fps').textContent=(state.frames/s).toFixed(0);$('steps').textContent=(state.stepCount/s).toFixed(0);$('phys').textContent=state.stepCount?(state.statsPhysics/state.stepCount).toFixed(2):'—';$('count').textContent=state.balls.length;
 $('detail').textContent=`${state.renderer} · ${state.dpr.toFixed(1)}× DPR · ${state.dropSteps} dropped sim steps${state.benchText?' · '+state.benchText:''}`;
 state.frames=0;state.stepCount=0;state.statsPhysics=0;state.elapsed=0}
 requestAnimationFrame(tick)}
function position(e){const r=board.getBoundingClientRect();const scale=Math.min(r.width/WORLD.w,r.height/WORLD.h);return {x:(e.clientX-r.left-(r.width-WORLD.w*scale)/2)/scale,y:(e.clientY-r.top-(r.height-WORLD.h*scale)/2)/scale}}
board.addEventListener('pointerdown',e=>{const p=position(e);spawn(1,clamp(p.x,90,870),clamp(p.y,60,1300));$('hint').textContent='Marbles recirculate through the garden'});
$('spawn').addEventListener('click',()=>spawn(12));$('pause').addEventListener('click',()=>{state.paused=!state.paused;$('pause').textContent=state.paused?'Resume':'Pause';state.acc=0;state.last=0});
$('reset').addEventListener('click',()=>{state.seed=16722;state.balls=[];state.acc=0;state.runTime=0;state.dropSteps=0;spawn(70);state.benchText='';});
$('bench').addEventListener('click',()=>{const saved=state.balls.map(b=>({...b})),time=state.runTime,seed=state.seed,prevPaused=state.paused,savedStepCount=state.stepCount,savedPhysics=state.statsPhysics;state.paused=true;const start=performance.now();for(let i=0;i<120;i++)step(FIXED);const elapsed=performance.now()-start;
 state.balls=saved;state.runTime=time;state.seed=seed;state.paused=prevPaused;state.stepCount=savedStepCount;state.statsPhysics=savedPhysics;state.acc=0;state.last=0;state.benchText=`120-step CPU bench ${(elapsed/120).toFixed(2)} ms/step`;console.info(state.benchText);});
async function start(){try{stage(1,'Preparing geometry and physics…');buildScene();background();spawn(70);stage(2,'Preparing render surfaces…');resize();window.addEventListener('resize',resize,{passive:true});if('ResizeObserver'in window)new ResizeObserver(resize).observe(board);
 stage(3,'Starting the playable Canvas renderer…');window.__MARBLE_GARDEN__={state,step,spawn,resize};requestAnimationFrame(tick);stage(4,'Ready to play');setTimeout(()=>$('loader').classList.add('done'),200);
 // GPU support is optional: requesting an adapter or compiling a shader must never gate gameplay.
 Promise.resolve().then(()=>tryGPU()).catch(e=>console.warn('Optional WebGPU enhancement unavailable',e));
 if(location.protocol==='https:'&&document.querySelector('script[src="./main.js"]')&&'serviceWorker'in navigator){navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('Offline cache unavailable:',e))}
 }catch(e){const alert=$('error');alert.textContent='Initialization error: '+String(e.stack||e)+'\nPlease open the HTTPS-hosted version in Safari or Chrome; Files previews may not execute JavaScript.';alert.style.display='block';$('phase').textContent='Unable to finish initialization';$('progress-text').textContent='Initialization failed · error shown below';console.error(e)}}
start();
})();
