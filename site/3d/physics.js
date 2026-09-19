/** Minimal inspectable 3D reference physics. NOT a full rigid-body solver or CFD. */
export const TRACKS = [
  [[-4.5,7.1,-0.85],[3.3,5.45,-0.85],0.58],
  [[3.18,4.18,-0.8],[0.35,3.55,-0.5],0.56],
  [[0.35,3.55,-0.5],[-3.6,2.83,-0.42],0.55],
  [[-3.6,2.83,-0.42],[-2.03,1.18,0.3],0.59],
  [[2.55,0.8,0.28],[4.35,-0.48,0.0],0.54],
  [[4.35,-0.48,0.0],[4.85,-0.82,0.0],0.54],
];
export const POOL = {minX:-2.75,maxX:2.7,minZ:-1.23,maxZ:1.45,level:1.05};
export const WHEEL = {x:-1.72,y:3.02,z:-0.43,r:0.77};
export const SWITCH = {x:1.33,y:3.65,z:-0.5,length:1.14};
export const COLORS = [
  [0.50,0.93,0.78], [1.0,0.70,0.40], [0.99,0.48,0.64],
  [0.52,0.68,1.0], [0.91,0.87,0.49], [0.56,0.89,1.0],
];
const R=0.155, DT=1/120, CELL=0.42, G=10.5;
const clamp=(v,a,b)=>Math.max(a,Math.min(v,b));
function point(x,y,z,vx=0,vy=0,vz=0){return {x,y,z,px:x,py:y,pz:z,vx,vy,vz,r:R,color:0,age:0,water:false,mode:'free',funnelCooldown:0}}
function rng(seed){let s=seed>>>0;return ()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296}}
export function makeSimulation(seed=82419){
 const random=rng(seed), balls=[], droplets=[];
 const sim={balls,droplets,now:0,steps:0,lastContacts:0,spawned:0,particlesCreated:0,options:{flow:0.7,capacity:90,speed:1,water:true,particles:true,spray:100},accSpawn:0};
 const fresh=(b,initial=false)=>{b.x=-4.45+(random()-.5)*.19;b.y=7.43+random()*.12;b.z=-.85+(random()-.5)*.14;
   b.vx=.22+random()*.16;b.vy=0;b.vz=0;b.px=b.x;b.py=b.y;b.pz=b.z;b.age=0;b.water=false;b.mode='free';b.funnelCooldown=0;
   if(initial){b.color=Math.floor(random()*COLORS.length);sim.spawned++}
 };
 sim.add=(n=1)=>{let added=0;for(let i=0;i<n&&balls.length<sim.options.capacity;i++){
   const b=point(0,0,0);fresh(b,true);b.y+=Math.min(i,7)*.085;balls.push(b);added++;
 }return added;};
 sim.reset=()=>{balls.length=0;droplets.length=0;sim.now=0;sim.steps=0;sim.accSpawn=0;sim.spawned=0;sim.splashes=0;sim.particleAccumulator=0;sim.add(8);};
 sim.reset();
 function trackContact(b){for(const [a,c,width] of TRACKS){const dx=c[0]-a[0],dz=c[2]-a[2],den=dx*dx+dz*dz;
   const t=clamp(((b.x-a[0])*dx+(b.z-a[2])*dz)/(den||1),0,1);
   const x=a[0]+t*dx,z=a[2]+t*dz,y=a[1]+(c[1]-a[1])*t;
   const lateral=Math.hypot(b.x-x,b.z-z);
   if(lateral>width*.50+b.r||b.y-b.r>y+.18||b.y+b.r<y-.24)continue;
   b.y=Math.max(b.y,y+b.r);
   const tx=dx,ty=c[1]-a[1],tz=dz,L=Math.hypot(tx,ty,tz)||1;
   const ux=tx/L,uy=ty/L,uz=tz/L;
   // Project gravity onto track tangent; normal contact removes downward velocity.
   const along=b.vx*ux+b.vy*uy+b.vz*uz;
   const newAlong=along-G*uy*DT;
   b.vx+=(newAlong-along)*ux;b.vy+=(newAlong-along)*uy;b.vz+=(newAlong-along)*uz;
   if(b.vy<0)b.vy=Math.max(b.vy,uy*newAlong);
   // Low-frequency guide force: keeps marbles in a physical-looking open trough.
   b.vx+=(x-b.x)*DT*12;b.vz+=(z-b.z)*DT*12;
   b.vx*=.998;b.vz*=.998;b.mode='track';sim.lastContacts++;
   break;
 }}
 function barContact(b,cx,cy,cz,angle,half,speed){
   // Segment in XY with round end caps; moving-segment velocity is angular.
   const ux=Math.cos(angle),uy=Math.sin(angle),dx=b.x-cx,dy=b.y-cy;
   const t=clamp(dx*ux+dy*uy,-half,half),qx=cx+t*ux,qy=cy+t*uy;
   const ex=b.x-qx,ey=b.y-qy,ez=b.z-cz;
   let d=Math.hypot(ex,ey,ez);const radius=b.r+.095;
   if(d>=radius)return;d=Math.max(d,1e-6);
   const nx=ex/d,ny=ey/d,nz=ez/d,penetration=radius-d;
   b.x+=nx*penetration;b.y+=ny*penetration;b.z+=nz*penetration;
   const surfaceVX=-speed*(qy-cy),surfaceVY=speed*(qx-cx);
   const vn=(b.vx-surfaceVX)*nx+(b.vy-surfaceVY)*ny+b.vz*nz;
   if(vn<0){const impulse=-Math.min(vn,-.001)*1.58;
     b.vx+=impulse*nx;b.vy+=impulse*ny;b.vz+=impulse*nz;
   }sim.lastContacts++;
 }
 function barriers(b){if(b.x<POOL.minX||b.x>POOL.maxX||b.y>1.9||b.y<-.22)return;
   if(b.z<POOL.minZ+b.r){b.z=POOL.minZ+b.r;b.vz=Math.abs(b.vz)*.3}
   if(b.z>POOL.maxZ-b.r){b.z=POOL.maxZ-b.r;b.vz=-Math.abs(b.vz)*.3}
 }
 function pairContacts(){const buckets=new Map();for(let i=0;i<balls.length;i++){
   const b=balls[i],key=`${Math.floor(b.x/CELL)},${Math.floor(b.y/CELL)},${Math.floor(b.z/CELL)}`;
   let arr=buckets.get(key);if(!arr){arr=[];buckets.set(key,arr)}arr.push(i);
 }
 for(let i=0;i<balls.length;i++){const b=balls[i],cx=Math.floor(b.x/CELL),cy=Math.floor(b.y/CELL),cz=Math.floor(b.z/CELL);
   for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
     const ids=buckets.get(`${cx+dx},${cy+dy},${cz+dz}`);if(!ids)continue;
     for(const j of ids){if(j<=i)continue;const c=balls[j];let x=c.x-b.x,y=c.y-b.y,z=c.z-b.z;
       let dist=Math.hypot(x,y,z);const min=b.r+c.r;if(dist>=min)continue;
       dist=Math.max(dist,1e-6);x/=dist;y/=dist;z/=dist;
       const push=(min-dist)*.5;b.x-=x*push;b.y-=y*push;b.z-=z*push;c.x+=x*push;c.y+=y*push;c.z+=z*push;
       const rel=(c.vx-b.vx)*x+(c.vy-b.vy)*y+(c.vz-b.vz)*z;
       if(rel<0){const imp=-rel*.67;b.vx-=imp*x;b.vy-=imp*y;b.vz-=imp*z;c.vx+=imp*x;c.vy+=imp*y;c.vz+=imp*z}
       sim.lastContacts++;
     }
   }
 }}
 function emit(){const o=sim.options;if(!o.particles||o.spray<=0){droplets.length=0;return;}
   const desired=Math.min(o.spray,400),rate=desired*DT*.9;
   sim.particleAccumulator=(sim.particleAccumulator||0)+rate;
   while(sim.particleAccumulator>=1&&droplets.length<desired){sim.particleAccumulator--;
     const a=random()*Math.PI*2,s=.25+random()*.7;
     droplets.push({x:-2.4,y:1.1,z:.92,vx:Math.cos(a)*s+1,vy:1.6+random()*2.1,vz:Math.sin(a)*.5,life:0,maxLife:.7+random()*.85,size:2+random()*3});
   }
   for(let i=droplets.length-1;i>=0;i--){const d=droplets[i];d.life+=DT;
     d.vy-=7*DT;d.x+=d.vx*DT;d.y+=d.vy*DT;d.z+=d.vz*DT;
     if(d.life>d.maxLife||d.y<POOL.level){droplets[i]=droplets[droplets.length-1];droplets.pop()}
   }
 }
 sim.step=()=>{
   const o=sim.options;sim.now+=DT;sim.steps++;sim.lastContacts=0;sim.accSpawn+=o.flow*DT;
   while(sim.accSpawn>=1){sim.accSpawn--;sim.add(1)}
   // Enforce capacity without unbounded growth when the slider is reduced.
   if(balls.length>o.capacity)balls.splice(0,balls.length-o.capacity);
   const wheelAngle=sim.now*.95,switchAngle=Math.sin(sim.now*1.3)*.29;
   for(const b of balls){b.px=b.x;b.py=b.y;b.pz=b.z;b.age+=DT;b.funnelCooldown=Math.max(0,b.funnelCooldown-DT);b.mode='free';
     b.vy-=G*DT;
     const inWater=o.water&&b.x>POOL.minX&&b.x<POOL.maxX&&b.z>POOL.minZ&&b.z<POOL.maxZ&&b.y<POOL.level+b.r&&b.y>-.28;
     if(inWater){if(!b.water&&o.particles&&o.spray>0){
       for(let i=0;i<4&&droplets.length<Math.min(400,o.spray);i++){
         const a=random()*Math.PI*2,impulse=.35+Math.min(Math.abs(b.vy),3)*.20;
         droplets.push({x:b.x,y:POOL.level+.02,z:b.z,vx:Math.cos(a)*impulse+.40,
           vy:.65+random()*1.25,vz:Math.sin(a)*impulse,life:0,maxLife:.4+random()*.55,size:2+random()*2});
       }sim.splashes=(sim.splashes||0)+1;
     }const immersion=clamp((POOL.level-(b.y-b.r))/(2*b.r),0,1);
       b.vy+=G*1.9*immersion*DT;b.vy*=1-.85*DT;b.vx+=(1.18-b.vx)*1.7*DT;b.vz+=(-.02-b.vz)*1.5*DT;
       b.water=true;b.mode='water';
     }else{b.water=false;b.vx*=.9994;b.vy*=.9994;b.vz*=.9994}
     b.x+=b.vx*DT;b.y+=b.vy*DT;b.z+=b.vz*DT;
     trackContact(b);barriers(b);
     // Vortex funnel: circular containment and spiral guide, with a hidden exit chute.
     const fx=b.x-3.50,fz=b.z+.83,fd=Math.hypot(fx,fz);
     if(b.funnelCooldown===0&&b.y>3.80&&b.y<5.85&&b.x>2.65&&b.x<4.62){
       if(fd>.80){const nx=fx/Math.max(fd,1e-6),nz=fz/Math.max(fd,1e-6);
         b.x=3.50+nx*.80;b.z=-.83+nz*.80;
         const outward=b.vx*nx+b.vz*nz;if(outward>0){b.vx-=outward*1.28*nx;b.vz-=outward*1.28*nz}
       }
       b.vx+=(-fz*.9-fx*1.6)*DT;b.vz+=(fx*.9-fz*1.6)*DT;
       if(b.y<4.57){b.x=3.08;b.y=4.39;b.z=-.8;b.px=b.x;b.py=b.y;b.pz=b.z;b.vx=-.95;b.vy=0;b.vz=0;b.funnelCooldown=1.8;}
     }
     for(let i=0;i<4;i++)barContact(b,WHEEL.x,WHEEL.y,WHEEL.z,wheelAngle+i*Math.PI/2,WHEEL.r,.95);
     barContact(b,SWITCH.x,SWITCH.y,SWITCH.z,switchAngle,SWITCH.length,Math.cos(sim.now*1.3)*.377);
     if(!Number.isFinite(b.x+b.y+b.z)||b.y<-1.6||b.x>5.5||b.x< -6.3||b.age>55)fresh(b);
   }
   pairContacts();emit();
 };
 sim.snapshot=()=>({balls:balls.length,steps:sim.steps,contacts:sim.lastContacts,droplets:droplets.length,splashes:sim.splashes});
 return sim;
}
export const FIXED_STEP=DT;
