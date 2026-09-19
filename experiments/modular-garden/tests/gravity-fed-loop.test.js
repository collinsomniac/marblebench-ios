import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import {LOOP,MARBLE_RADIUS as radius} from '../src/course.js';
import {loopColliderGeometry} from '../src/loop-geometry.js';
await RAPIER.init();
const round=n=>+n.toFixed(3),dt=1/120;
function line(points,samples=48){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal');return Array.from({length:samples+1},(_,i)=>curve.getPoint(i/samples).toArray())}
function loopPath(pitch){return Array.from({length:129},(_,i)=>{const t=i/128,a=2*Math.PI*t;return[LOOP.x+LOOP.radius*Math.sin(a),LOOP.y-LOOP.radius*Math.cos(a),LOOP.z-pitch*t]})}
function trial({height=5.4,pitch=.6,friction=.13}={}){
 const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=dt;
 const paths=[line([[-6.2,height,-.25],[-5.6,height-.45,-.31],[-4.7,2.95,-.47],[-4.02,1.84,-.67],[-3.63,1.56,-.74],[-3.2,1.53,-.79],[LOOP.x,LOOP.y-LOOP.radius,LOOP.z]],72),loopPath(pitch),line([[LOOP.x,LOOP.y-LOOP.radius,LOOP.z-pitch],[-2.15,1.50,LOOP.z-pitch-.055],[-1.7,1.38,LOOP.z-pitch-.10],[-1.2,1.15,LOOP.z-pitch-.1]],28)];
 for(let i=0;i<paths.length;i++){const mesh=loopColliderGeometry(paths[i],{width:i===1?.48:.65,wall:i===1?.31:.35});world.createCollider(RAPIER.ColliderDesc.trimesh(mesh.vertices,mesh.indices,RAPIER.TriMeshFlags?.FIX_INTERNAL_EDGES??0).setFriction(friction).setRestitution(.02));}
 const start=paths[0][0];const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(start[0]+.02,start[1]+radius+.04,start[2]).setCcdEnabled(true).setLinearDamping(.008).setAngularDamping(.02));world.createCollider(RAPIER.ColliderDesc.ball(radius).setDensity(.72).setFriction(.42).setRestitution(.08),body);
 let apex=false,passedBase=false,exit=false,entrySpeed=null,peak=0,lost=false,exitPosition=null;const trace=[];
 for(let i=0;i<3600;i++){
 world.step();const p=body.translation(),v=body.linvel(),speed=Math.hypot(v.x,v.y,v.z);
 if(entrySpeed===null&&p.x>LOOP.x-.28&&p.x<LOOP.x+.10&&p.y<LOOP.y-LOOP.radius+radius+.25)entrySpeed=speed;
 if(p.y>LOOP.y+LOOP.radius-radius-.07&&Math.abs(p.x-LOOP.x)<.3&&p.z<LOOP.z)apex=true;
 if(apex&&p.y<LOOP.y-LOOP.radius+radius+.22&&p.z<LOOP.z-pitch*.75)passedBase=true;
 if(passedBase&&p.x>LOOP.x+.85&&p.y<LOOP.y-.1){exit=true;exitPosition={x:round(p.x),y:round(p.y),z:round(p.z)};}
 peak=Math.max(peak,p.y);
 if(i%100===0&&trace.length<25)trace.push({t:round((i+1)*dt),x:round(p.x),y:round(p.y),z:round(p.z),speed:round(speed)});
 if(p.y<-1||Math.abs(p.z)>5){lost=true;break}
 if(exit)break;
 }
 const output={height,pitch,friction,entrySpeed:entrySpeed===null?null:round(entrySpeed),apex,passedBase,exit,exitPosition,peak:round(peak),lost,trace};world.free();return output;
}
test('gravity alone powers complete loop and outbound handoff across six initial conditions',()=>{const variants=[];for(const pitch of [.6,.9])for(const height of [4.6,5.4,6.2])variants.push(trial({height,pitch}));for(const r of variants){assert.ok(r.entrySpeed>5,`insufficient physical entry speed ${JSON.stringify(r)}`);assert.equal(r.apex,true,`missed apex ${JSON.stringify(r)}`);assert.equal(r.passedBase,true,`did not return to bottom ${JSON.stringify(r)}`);assert.equal(r.exit,true,`did not advance past exit threshold ${JSON.stringify(r)}`);assert.equal(r.lost,false);}console.log('GRAVITY_FED_LOOP '+JSON.stringify(variants));});
