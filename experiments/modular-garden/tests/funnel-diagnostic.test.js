import test from 'node:test';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {GardenSimulation} from '../src/physics.js';
import {FUNNEL,MARBLE_RADIUS} from '../src/course.js';
await RAPIER.init();

test('diagnose per-entity funnel residence and exit rather than proximity counts',()=>{
  const sim=new GardenSimulation(RAPIER,new THREE.Scene());
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
      if(!row){row={id:ball.id,entered:null,throat:null,exited:null,secondsInBowl:0,minRadius:Infinity,minSpeed:Infinity};records.set(ball.id,row)}
      if(onBowl){concurrent++;row.entered??=sim.time;row.secondsInBowl+=1/120;row.minRadius=Math.min(row.minRadius,r);row.minSpeed=Math.min(row.minSpeed,Math.hypot(v.x,v.y,v.z))}
      if(atThroat){nearHole++;row.throat??=sim.time}
      if(exited&&row.entered!==null)row.exited??=sim.time;
    }
    peakConcurrent=Math.max(peakConcurrent,concurrent);peakNearHole=Math.max(peakNearHole,nearHole);
    if(step%1200===0)samples.push({second:+sim.time.toFixed(1),concurrent,nearHole,balls:sim.balls.length,losses:sim.losses});
  }
  const entered=[...records.values()].filter(r=>r.entered!==null);
  const exited=entered.filter(r=>r.exited!==null);
  const stalled=entered.filter(r=>r.exited===null).sort((a,b)=>b.secondsInBowl-a.secondsInBowl).slice(0,8);
  console.log('FUNNEL_DIAGNOSTIC '+JSON.stringify({initialBodies:6,openingDiameterRatio:+(2*FUNNEL.inner/(2*MARBLE_RADIUS)).toFixed(2),entered:entered.length,exited:exited.length,peakConcurrent,peakNearHole,medianResidence:entered.map(r=>r.secondsInBowl).sort((a,b)=>a-b)[Math.floor(entered.length/2)]??null,firstSix:records.size?[...records.values()].slice(0,6):[],stalled,samples}));
  sim.dispose();
});
