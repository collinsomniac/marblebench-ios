import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {GardenSimulation} from '../src/physics.js';
import {POOL,LOOP,LIFT,FUNNEL} from '../src/course.js';
await RAPIER.init();

test('sustained physical course reaches funnel, pool and return without runaway bodies',()=>{
  const sim=new GardenSimulation(RAPIER,new THREE.Scene());
  sim.options.flow=.45;sim.options.capacity=42;
  const stages={top:0,sBend:0,funnel:0,loopProximity:0,trampoline:0,water:0,return:0,lift:0};
  let largestSpeed=0,highest=-Infinity,lowest=Infinity;
  const reports=[];
  for(let i=0;i<6000;i++){
    sim.step();
    for(const ball of sim.balls){
      const p=ball.body.translation(),vel=ball.body.linvel();
      highest=Math.max(highest,p.y);lowest=Math.min(lowest,p.y);
      largestSpeed=Math.max(largestSpeed,Math.hypot(vel.x,vel.y,vel.z));
      if(p.y>6.6)stages.top++;
      if(p.y>4.8&&p.x>-4.4&&p.x<1.7)stages.sBend++;
      if(Math.hypot(p.x-FUNNEL.x,p.z-FUNNEL.z)<FUNNEL.outer&&p.y>3.6&&p.y<5.2)stages.funnel++;
      if(Math.hypot(p.x-LOOP.x,p.y-LOOP.y)<LOOP.radius+.5&&p.y<3.2)stages.loopProximity++;
      if(Math.abs(p.x-.48)<.9&&p.y>.2&&p.y<2.0)stages.trampoline++;
      if(p.x>POOL.minX&&p.x<POOL.maxX&&p.y<POOL.level+.5&&p.z>POOL.minZ&&p.z<POOL.maxZ)stages.water++;
      if(p.y<0&&p.x>-7&&p.x<7)stages.return++;
      if(Math.abs(p.x-LIFT.x)<.75&&p.y>-.7&&p.y<7.7)stages.lift++;
    }
    if((i+1)%1200===0)reports.push({seconds:(i+1)/120,active:sim.balls.length,losses:sim.losses,waterImpacts:sim.waterImpacts});
  }
  console.log(JSON.stringify({stages,largestSpeed,highest,lowest,reports}));
  for(const stage of ['top','sBend','funnel','water','return'])
    assert.ok(stages[stage]>0,`required stage ${stage} was never reached`);
  assert.ok(largestSpeed<20&&highest<12,'no runaway speed or unphysical height');
  assert.ok(sim.waterImpacts>0,'water must apply fluid forces to an entering marble');
  assert.ok(sim.balls.length<=sim.options.capacity,'capacity must remain bounded');
  // NOTE: Loop completion, trampoline success and elevator arrival remain unproven.
  // Their counters are reported, never misrepresented as passing physics coverage.
  sim.dispose();
});
