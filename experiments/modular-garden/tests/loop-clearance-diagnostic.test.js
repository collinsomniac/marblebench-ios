import test from 'node:test';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {GardenSimulation} from '../src/physics.js';
import {LOOP} from '../src/course.js';
import {LOOP_CLEARANCE,loopCenterline,loopColliderGeometry} from '../src/loop-geometry.js';
await RAPIER.init();
function trial({depth=0,speed=0}={}){
 const sim=new GardenSimulation(RAPIER,new THREE.Scene());sim.options.flow=0;
 const old=sim.course.staticColliders[9];sim.world.removeCollider(old,true);
 const path=loopCenterline(LOOP,{...LOOP_CLEARANCE,returnDepth:depth});
 const mesh=loopColliderGeometry(path);
 sim.world.createCollider(RAPIER.ColliderDesc.trimesh(mesh.vertices,mesh.indices,RAPIER.TriMeshFlags?.FIX_INTERNAL_EDGES??0).setFriction(.13).setRestitution(.08));
 let entered=false,apex=false,exit=false,peak=-Infinity,nearBaseSpeed=0,minSpeed=Infinity,stopped=false;
 const samples=[];
 for(let i=0;i<4800;i++){
  sim.step();const b=sim.balls[0];if(!b)break;
  const p=b.body.translation(),v=b.body.linvel(),s=Math.hypot(v.x,v.y,v.z);
  if(!entered&&sim.time>11&&p.x>-3.92&&p.x<-3.60&&p.y<2.1){
   entered=true;if(speed)b.body.setLinvel({x:speed,y:0,z:0},true);
  }
  if(entered){
   if(Math.abs(p.x-LOOP.x)<LOOP.radius+.35&&Math.abs(p.z-LOOP.z)<1.7){
     peak=Math.max(peak,p.y);
     if(p.y>LOOP.y+LOOP.radius-.17)apex=true;
   }
   if(!nearBaseSpeed&&p.x>-3.1&&p.x<-2.95)nearBaseSpeed=s;
   minSpeed=Math.min(minSpeed,s);
   if(apex&&p.x>LOOP.x+.8&&p.y<LOOP.y+.35)exit=true;
   if(b.body.isSleeping())stopped=true;
   if(i%30===0&&samples.length<32)samples.push({t:+sim.time.toFixed(2),x:+p.x.toFixed(2),y:+p.y.toFixed(2),z:+p.z.toFixed(2),speed:+s.toFixed(2)});
   if(exit||stopped)break;
  }
 }
 const out={depth,speed,entered,apex,exit,peak,nearBaseSpeed,stopped,losses:sim.losses,samples};sim.dispose();return out;
}
test('physically segregate descending loop return from incoming lane without ghost forces',()=>{
 const variants=[trial({depth:0}),trial({depth:1.15}),trial({depth:1.15,speed:5.5}),trial({depth:1.15,speed:7})];
 console.log('LOOP_CLEARANCE_AB '+JSON.stringify(variants));
});
