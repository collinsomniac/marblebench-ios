/** Lean, dependency-free WebGL2 reference renderer: shared meshes, instanced objects, one canvas. */
import {TRACKS,POOL,WHEEL,SWITCH,COLORS} from './physics.js';
const VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 position;
layout(location=1) in vec3 normal;
layout(location=2) in vec3 instanceCenter;
layout(location=3) in vec3 instanceScale;
layout(location=4) in vec3 instanceColor;
layout(location=5) in float instanceAngle;
uniform mat4 uView,uProj;
out vec3 vN,vColor,vWorld;
void main(){float s=sin(instanceAngle),c=cos(instanceAngle);vec3 p=position*instanceScale;
  vec3 w=vec3(p.x*c-p.y*s,p.x*s+p.y*c,p.z)+instanceCenter;
  vWorld=w;vN=normalize(vec3(normal.x*c-normal.y*s,normal.x*s+normal.y*c,normal.z));
  vColor=instanceColor;gl_Position=uProj*uView*vec4(w,1.0);
}`;
const FS=`#version 300 es
precision highp float;
in vec3 vN,vColor,vWorld;out vec4 outColor;
void main(){vec3 N=normalize(vN);vec3 L=normalize(vec3(-.38,.75,.54));
  float lam=max(dot(N,L),0.0),fill=.31+.68*lam;
  float spec=pow(max(dot(reflect(-L,N),normalize(vec3(0.25,.85,1.0))),0.0),24.0)*.20;
  vec3 col=vColor*fill+spec*vec3(.85,.97,.92);
  float haze=clamp(length(vWorld)*.017,0.,.15);
  outColor=vec4(mix(col,vec3(.035,.12,.17),haze),1.);
}`;
const WATER_FS=`#version 300 es
precision highp float;
in vec3 vN,vColor,vWorld;out vec4 outColor;uniform float uTime;
void main(){float a=sin(vWorld.x*10.3+uTime*2.4)*sin(vWorld.z*8.8-uTime*2.0);
  float b=sin(length(vWorld.xz-vec2(-2.4,.9))*14.-uTime*6.0);
  float f=.5+.5*a;vec3 c=mix(vec3(.07,.43,.51),vec3(.35,.86,.83),f*.65+b*.09);
  outColor=vec4(c,.70);
}`;
const PARTICLE_VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 p;
layout(location=1) in float sz;
layout(location=2) in float life;
uniform mat4 uView,uProj;uniform float uDpr;
out float vLife;
void main(){vec4 eye=uView*vec4(p,1.);gl_Position=uProj*eye;
 gl_PointSize=clamp(sz*uDpr*12.0/max(1.0,-eye.z),1.,12.);vLife=life;
}`;
const PARTICLE_FS=`#version 300 es
precision mediump float;in float vLife;out vec4 outColor;
void main(){float r=length(gl_PointCoord-.5);float a=smoothstep(.50,.08,r)*vLife;
 outColor=vec4(.69,.99,1.,a);
}`;
function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)||'Shader compile failure');return s}
function program(gl,vs,fs){const p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p)||'Link failure');return p}
function cube(){const V=[],I=[];const faces=[[[0,0,1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],[[0,0,-1],[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]],[[1,0,0],[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]],[[-1,0,0],[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]],[[0,1,0],[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]],[[0,-1,0],[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]]];for(let f=0;f<6;f++){const [n,...verts]=faces[f];for(const p of verts)V.push(...p.map(x=>x*.5),...n);const k=f*4;I.push(k,k+1,k+2,k,k+2,k+3)}return {vertices:new Float32Array(V),indices:new Uint16Array(I)}}
function sphere(lon=14,lat=10){const V=[],I=[];for(let j=0;j<=lat;j++){const t=j/lat*Math.PI;for(let i=0;i<=lon;i++){const p=i/lon*Math.PI*2,x=Math.sin(t)*Math.cos(p),y=Math.cos(t),z=Math.sin(t)*Math.sin(p);V.push(x*.5,y*.5,z*.5,x,y,z)}}for(let j=0;j<lat;j++)for(let i=0;i<lon;i++){const a=j*(lon+1)+i,b=a+lon+1;I.push(a,b,a+1,b,b+1,a+1)}return {vertices:new Float32Array(V),indices:new Uint16Array(I)}}
function batch(gl,mesh,capacity){const vao=gl.createVertexArray();gl.bindVertexArray(vao);
 const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,mesh.vertices,gl.STATIC_DRAW);
 for(let i=0;i<2;i++){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,24,i*12)}
 const eb=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,eb);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);
 const instances=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,instances);gl.bufferData(gl.ARRAY_BUFFER,capacity*10*4,gl.DYNAMIC_DRAW);
 const stride=40;for(let i=2;i<=5;i++){const sizes=[3,3,3,1],offsets=[0,12,24,36];gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,sizes[i-2],gl.FLOAT,false,stride,offsets[i-2]);gl.vertexAttribDivisor(i,1)}
 gl.bindVertexArray(null);return {vao,instances,indexCount:mesh.indices.length,capacity,data:new Float32Array(capacity*10)};
}
const add=(arr,x,y,z,sx,sy,sz,r,g,b,a=0)=>arr.push(x,y,z,sx,sy,sz,r,g,b,a);
function staticCourse(){const B=[];const mint=[.20,.68,.68],edge=[.39,.83,.78],gold=[.87,.62,.34],dark=[.12,.30,.37];
 for(const [a,b,w] of TRACKS){const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),rot=Math.atan2(dy,dx),x=(a[0]+b[0])*.5,y=(a[1]+b[1])*.5,z=(a[2]+b[2])*.5;
   add(B,x,y-.09,z,length,.16,w,...mint,rot);
   add(B,x,y+.085,z-w*.46,length,.12,.09,...edge,rot);
   add(B,x,y+.085,z+w*.46,length,.12,.09,...edge,rot);
   if(length>2){add(B,x,y-.65,z,.12,1.1,.12,...dark,0)}
 }
 // Platform and structural scaffolding with minimal unique geometry.
 add(B,.05,-1.13,.0,11.1,.23,4.35,...dark);
 for(const x of [-4.5,4.5])for(const z of [-1.4,1.4])add(B,x,2.75,z,.11,7.8,.11,...dark);
 for(const x of [-3.8,0,3.8])add(B,x,1.2,-1.65,.08,4.6,.08,...dark);
 // Water basin floor and walls; translucent top surface drawn separately.
 const mid=(POOL.minX+POOL.maxX)/2,midz=(POOL.minZ+POOL.maxZ)/2;
 add(B,mid,.04,midz,POOL.maxX-POOL.minX,.16,POOL.maxZ-POOL.minZ,...dark);
 add(B,mid,.65,POOL.minZ,.0+POOL.maxX-POOL.minX,1.0,.12,...edge);
 add(B,mid,.65,POOL.maxZ,.0+POOL.maxX-POOL.minX,1.0,.12,...edge);
 add(B,POOL.minX,.65,midz,.12,1.0,POOL.maxZ-POOL.minZ,...edge);
 add(B,POOL.maxX,.65,midz,.12,1.0,POOL.maxZ-POOL.minZ,...edge);
 // Copper-colored vortex rim approximated by reused small elements.
 for(let i=0;i<24;i++){const a=i/24*Math.PI*2;add(B,3.5+Math.cos(a)*.81,4.9,-.83+Math.sin(a)*.81,.19,.14,.19,...gold)}
 // Wheel perimeter and spokes assembled from box primitives.
 for(let i=0;i<12;i++){const a=i/12*Math.PI*2;
   add(B,WHEEL.x+Math.cos(a)*WHEEL.r,WHEEL.y+Math.sin(a)*WHEEL.r,WHEEL.z,.13,.15,.15,...gold)}
 add(B,-2.43,2.19,-.43,.18,1.65,.18,...dark);
 add(B,SWITCH.x,3.05,SWITCH.z,.15,1.15,.15,...dark);
 // Distinct release portal and end-of-loop lift shaft.
 add(B,-4.53,3.55,-.87,.38,7.1,.32,...dark);
 add(B,-4.53,7.30,-.87,.8,.18,.8,...gold);
 add(B,4.65,-.55,.0,.85,.22,.85,...gold);
 return B;
}
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov*.5),m=new Float32Array(16);m[0]=f/aspect;m[5]=f;m[10]=(far+near)/(near-far);m[11]=-1;m[14]=2*far*near/(near-far);return m}
const norm=v=>{const d=Math.hypot(...v)||1;return v.map(x=>x/d)};
function view(eye,target){const z=norm(eye.map((a,i)=>a-target[i])),x=norm([z[2],0,-z[0]]),y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];
 return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-x.reduce((s,v,i)=>s+v*eye[i],0),-y.reduce((s,v,i)=>s+v*eye[i],0),-z.reduce((s,v,i)=>s+v*eye[i],0),1]);}
