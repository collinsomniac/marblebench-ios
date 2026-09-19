import test from 'node:test';
import RAPIER from '@dimforge/rapier3d-compat';
import {VORTEX_PROFILE as P,createVortexGeometry,vortexHeight} from '../src/vortex-profile.js';
await RAPIER.init();
const dt=1/120,radius=.17,TAU=Math.PI*2;
function trial({angle=0,speed=2.5,guard=true,flags=true,friction=.12}={}){
 const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=dt;
 const mesh=createVortexGeometry({x:0,z:0});
 const faces=guard?mesh.indices:mesh.indices.slice(0,mesh.bowlTriangles*3);
 const triFlags=flags?(RAPIER.TriMeshFlags?.FIX_INTERNAL_EDGES??0):0;
 world.createCollider(RAPIER.ColliderDesc.trimesh(mesh.vertices,faces,triFlags).setFriction(friction).setRestitution(.035));
 const r=1.16;const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(r*Math.cos(angle),vortexHeight(r)+radius+.025,r*Math.sin(angle)).setLinearDamping(.008).setAngularDamping(.02).setCcdEnabled(true));
 world.createCollider(RAPIER.ColliderDesc.ball(radius).setDensity(.72).setFriction(.42).setRestitution(.08),body);
 let previous=Math.atan2(body.translation().z,body.translation().x),sweep=0,minR=Infinity,maxR=0,exit=false,escape=false,stopped=false;
 const samples=[];
 body.setLinvel({x:-Math.sin(angle)*speed,y:0,z:Math.cos(angle)*speed},true);
 for(let i=0;i<2400;i++){
  world.step();const p=body.translation(),v=body.linvel(),d=Math.hypot(p.x,p.z),a=Math.atan2(p.z,p.x);
  if(d<P.outer+.2)sweep+=Math.atan2(Math.sin(a-previous),Math.cos(a-previous));previous=a;
  minR=Math.min(minR,d);maxR=Math.max(maxR,d);
  if(p.y<P.throatY-.23&&d<P.inner+.22){exit=true;break;}
  if(d>P.outer+1||p.y<1){escape=true;break;}
  if(i>400&&body.isSleeping()){stopped=true;break;}
  if(i%240===0)samples.push({s:+((i+1)*dt).toFixed(1),r:+d.toFixed(2),y:+p.y.toFixed(2),speed:+Math.hypot(v.x,v.y,v.z).toFixed(2)});
 }
 const result={angle:+angle.toFixed(2),speed,guard,flags,friction,orbits:+(Math.abs(sweep)/TAU).toFixed(2),minR:+minR.toFixed(2),maxR:+maxR.toFixed(2),exit,escape,stopped,samples};world.free();return result;
}
test('isolate axisymmetric bowl contacts independently of the whole marble machine',()=>{
 const results=[trial(),trial({guard:false}),trial({angle:Math.PI,speed:2.5}),trial({angle:Math.PI,speed:1.3}),trial({angle:Math.PI,speed:2.5,flags:false}),trial({angle:Math.PI,speed:2.5,friction:.02})];
 console.log('ISOLATED_VORTEX '+JSON.stringify(results));
});
