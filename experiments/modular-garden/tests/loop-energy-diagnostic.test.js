import test from 'node:test';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {GardenSimulation} from '../src/physics.js';
import {LOOP,MARBLE_RADIUS} from '../src/course.js';
await RAPIER.init();
test('quantify real loop-entry kinetic energy rather than assuming entry proximity equals completion',()=>{
 const sim=new GardenSimulation(RAPIER,new THREE.Scene());sim.options.flow=0;
 const target={x:-3.62,y:LOOP.y-LOOP.radius,z:LOOP.z};
 let atEntry=null,atBase=null,peakY=-Infinity,stoppedAt=null;
 const samples=[];
 for(let i=0;i<3600;i++){
  sim.step();const b=sim.balls[0];if(!b)break;
  const p=b.body.translation(),v=b.body.linvel();const speed=Math.hypot(v.x,v.y,v.z);
  if(!atEntry&&p.x<-3.5&&p.x>-4.0&&p.y<2.2&&sim.time>8)atEntry={t:sim.time,p,speed,v};
  if(!atBase&&p.x>-3.05&&p.x<-2.7&&p.y<1.95&&sim.time>8)atBase={t:sim.time,p,speed,v};
  if(atEntry){peakY=Math.max(peakY,p.y);if(!stoppedAt&&b.body.isSleeping())stoppedAt={t:sim.time,p};}
  if(atEntry&&i%60===0&&samples.length<50)samples.push({t:+sim.time.toFixed(2),x:+p.x.toFixed(2),y:+p.y.toFixed(2),z:+p.z.toFixed(2),speed:+speed.toFixed(2)});
 }
 const effectiveR=LOOP.radius-MARBLE_RADIUS;
 const idealPointMassSpeed=Math.sqrt(5*9.81*effectiveR);
 const result={loop:LOOP,effectiveRadius:effectiveR,idealPointMassSpeed,atEntry,atBase,peakY,stoppedAt,samples};
 console.log('LOOP_ENERGY '+JSON.stringify(result));sim.dispose();
});
