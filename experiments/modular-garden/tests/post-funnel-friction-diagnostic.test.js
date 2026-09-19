import test from 'node:test';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {GardenSimulation} from '../src/physics.js';
await RAPIER.init();

function trial(polished){
  const sim=new GardenSimulation(RAPIER,new THREE.Scene());
  sim.options.flow=0;
  // Collider 7 is the post-funnel rail in the current buildCourse order:
  // exit rail, S-bend, annular funnel, catch floor, three catch walls, exit rail.
  const rail=sim.course.staticColliders[7];
  if(polished)rail.setFriction(.014);
  let furthestAfterFunnel=Infinity,closestToLoop=Infinity,nearLoop=0,maxSpeed=0;
  const frames=[];
  for(let i=0;i<3600;i++){
    sim.step();const b=sim.balls[0];if(!b)break;
    const p=b.body.translation(),v=b.body.linvel();
    if(sim.time>8){furthestAfterFunnel=Math.min(furthestAfterFunnel,p.x);closestToLoop=Math.min(closestToLoop,Math.hypot(p.x+2.57,p.y-2.23));}
    if(Math.hypot(p.x+2.57,p.y-2.23)<1.0)nearLoop++;
    maxSpeed=Math.max(maxSpeed,Math.hypot(v.x,v.y,v.z));
    if(i%600===0)frames.push({t:+sim.time.toFixed(1),p:{x:+p.x.toFixed(2),y:+p.y.toFixed(2),z:+p.z.toFixed(2)},speed:+Math.hypot(v.x,v.y,v.z).toFixed(2),sleep:b.body.isSleeping()});
  }
  const result={friction:rail.friction(),furthestAfterFunnel,closestToLoop,nearLoop,maxSpeed,losses:sim.losses,frames};
  sim.dispose();return result;
}
test('diagnose whether polished post-funnel rail fixes static-friction stalls',()=>{
  const baseline=trial(false),polished=trial(true);
  console.log('POST_FUNNEL_AB '+JSON.stringify({baseline,polished}));
});
