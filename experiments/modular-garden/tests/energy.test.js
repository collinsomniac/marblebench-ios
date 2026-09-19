import test from 'node:test';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {GardenSimulation} from '../src/physics.js';
await RAPIER.init();
test('trace earliest explosive energy event including moving machinery',()=>{
  const sim=new GardenSimulation(RAPIER,new THREE.Scene());
  sim.options.flow=.45;sim.options.capacity=42;
  let prev=new Map(),peak=0,first=null;
  for(let step=0;step<6000;step++){
    for(const b of sim.balls)prev.set(b.id,{p:b.body.translation(),v:b.body.linvel()});
    sim.step();
    for(const b of sim.balls){
      const p=b.body.translation(),v=b.body.linvel(),speed=Math.hypot(v.x,v.y,v.z);
      if(speed>peak)peak=speed;
      if(!first&&speed>24){
        first={t:sim.time,step,id:b.id,p,v,speed,prior:prev.get(b.id),pad:{p:sim.pad.translation(),v:sim.pad.linvel()},shelf:{p:sim.shelf.translation(),v:sim.shelf.linvel()},gate:{p:sim.gate.translation(),v:sim.gate.linvel()}};
      }
    }
    if(first&&step>first.step+4)break;
  }
  console.log(JSON.stringify({first,peak,waterImpacts:sim.waterImpacts,losses:sim.losses}));
  sim.dispose();
});
