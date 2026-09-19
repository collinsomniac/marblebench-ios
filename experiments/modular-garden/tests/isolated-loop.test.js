import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {LOOP,MARBLE_RADIUS as r} from '../src/course.js';
import {loopCenterline,loopColliderGeometry,LOOP_CLEARANCE} from '../src/loop-geometry.js';
await RAPIER.init();
const dt=1/120,g=9.81;
function isolated({speed,depth=0,friction=.13}={}){
 const world=new RAPIER.World({x:0,y:-g,z:0});world.timestep=dt;
 const points=loopCenterline(LOOP,{...LOOP_CLEARANCE,returnDepth:depth});const geometry=loopColliderGeometry(points);
 world.createCollider(RAPIER.ColliderDesc.trimesh(geometry.vertices,geometry.indices,RAPIER.TriMeshFlags?.FIX_INTERNAL_EDGES??0).setFriction(friction).setRestitution(.03));
 const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(LOOP.x,LOOP.y-LOOP.radius+r+.005,LOOP.z).setCcdEnabled(true).setLinearDamping(.008).setAngularDamping(.02));
 world.createCollider(RAPIER.ColliderDesc.ball(r).setDensity(.72).setFriction(.42).setRestitution(.08),body);
 body.setLinvel({x:speed,y:0,z:0},true);
 // For a sphere INSIDE the loop, its center is one sphere-radius below
 // the track at the apex. The old criterion mistakenly required penetration.
 const expectedApexCenterY=LOOP.y+LOOP.radius-r;
 let apex=false,peak=-Infinity,angularTravel=0,prev=0,closestTop=Infinity;
 let elapsed=0;const samples=[];
 for(let i=0;i<720;i++){
  world.step();elapsed=(i+1)*dt;const p=body.translation(),v=body.linvel(),angle=Math.atan2(p.x-LOOP.x,LOOP.y-p.y);
  angularTravel+=Math.atan2(Math.sin(angle-prev),Math.cos(angle-prev));prev=angle;
  if(Math.abs(p.x-LOOP.x)<LOOP.radius+.5&&Math.abs(p.z-LOOP.z)<depth+1){peak=Math.max(peak,p.y);closestTop=Math.min(closestTop,Math.hypot(p.x-LOOP.x,p.y-expectedApexCenterY));}
  if(p.y>=expectedApexCenterY-.055&&Math.abs(p.x-LOOP.x)<.25)apex=true;
  if(i%30===0&&samples.length<12)samples.push({t:+elapsed.toFixed(2),x:+p.x.toFixed(2),y:+p.y.toFixed(2),z:+p.z.toFixed(2),speed:+Math.hypot(v.x,v.y,v.z).toFixed(2)});
  if(p.y<LOOP.y-LOOP.radius-1.8||Math.abs(p.x-LOOP.x)>LOOP.radius+3)break;
 }
 const result={speed,depth,friction,apex,peak:+peak.toFixed(3),revolutions:+(angularTravel/(2*Math.PI)).toFixed(2),closestTop:+closestTop.toFixed(3),expectedApexCenterY:+expectedApexCenterY.toFixed(3),elapsed:+elapsed.toFixed(2),samples};world.free();return result;
}
test('isolated planar loop completes revolutions without scripted forces',()=>{
 const low=isolated({speed:5.5}),medium=isolated({speed:7}),high=isolated({speed:9}),depth=isolated({speed:7,depth:1.15});
 assert.equal(medium.apex,true,`sphere center should reach y≈${medium.expectedApexCenterY}`);
 assert.ok(medium.revolutions>1.5,`expected complete isolated revolutions, got ${medium.revolutions}`);
 assert.equal(high.apex,true);
 assert.ok(high.revolutions>2);
 console.log('ISOLATED_LOOP '+JSON.stringify({low,medium,high,depth}));
});
