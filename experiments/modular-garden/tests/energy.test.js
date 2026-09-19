import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {GardenSimulation} from '../src/physics.js';
await RAPIER.init();
test('sustained simulation has bounded speed and actual water interactions',()=>{
  const sim=new GardenSimulation(RAPIER,new THREE.Scene());
  sim.options.flow=.45;sim.options.capacity=42;
  let peak=0,peakHeight=-Infinity,first=null;
  for(let step=0;step<6000;step++){
    sim.step();
    for(const b of sim.balls){
      const p=b.body.translation(),v=b.body.linvel(),speed=Math.hypot(v.x,v.y,v.z);
      if(speed>peak)peak=speed;
      if(p.y>peakHeight)peakHeight=p.y;
      if(!first&&(speed>=20||p.y>12||!Number.isFinite(speed+p.y))) first={step,id:b.id,p,v,speed};
    }
    if(first)break;
  }
  console.log(JSON.stringify({first,peak,peakHeight,waterImpacts:sim.waterImpacts,losses:sim.losses}));
  assert.equal(first,null,'marbles must not gain unbounded energy or escape vertically');
  assert.ok(peak<20,`peak speed ${peak} m/s exceeds reference envelope`);
  assert.ok(peakHeight<12,`peak height ${peakHeight} m exceeds reference envelope`);
  assert.ok(sim.waterImpacts>0,'course must reach the water volume');
  sim.dispose();
});
