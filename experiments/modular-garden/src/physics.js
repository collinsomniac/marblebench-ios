import * as THREE from 'three';
import {buildCourse,POOL,LIFT,MARBLE_RADIUS,liftHeight,liftGateOpening} from './course.js';
import {installReturnGuard} from './return-guard.js';

export const FIXED_DT=1/120;
export const DENSITY=Object.freeze({water:1000,lightMarble:720,solidGlass:2500});
const PI=Math.PI,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const volume=4/3*PI*MARBLE_RADIUS**3;
const mass=volume*.72;
export function initialPosition(i=0){
  const lane=Math.min(5,Math.max(0,i));
  const x=-6.45+lane*.36;
  const trackHeight=7.49-(x+6.78)*(.63/2.33);
  return {x,y:trackHeight+MARBLE_RADIUS+.045,z:-.88};
}
/** All existing marbles move through Rapier; replacement always gets a new entity ID. */
export class GardenSimulation {
  constructor(RAPIER,scene){
    this.R=RAPIER;this.world=new RAPIER.World({x:0,y:-9.81,z:0});this.world.timestep=FIXED_DT;
    this.scene=scene;this.course=buildCourse({RAPIER,world:this.world,scene});
    this.returnGuard=installReturnGuard(RAPIER,this.world,scene);
    this.course.pieces.push({kind:'bumper',tag:'physical-return-bumper'});
    this.balls=[];this.sequence=0;this.time=0;this.spawnAccumulator=0;this.losses=0;this.waterImpacts=0;
    this.stats={contacts:'engine-managed',steps:0};this.options={flow:.48,capacity:48,speed:1,water:true,gravity:9.81};
    this.sphereGeometry=new THREE.SphereGeometry(MARBLE_RADIUS,24,16);
    this.marbleMaterial=new THREE.MeshStandardMaterial({color:0xffffff,metalness:.08,roughness:.13});
    this.mesh=new THREE.InstancedMesh(this.sphereGeometry,this.marbleMaterial,96);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.frustumCulled=false;this.mesh.count=0;scene.add(this.mesh);
    this.dummy=new THREE.Object3D();
    this.colors=[0xf06464,0xf0c94e,0x47bed4,0xa77cdb,0x70d6ad,0xff925e].map(c=>new THREE.Color(c));
    this.shelf=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(LIFT.x,LIFT.bottom,LIFT.z));
    const shelfRot={x:0,y:0,z:Math.sin(-.055/2),w:Math.cos(-.055/2)};
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(.53,.07,.41).setRotation(shelfRot).setFriction(.9),this.shelf);
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(.06,.28,.41).setTranslation(-.56,.22,0),this.shelf);
    for(const z of [-.43,.43])this.world.createCollider(RAPIER.ColliderDesc.cuboid(.58,.25,.045).setTranslation(0,.20,z),this.shelf);
    this.shelfMesh=this.makeDynamicBox(1.08,.14,.83,0xff7058);
    this.gate=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(LIFT.x+.55,LIFT.bottom+.22,LIFT.z));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(.05,.27,.38),this.gate);
    this.gateMesh=this.makeDynamicBox(.10,.54,.76,0x344c68);
    this.railGuide=this.makeDynamicBox(.08,8.4,.10,0xc4b8ad);this.railGuide.position.set(LIFT.x-.72,3.45,LIFT.z-.52);
    this.springAnchor=this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(.48,.64,LIFT.z));
    this.pad=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(.48,.64,LIFT.z).setLinearDamping(.22).setAngularDamping(1.5));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(.52,.09,.43).setDensity(1.6).setRestitution(.90).setFriction(.75),this.pad);
    const jointData=RAPIER.JointData.prismatic({x:0,y:0,z:0},{x:0,y:0,z:0},{x:0,y:1,z:0});
    jointData.limitsEnabled=true;jointData.limits=[-.24,.12];
    this.springJoint=this.world.createImpulseJoint(jointData,this.springAnchor,this.pad,true);
    this.springJoint.configureMotorPosition(0,120,10);
    this.padMesh=this.makeDynamicBox(1.04,.18,.86,0xffd351);
    this.gear=new THREE.Mesh(new THREE.TorusGeometry(.30,.068,8,18),new THREE.MeshStandardMaterial({color:0x344c68,metalness:.45,roughness:.32}));
    this.gear.position.set(LIFT.x-.72,7.22,LIFT.z-.54);scene.add(this.gear);
    for(let i=0;i<6;i++)this.spawn(initialPosition(i));this.syncInstances(1);
  }
  makeDynamicBox(x,y,z,color){const mesh=new THREE.Mesh(new THREE.BoxGeometry(x,y,z),new THREE.MeshStandardMaterial({color,roughness:.37,metalness:.07}));mesh.frustumCulled=false;this.scene.add(mesh);return mesh;}
  spawn(position){
    if(this.balls.length>=this.options.capacity)return null;
    const R=this.R,body=this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(position.x,position.y,position.z).setLinearDamping(.008).setAngularDamping(.02).setCcdEnabled(true));
    this.world.createCollider(R.ColliderDesc.ball(MARBLE_RADIUS).setDensity(.72).setFriction(.42).setRestitution(.28),body);
    const entity={id:++this.sequence,body,radius:MARBLE_RADIUS,color:this.sequence%this.colors.length,previous:{x:position.x,y:position.y,z:position.z},lastDirection:new THREE.Vector3(1,0,0),inWater:false};this.balls.push(entity);return entity;
  }
  addMarbles(n=1){let added=0;for(let i=0;i<n;i++){const position=initialPosition((this.sequence+i)%6);position.y+=Math.floor(i/6)*.37;if(!this.spawn(position))break;added++;}return added;}
  removeBall(index,lost=false){const b=this.balls[index];this.world.removeRigidBody(b.body);this.balls.splice(index,1);if(lost)this.losses++;}
  /** Exact spherical-cap displacement for flat water; current and drag are approximations. */
  applyBuoyancy(ball){
    if(!this.options.water){ball.inWater=false;return;}
    const p=ball.body.translation(),r=ball.radius;
    const inside=p.x>POOL.minX+r*.35&&p.x<POOL.maxX-r*.35&&p.z>POOL.minZ+r*.35&&p.z<POOL.maxZ-r*.35;
    const h=clamp(POOL.level-(p.y-r),0,2*r),immersed=inside&&h>0&&p.y>POOL.floor-.4;
    if(!immersed){ball.inWater=false;return;}
    if(!ball.inWater)this.waterImpacts++;
    const displaced=PI*h*h*(r-h/3),vel=ball.body.linvel(),buoyant=9.81*displaced,drag=.024*displaced/volume,current=.95;
    ball.body.addForce({x:(current-vel.x)*mass*1.15-drag*vel.x,y:buoyant-drag*vel.y,z:-drag*vel.z},true);ball.inWater=true;
  }
  step(){
    const dt=FIXED_DT;this.time+=dt;
    const y=liftHeight(this.time);this.shelf.setNextKinematicTranslation({x:LIFT.x,y,z:LIFT.z});
    const open=liftGateOpening(this.time);this.gate.setNextKinematicTranslation({x:LIFT.x+.55,y:y+.22,z:LIFT.z-open*.95});
    for(const b of this.balls){
      // Rapier addForce is persistent; recompute fluid and conveyor forces on each tick.
      b.body.resetForces(false);
      const p=b.body.translation(),v=b.body.linvel();b.previous.x=p.x;b.previous.y=p.y;b.previous.z=p.z;
      if(p.y<.05&&p.y>-.87&&p.x>-7.60&&p.x<7.5&&Math.abs(p.z-LIFT.z)<.48){
        b.body.addForce({x:mass*clamp((-1.9-v.x)*2.6,-8,8),y:0,z:mass*clamp((LIFT.z-p.z)*2,-2,2)},true);
      }
      this.applyBuoyancy(b);
    }
    this.world.step();
    for(let i=this.balls.length-1;i>=0;i--){const p=this.balls[i].body.translation();if(!Number.isFinite(p.x+p.y+p.z)||p.y<-2.6||Math.abs(p.x)>10||Math.abs(p.z)>5)this.removeBall(i,true);}
    this.spawnAccumulator+=this.options.flow*dt;while(this.spawnAccumulator>=1){this.spawnAccumulator--;this.addMarbles(1)}
    while(this.balls.length>this.options.capacity)this.removeBall(this.balls.length-1);
    this.stats.steps++;
    const q=this.pad.rotation();this.padMesh.position.copy(this.pad.translation());this.padMesh.quaternion.set(q.x,q.y,q.z,q.w);
    this.shelfMesh.position.copy(this.shelf.translation());this.shelfMesh.rotation.z=-.055;
    this.gateMesh.position.copy(this.gate.translation());this.gear.rotation.z=this.time*.7;
  }
  syncInstances(alpha=1,firstPersonId=null){
    const dummy=this.dummy;this.mesh.count=this.balls.length;
    for(let i=0;i<this.balls.length;i++){
      const b=this.balls[i],p=b.body.translation(),rot=b.body.rotation();
      dummy.position.set(b.previous.x+(p.x-b.previous.x)*alpha,b.previous.y+(p.y-b.previous.y)*alpha,b.previous.z+(p.z-b.previous.z)*alpha);
      dummy.quaternion.set(rot.x,rot.y,rot.z,rot.w);dummy.scale.setScalar(b.id===firstPersonId?.id?0:1);dummy.updateMatrix();this.mesh.setMatrixAt(i,dummy.matrix);this.mesh.setColorAt(i,this.colors[b.color]);
    }
    this.mesh.instanceMatrix.needsUpdate=true;if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;
  }
  snapshot(){return {balls:this.balls.length,steps:this.stats.steps,losses:this.losses,waterImpacts:this.waterImpacts,activeLiftHeight:liftHeight(this.time)};}
  dispose(){for(let i=this.balls.length-1;i>=0;i--)this.removeBall(i);this.mesh.geometry.dispose();this.marbleMaterial.dispose();this.returnGuard.mesh.geometry.dispose();this.returnGuard.mesh.material.dispose();}
}
