import test from 'node:test';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {GardenSimulation} from '../src/physics.js';
await RAPIER.init();
test('diagnose actual contact movement at first descent junction',()=>{
  const sim=new GardenSimulation(RAPIER,new THREE.Scene());
  sim.options.flow=0;
  for(let i=0;i<1440;i++){
    sim.step();
    if([180,360,720,1080,1439].includes(i))console.log(JSON.stringify({seconds:(i+1)/120,balls:sim.balls.slice(0,6).map(b=>({id:b.id,p:b.body.translation(),v:b.body.linvel(),sleep:b.body.isSleeping()}))}));
  }
  sim.dispose();
});
