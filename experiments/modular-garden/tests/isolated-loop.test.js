import test from 'node:test';
import RAPIER from '@dimforge/rapier3d-compat';
import {LOOP,MARBLE_RADIUS as r} from '../src/course.js';
import {loopCenterline,loopColliderGeometry,LOOP_CLEARANCE} from '../src/loop-geometry.js';
await RAPIER.init();
const dt=1/120,g=9.81;
function isolated({speed,depth=0,friction=.13,velocityY=0}={}){
 const world=new RAPIER.World({x:0,y:-g,z:0});world.timestep=dt;
 const points=loopCenterline(LOOP,{...LOOP_CLEARANCE,returnDepth:depth});const geometry=loopColliderGeometry(points);
 world.createCollider(RAPIER.ColliderDesc.trimesh(geometry.vertices,geometry.indices,RAPIER.TriMeshFlags?.FIX_INTERNAL_EDGES??0).setFriction(friction).setRestitution(.03));
 const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(LOOP.x,LOOP.y-LOOP.radius+r+.005,LOOP.z).setCcdEnabled(true).setLinearDamping(.008).setAngularDamping(.02));
 world.createCollider(RAPIER.ColliderDesc.ball(r).setDensity(.72).setFriction(.42).setRestitution(.08),body);
 body.setLinvel({x:speed,y:velocityY,z:0},true);
 let apex=false,peak=-Infinity,departed=false,angleSweep=0,prev=0,closestTop=Infinity;
 const samples=[];
 for(let i=0;i<720;i++){
  world.step();const p=body.translation(),v=body.linvel(),angle=Math.atan2(p.x-LOOP.x,LOOP.y-p.y);const unwrap=Math.atan2(Math.sin(angle-prev),Math.cos(angle-prev));angleSweep+=unwrap;prev=angle;
  if(Math.abs(p.x-LOOP.x)<LOOP.radius+.5&&Math.abs(p.z-LOOP.z)<depth+1){peak=Math.max(peak,p.y);closestTop=Math.min(closestTop,Math.hypot(p.x-LOOP.x,p.y-(LOOP.y+LOOP.radius)));}
  if(p.y>LOOP.y+LOOP.radius-.15&&Math.abs(p.x-LOOP.x)<.5)apex=true;
  if(apex&&p.x>LOOP.x+.85&&p.y<LOOP.y)departed=true;
  if(i%30===0&&samples.length<18)samples.push({t:+(i*dt).toFixed(2),x:+p.x.toFixed(2),y:+p.y.toFixed(2),z:+p.z.toFixed(2),speed:+Math.hypot(v.x,v.y,v.z).toFixed(2)});
  if(p.y<LOOP.y-LOOP.radius-1.8||Math.abs(p.x-LOOP.x)>LOOP.radius+3)break;
 }
 const out={speed,depth,friction,apex,departed,peak:+peak.toFixed(3),sweep:+(angleSweep/(2*Math.PI)).toFixed(2),closestTop:+closestTop.toFixed(3),samples};world.free();return out;
}
test('an isolated loop identifies whether contact mesh permits a complete revolution',()=>{
 const results=[isolated({speed:5.5}),isolated({speed:7}),isolated({speed:9}),isolated({speed:7,depth:1.15}),isolated({speed:9,depth:1.15}),isolated({speed:9,friction:.02})];
 console.log('ISOLATED_LOOP '+JSON.stringify(results));
});
