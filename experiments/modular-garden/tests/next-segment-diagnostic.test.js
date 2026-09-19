import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {GardenSimulation} from '../src/physics.js';
import {LOOP,LIFT} from '../src/course.js';
await RAPIER.init();

test('lead marble reaches the loop entrance and logs later unproven mechanisms',()=>{
 const sim=new GardenSimulation(RAPIER,new THREE.Scene());sim.options.flow=0;
 const event={enteredFunnel:null,passedOldJunction:null,roundedHairpin:null,loopEntry:null,loopApex:null,loopExit:null,padNearby:null,pool:null,return:null,lift:null};
 const samples=[];let minX=Infinity,minZ=Infinity,maxZ=-Infinity,topAfterEntry=-Infinity;
 for(let i=0;i<10800;i++){
  sim.step();const ball=sim.balls[0];if(!ball)break;
  const p=ball.body.translation(),v=ball.body.linvel(),speed=Math.hypot(v.x,v.y,v.z);
  minX=Math.min(minX,p.x);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);
  if(!event.enteredFunnel&&Math.hypot(p.x-2.60,p.z+.88)<1.36&&p.y<4.7&&p.y>3.8)event.enteredFunnel={t:sim.time,p};
  if(!event.passedOldJunction&&sim.time>8&&p.x<-2.55&&p.y<3.2)event.passedOldJunction={t:sim.time,p};
  if(!event.roundedHairpin&&event.passedOldJunction&&p.x<-4.5&&p.y<3.1)event.roundedHairpin={t:sim.time,p};
  if(!event.loopEntry&&sim.time>8&&Math.hypot(p.x+3.62,p.y-1.54,p.z+.88)<.5)event.loopEntry={t:sim.time,p};
  if(event.loopEntry)topAfterEntry=Math.max(topAfterEntry,p.y);
  if(!event.loopApex&&event.loopEntry&&Math.hypot(p.x-LOOP.x,p.z-LOOP.z)<.48&&p.y>LOOP.y+LOOP.radius-.17)event.loopApex={t:sim.time,p};
  if(!event.loopExit&&event.loopApex&&p.x>-1.72&&p.y<1.9)event.loopExit={t:sim.time,p};
  if(!event.padNearby&&p.x>-.04&&p.x<1&&p.y>.55&&p.y<1.5)event.padNearby={t:sim.time,p};
  if(!event.pool&&p.x>3.1&&p.x<6.4&&p.y<1.05)event.pool={t:sim.time,p};
  if(!event.return&&p.x<1&&p.y<.2&&p.y>-.9)event.return={t:sim.time,p};
  if(!event.lift&&sim.time>8&&Math.abs(p.x-LIFT.x)<.65&&p.y>-.9&&p.y<7.7)event.lift={t:sim.time,p};
  if(i%1200===0)samples.push({t:+sim.time.toFixed(1),p:{x:+p.x.toFixed(2),y:+p.y.toFixed(2),z:+p.z.toFixed(2)},speed:+speed.toFixed(2),sleep:ball.body.isSleeping()});
 }
 const b=sim.balls[0];console.log('NEXT_SEGMENT '+JSON.stringify({event,minX,minZ,maxZ,topAfterEntry,losses:sim.losses,samples,final:b?{p:b.body.translation(),v:b.body.linvel(),sleep:b.body.isSleeping()}:null}));
 sim.dispose();
 assert.ok(event.roundedHairpin,'lead marble must physically negotiate downhill U-turn');
 assert.ok(event.loopEntry&&event.loopEntry.t<18,'lead marble must reach the loop entrance by 18 simulated seconds');
 // Do not claim loop completion, rebound, or recirculation until separate trajectory/contact gates exist.
});
