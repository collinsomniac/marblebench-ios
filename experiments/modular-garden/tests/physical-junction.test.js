import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {GardenSimulation} from '../src/physics.js';
await RAPIER.init();

test('lead marble passes post-funnel/loop intersection with loop collider intact',()=>{
  const sim=new GardenSimulation(RAPIER,new THREE.Scene());sim.options.flow=0;
  let junction=null,passed=null,stillMovingAt12=false;
  for(let step=0;step<1920;step++){
    sim.step();const ball=sim.balls[0];if(!ball)break;
    const p=ball.body.translation();
    if(!junction&&sim.time>8&&p.x<-1.6&&p.y<3.2)junction={t:sim.time,p};
    if(!passed&&junction&&p.x<-2.55&&p.y<3.2)passed={t:sim.time,p};
    if(step===1439)stillMovingAt12=!ball.body.isSleeping();
  }
  console.log('JUNCTION_TRAVERSAL '+JSON.stringify({junction,passed,stillMovingAt12,losses:sim.losses}));
  assert.ok(junction,'marble must reach the intersection');
  assert.ok(passed&&passed.t-junction.t<3,'marble must travel across the intersection, not stop at the loop collider');
  assert.ok(stillMovingAt12,'lead marble must remain active past former permanent stall');
  sim.dispose();
});
