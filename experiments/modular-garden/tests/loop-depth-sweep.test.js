import test from 'node:test';
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import {GardenSimulation} from '../src/physics.js';
import {LOOP,MARBLE_RADIUS} from '../src/course.js';
import {loopCenterline,loopColliderGeometry,LOOP_CLEARANCE} from '../src/loop-geometry.js';
await RAPIER.init();
const apexY=LOOP.y+LOOP.radius-MARBLE_RADIUS;
function run(depth,speed){
 const sim=new GardenSimulation(RAPIER,new THREE.Scene());sim.options.flow=0;
 sim.world.removeCollider(sim.course.staticColliders[9],true);
 const geo=loopColliderGeometry(loopCenterline(LOOP,{...LOOP_CLEARANCE,returnDepth:depth}));
 sim.world.createCollider(RAPIER.ColliderDesc.trimesh(geo.vertices,geo.indices,RAPIER.TriMeshFlags?.FIX_INTERNAL_EDGES??0).setFriction(.13).setRestitution(.08));
 let injected=false,peak=0,apex=false,bottomAgain=false,water=false,lost=false,stopped=false,nearest=Infinity;
 for(let i=0;i<4100;i++){
  sim.step();const ball=sim.balls[0];if(!ball){lost=true;break;}
  const p=ball.body.translation();
  if(!injected&&sim.time>10&&p.x>-3.92&&p.x<-3.60&&p.y<2.1){injected=true;if(speed)ball.body.setLinvel({x:speed,y:0,z:0},true);}
  if(injected){
   if(Math.abs(p.x-LOOP.x)<LOOP.radius+.36&&Math.abs(p.z-LOOP.z)<depth+1){peak=Math.max(peak,p.y);nearest=Math.min(nearest,Math.hypot(p.x-LOOP.x,p.y-apexY));}
   if(Math.abs(p.x-LOOP.x)<.25&&p.y>apexY-.055)apex=true;
   if(apex&&p.y<LOOP.y-LOOP.radius+MARBLE_RADIUS+.15)bottomAgain=true;
   if(sim.waterImpacts)water=true;
   if(ball.body.isSleeping()){stopped=true;break;}
   if(bottomAgain||water)break;
  }
 }
 const result={depth,speed,entered:injected,peak:+peak.toFixed(3),nearTop:+nearest.toFixed(3),apex,bottomAgain,water,stopped,lost};sim.dispose();return result;
}
test('measure entry clearance versus loss of ring contact for several offsets',()=>{
 const results=[];for(const depth of [0,.22,.38,.55,.72,.95,1.15])for(const speed of [0,7])results.push(run(depth,speed));
 console.log('LOOP_DEPTH_SWEEP '+JSON.stringify(results));
});