export function makeRenderer(canvas){const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,powerPreference:'high-performance',depth:true,stencil:false,preserveDrawingBuffer:false});
 if(!gl)throw Error('WebGL 2 is unavailable in this browser.');
 const meshProgram=program(gl,VS,FS),waterProgram=program(gl,VS,WATER_FS),particleProgram=program(gl,PARTICLE_VS,PARTICLE_FS);
 const boxes=batch(gl,cube(),150),balls=batch(gl,sphere(),260),water=batch(gl,cube(),1);
 const staticBoxes=staticCourse();if(staticBoxes.length/10+8>boxes.capacity)throw Error('Scene exceeds box instance capacity');
 water.data.set([(POOL.minX+POOL.maxX)*.5,POOL.level,(POOL.minZ+POOL.maxZ)*.5,POOL.maxX-POOL.minX,.025,POOL.maxZ-POOL.minZ,.19,.68,.76,0]);
 gl.bindBuffer(gl.ARRAY_BUFFER,water.instances);gl.bufferSubData(gl.ARRAY_BUFFER,0,water.data.subarray(0,10));
 const pv=gl.createVertexArray(),pb=gl.createBuffer();gl.bindVertexArray(pv);gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,400*5*4,gl.DYNAMIC_DRAW);
 gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,1,gl.FLOAT,false,20,12);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.FLOAT,false,20,16);gl.bindVertexArray(null);
 const timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');let query=null,gpuMs=null;
 gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
 const uniforms=new Map();const get=(p,name)=>{let t=uniforms.get(p);if(!t){t={};uniforms.set(p,t)}return t[name]||(t[name]=gl.getUniformLocation(p,name))};
 const renderer={gl,gpuMs:null,width:0,height:0,draws:0,displayScale:1,camera:{yaw:.39,pitch:.18,zoom:1,orbit:true},lost:false};
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();renderer.lost=true;renderer.onLost?.()},{passive:false});
 canvas.addEventListener('webglcontextrestored',()=>{renderer.onLost?.('restored')});
 renderer.resize=(dpr)=>{const w=Math.max(1,Math.round(canvas.clientWidth*dpr)),h=Math.max(1,Math.round(canvas.clientHeight*dpr));
   if(w!==canvas.width||h!==canvas.height){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h)}
   renderer.width=w;renderer.height=h;renderer.displayScale=dpr;
 };
 renderer.render=(sim,alpha)=>{
   if(renderer.lost)return;
   const a=renderer.camera,aspect=renderer.width/Math.max(renderer.height,1),dist=(aspect<.76?27.0:18.2)*a.zoom;
   const eye=[Math.sin(a.yaw)*Math.cos(a.pitch)*dist,3.10+Math.sin(a.pitch)*dist,Math.cos(a.yaw)*Math.cos(a.pitch)*dist];
   const V=view(eye,[.1,3.1,-.12]),P=perspective(47*Math.PI/180,aspect,.1,100);
   if(timer&&query&&gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)){
     if(!gl.getParameter(timer.GPU_DISJOINT_EXT))gpuMs=gl.getQueryParameter(query,gl.QUERY_RESULT)*1e-6;
     gl.deleteQuery(query);query=null;
   }
   if(timer&&!query){query=gl.createQuery();gl.beginQuery(timer.TIME_ELAPSED_EXT,query)}
   gl.clearColor(.025,.085,.122,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);let draws=0;
   const use=(p)=>{gl.useProgram(p);gl.uniformMatrix4fv(get(p,'uView'),false,V);gl.uniformMatrix4fv(get(p,'uProj'),false,P)};
   const draw=(bt,count)=>{if(!count)return;gl.bindVertexArray(bt.vao);gl.drawElementsInstanced(gl.TRIANGLES,bt.indexCount,gl.UNSIGNED_SHORT,0,count);draws++};
   let cursor=0;boxes.data.set(staticBoxes,0);cursor=staticBoxes.length;
   const dynamic=(...v)=>{boxes.data.set(v,cursor);cursor+=10};
   const wheelAngle=sim.now*.95;for(let i=0;i<4;i++){const rot=wheelAngle+i*Math.PI/2;
     dynamic(WHEEL.x,WHEEL.y,WHEEL.z,WHEEL.r*2,.17,.2,.98,.72,.4,rot)}
   dynamic(SWITCH.x,SWITCH.y,SWITCH.z,SWITCH.length*2,.14,.2,.96,.67,.42,Math.sin(sim.now*1.3)*.29);
   gl.bindBuffer(gl.ARRAY_BUFFER,boxes.instances);gl.bufferSubData(gl.ARRAY_BUFFER,0,boxes.data.subarray(0,cursor));
   use(meshProgram);draw(boxes,cursor/10);
   let n=0;for(const b of sim.balls){const color=COLORS[b.color],t=alpha;
     const x=b.px+(b.x-b.px)*t,y=b.py+(b.y-b.py)*t,z=b.pz+(b.z-b.pz)*t;
     balls.data.set([x,y,z,b.r*2,b.r*2,b.r*2,...color,0],n*10);n++;
   }
   gl.bindBuffer(gl.ARRAY_BUFFER,balls.instances);gl.bufferSubData(gl.ARRAY_BUFFER,0,balls.data.subarray(0,n*10));draw(balls,n);
   if(sim.options.water){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
     use(waterProgram);gl.uniform1f(get(waterProgram,'uTime'),sim.now);draw(water,1);gl.depthMask(true);gl.disable(gl.BLEND)}
   if(sim.options.particles&&sim.droplets.length){const ddata=new Float32Array(sim.droplets.length*5);
     let k=0;for(const d of sim.droplets){ddata[k++]=d.x;ddata[k++]=d.y;ddata[k++]=d.z;ddata[k++]=d.size;ddata[k++]=Math.max(0,1-d.life/d.maxLife)}
     gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferSubData(gl.ARRAY_BUFFER,0,ddata);
     gl.useProgram(particleProgram);gl.uniformMatrix4fv(get(particleProgram,'uView'),false,V);gl.uniformMatrix4fv(get(particleProgram,'uProj'),false,P);
     gl.uniform1f(get(particleProgram,'uDpr'),renderer.displayScale);
     gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.depthMask(false);gl.bindVertexArray(pv);gl.drawArrays(gl.POINTS,0,sim.droplets.length);gl.depthMask(true);gl.disable(gl.BLEND);draws++;
   }
   if(timer&&query)gl.endQuery(timer.TIME_ELAPSED_EXT);
   renderer.gpuMs=gpuMs;renderer.draws=draws;gl.bindVertexArray(null);
 };
 return renderer;
}
