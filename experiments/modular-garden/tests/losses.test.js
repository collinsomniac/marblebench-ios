import test from 'node:test';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {GardenSimulation} from '../src/physics.js';
await RAPIER.init();
test('diagnose physical course losses without teleporting bodies',()=>{
 const sim=new GardenSimulation(RAPIER,new THREE.Scene());sim.options.flow=.45;sim.options.capacity=42;
 const lost=[],samples=[];
 for(let step=0;step<6000;step++){
  const before=new Map(sim.balls.map(b=>[b.id,{p:b.body.translation(),v:b.body.linvel()}]));
  sim.step();
  const after=new Set(sim.balls.map(b=>b.id));
  for(const [id,prior] of before)if(!after.has(id)&&lost.length<15)lost.push({id,time:Number(sim.time.toFixed(2)),...prior});
  if(step%1200===0)samples.push({sec:Math.round(sim.time),balls:sim.balls.length,losses:sim.losses});
 }
 console.log(JSON.stringify({lost,samples}));
 sim.dispose();
});
