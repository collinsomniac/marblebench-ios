import test from 'node:test';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {GardenSimulation} from '../src/physics.js';
import {LOOP} from '../src/course.js';
await RAPIER.init();
function trial(speed,remove=[]){
 const sim=new GardenSimulation(RAPIER,new THREE.Scene());sim.options.flow=0;
 for(const idx of remove)sim.world.removeCollider(sim.course.staticColliders[idx],true);
 let injected=false,apex=false,exit=false,peak=-Infinity,first=null,last=null;
 const points=[];
 for(let i=0;i<3600;i++){
   sim.step();const b=sim.balls[0];if(!b)break;
   const p=b.body.translation(),v=b.body.linvel();
   if(!injected&&sim.time>11&&p.x>-3.92&&p.x<-3.60&&p.y<2.1){
     injected=true;first={t:sim.time,p,v};
     // Diagnostic-only energy injection at the existing physical handoff:
     // the production engine never assigns velocities to guide marbles.
     b.body.setLinvel({x:speed,y:0,z:0},true);
   }
   if(injected){
     if(Math.abs(p.x-LOOP.x)<LOOP.radius+.38&&Math.abs(p.z-LOOP.z)<.65){
       peak=Math.max(peak,p.y);
       if(p.y>LOOP.y+LOOP.radius-.18)apex=true;
     }
     if(apex&&p.x>LOOP.x+.83&&p.y<LOOP.y+.6)exit=true;
     if(i%20===0&&points.length<90)points.push({t:+sim.time.toFixed(2),x:+p.x.toFixed(2),y:+p.y.toFixed(2),z:+p.z.toFixed(2),v:+Math.hypot(v.x,v.y,v.z).toFixed(2)});
     last={p,speed:Math.hypot(v.x,v.y,v.z),sleep:b.body.isSleeping()};
     if(exit||b.body.isSleeping())break;
   }
 }
 const result={speed,removed:remove,first,injected,peak,apex,exit,last,points};sim.dispose();return result;
}
test('isolated energy sweep distinguishes inadequate speed from blocked ring collider',()=>{
 const result=[trial(3),trial(5),trial(7),trial(9),trial(7,[8]),trial(7,[9])];
 console.log('LOOP_SPEED_SWEEP '+JSON.stringify(result));
});
