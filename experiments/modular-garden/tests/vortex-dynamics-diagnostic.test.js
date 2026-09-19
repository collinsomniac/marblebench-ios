import test from 'node:test';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {GardenSimulation} from '../src/physics.js';
import {FUNNEL} from '../src/course.js';
import {VORTEX_PROFILE as P,vortexHeight} from '../src/vortex-profile.js';
await RAPIER.init();
const round=n=>+n.toFixed(3);
function run(label,injected){
  const sim=new GardenSimulation(RAPIER,new THREE.Scene());sim.options.flow=0;
  const body=sim.balls[0].body;
  if(injected){const angle=P.inletAngle,r=1.17;
    body.setTranslation({x:FUNNEL.x+r*Math.cos(angle),y:vortexHeight(r)+.185,z:FUNNEL.z+r*Math.sin(angle)},true);
    body.setLinvel({x:-Math.sin(angle)*2.5,y:0,z:Math.cos(angle)*2.5},true);
    sim.balls[0].previous={...body.translation()};
  }
  let prev=null,sweep=0,minR=Infinity,maxR=0,minY=Infinity,maxY=-Infinity,entered=false,exited=false;
  const samples=[];
  for(let step=0;step<3600;step++){
    sim.step();const b=sim.balls[0];if(!b)break;const p=b.body.translation(),v=b.body.linvel();
    const r=Math.hypot(p.x-FUNNEL.x,p.z-FUNNEL.z),angle=Math.atan2(p.z-FUNNEL.z,p.x-FUNNEL.x);
    if(r<P.outer&&p.y<P.rimY+.40)entered=true;
    if(entered&&p.y<P.throatY-.18&&r<P.inner+.25)exited=true;
    if(prev!==null&&r<P.outer+.22){sweep+=Math.atan2(Math.sin(angle-prev),Math.cos(angle-prev));}
    prev=angle;minR=Math.min(minR,r);maxR=Math.max(maxR,r);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);
    if(step%24===0&&sim.time<13)samples.push({t:round(sim.time),x:round(p.x),y:round(p.y),z:round(p.z),r:round(r),speed:round(Math.hypot(v.x,v.y,v.z))});
  }
  const out={label,entered,exited,orbits:round(Math.abs(sweep)/(Math.PI*2)),minR:round(minR),maxR:round(maxR),minY:round(minY),maxY:round(maxY),losses:sim.losses,samples};sim.dispose();return out;
}
test('diagnose native course inlet against independent tangential coin-well release',()=>{
  console.log('VORTEX_DYNAMICS '+JSON.stringify([run('course-approach',false),run('injected-at-inner-rim',true)]));
});
