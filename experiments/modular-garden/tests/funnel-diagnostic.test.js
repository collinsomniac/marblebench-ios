import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {GardenSimulation} from '../src/physics.js';
import {FUNNEL,MARBLE_RADIUS} from '../src/course.js';
await RAPIER.init();

test('funnel drains physically without accumulating a stalled crowd',()=>{
  const sim=new GardenSimulation(RAPIER,new THREE.Scene());
  const initialBodies=sim.balls.length;
  sim.options.flow=.48;sim.options.capacity=48;
  const records=new Map(),samples=[];
  let peakConcurrent=0,peakNearHole=0;
  for(let step=0;step<7200;step++){
    sim.step();let concurrent=0,nearHole=0;
    for(const ball of sim.balls){
      const p=ball.body.translation(),v=ball.body.linvel();
      const r=Math.hypot(p.x-FUNNEL.x,p.z-FUNNEL.z);
      const onBowl=r<FUNNEL.outer+MARBLE_RADIUS&&p.y>FUNNEL.y-.02&&p.y<FUNNEL.y+.95;
      const atThroat=r<FUNNEL.inner+MARBLE_RADIUS*.7&&p.y>FUNNEL.y-.04&&p.y<FUNNEL.y+.35;
      const exited=p.y<FUNNEL.y-.35&&r<.85;
      let row=records.get(ball.id);
      if(!row){row={id:ball.id,entered:null,throat:null,exited:null,secondsInBowl:0,minSpeed:Infinity};records.set(ball.id,row)}
      if(onBowl){concurrent++;row.entered??=sim.time;row.secondsInBowl+=1/120;row.minSpeed=Math.min(row.minSpeed,Math.hypot(v.x,v.y,v.z))}
      if(atThroat){nearHole++;row.throat??=sim.time}
      if(exited&&row.entered!==null)row.exited??=sim.time;
    }
    peakConcurrent=Math.max(peakConcurrent,concurrent);peakNearHole=Math.max(peakNearHole,nearHole);
    if(step%1200===0)samples.push({second:+sim.time.toFixed(1),concurrent,nearHole,balls:sim.balls.length,losses:sim.losses});
  }
  const entered=[...records.values()].filter(r=>r.entered!==null);
  const exited=entered.filter(r=>r.exited!==null);
  const residence=entered.map(r=>r.secondsInBowl).sort((a,b)=>a-b);
  const medianResidence=residence[Math.floor(residence.length/2)]??Infinity;
  console.log('FUNNEL_THROUGHPUT '+JSON.stringify({initialBodies,openingDiameterRatio:+(FUNNEL.inner/MARBLE_RADIUS).toFixed(2),entered:entered.length,exited:exited.length,peakConcurrent,peakNearHole,medianResidence,samples}));
  assert.equal(initialBodies,1,'startup must not release a six-marble burst');
  assert.ok(exited.length>=8,'funnel must exhibit sustained physical discharge');
  assert.ok(peakConcurrent<=8,'funnel must not accumulate a large crowd');
  assert.ok(medianResidence<3,'funnel dwell must stay bounded');
  sim.dispose();
});
