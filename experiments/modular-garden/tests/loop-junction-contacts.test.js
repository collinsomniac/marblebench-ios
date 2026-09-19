import test from 'node:test';
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import {GardenSimulation} from '../src/physics.js';
import {LOOP,MARBLE_RADIUS} from '../src/course.js';
import {loopCenterline,loopColliderGeometry,LOOP_CLEARANCE} from '../src/loop-geometry.js';
await RAPIER.init();
const round=n=>+n.toFixed(3);
function trial({depth=0,removeExit=false,removeEntry=false,speed=0}={}){
 const sim=new GardenSimulation(RAPIER,new THREE.Scene());sim.options.flow=0;
 // Stable verified static collider order: entry=8, ring=9, outlet=10.
 sim.world.removeCollider(sim.course.staticColliders[9],true);
 if(removeExit)sim.world.removeCollider(sim.course.staticColliders[10],true);
 if(removeEntry)sim.world.removeCollider(sim.course.staticColliders[8],true);
 const mesh=loopColliderGeometry(loopCenterline(LOOP,{...LOOP_CLEARANCE,returnDepth:depth}));
 sim.world.createCollider(RAPIER.ColliderDesc.trimesh(mesh.vertices,mesh.indices,RAPIER.TriMeshFlags?.FIX_INTERNAL_EDGES??0).setFriction(.13).setRestitution(.08));
 const apexCenter=LOOP.y+LOOP.radius-MARBLE_RADIUS;
 let entered=false,apex=false,maxY=-Infinity,afterApexBottom=false,loss=false,bodyFinal=null;
 for(let i=0;i<5200;i++){
  sim.step();const b=sim.balls[0];if(!b){loss=true;break;}
  const p=b.body.translation(),v=b.body.linvel();
  if(!entered&&sim.time>10&&p.x>-3.92&&p.x<-3.6&&p.y<2.1){entered=true;if(speed)b.body.setLinvel({x:speed,y:0,z:0},true);}
  if(entered){
   if(p.x>LOOP.x-LOOP.radius-.35&&p.x<LOOP.x+LOOP.radius+.35)maxY=Math.max(maxY,p.y);
   if(p.y>apexCenter-.055&&Math.abs(p.x-LOOP.x)<.25)apex=true;
   if(apex&&p.y<LOOP.y-LOOP.radius+MARBLE_RADIUS+.16)afterApexBottom=true;
   if(afterApexBottom||b.body.isSleeping()){
    bodyFinal={p,speed:Math.hypot(v.x,v.y,v.z),sleep:b.body.isSleeping()};break;
   }
  }
 }
 const result={depth,removeExit,removeEntry,speed,entered,apex,afterApexBottom,maxY:round(maxY),loss,bodyFinal,water:sim.waterImpacts,losses:sim.losses};sim.dispose();return result;
}
test('determine which adjoining physical rail prevents ring entry and complete loop',()=>{
 const variants=[trial({depth:0,speed:7}),trial({depth:0,speed:7,removeExit:true}),trial({depth:0,speed:7,removeEntry:true}),trial({depth:1.15,speed:7,removeExit:true}),trial({depth:0,removeExit:true})];
 console.log('LOOP_JUNCTION_CONTACTS '+JSON.stringify(variants));
});
