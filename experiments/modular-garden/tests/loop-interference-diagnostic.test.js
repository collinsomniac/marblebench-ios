import test from 'node:test';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {GardenSimulation} from '../src/physics.js';
await RAPIER.init();
function trial(label,disabled=[]){
 const sim=new GardenSimulation(RAPIER,new THREE.Scene());sim.options.flow=0;
 // Course indices: 0 exit, 1 bend, 2 funnel, 3 catch-floor, 4-6 catch walls,
 // 7 post-funnel, 8 loop-entry, 9 loop. These indices are diagnostic only.
 for(const index of disabled)sim.world.removeCollider(sim.course.staticColliders[index],true);
 let minX=Infinity,minY=Infinity,atJunction=null,afterJunction=null,nearLoop=0;
 for(let i=0;i<3600;i++){
  sim.step();const b=sim.balls[0];if(!b)break;
  const p=b.body.translation();minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);
  if(!atJunction&&p.x<-1.6&&p.y<3.2)atJunction={time:sim.time,p};
  if(!afterJunction&&p.x<-2.55&&p.y<3.2)afterJunction={time:sim.time,p};
  if(Math.hypot(p.x+2.57,p.y-2.23)<1)nearLoop++;
 }
 const b=sim.balls[0];const result={label,minX,minY,atJunction,afterJunction,nearLoop,final:b?{p:b.body.translation(),v:b.body.linvel(),sleep:b.body.isSleeping()}:null,losses:sim.losses};sim.dispose();return result;
}
test('diagnose post-funnel crossing against loop and loop-entry collider geometry',()=>{
 const baseline=trial('all colliders'),withoutLoop=trial('without loop',[9]),withoutEntry=trial('without loop entry',[8]),withoutBoth=trial('without both',[8,9]);
 console.log('LOOP_OVERLAP_AB '+JSON.stringify({baseline,withoutLoop,withoutEntry,withoutBoth}));
});
