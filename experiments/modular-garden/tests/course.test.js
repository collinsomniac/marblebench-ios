import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {GardenSimulation,FIXED_DT} from '../src/physics.js';
import {sampleSpline,LIFT,FUNNEL,POOL,LOOP,liftHeight,liftGateOpening,COURSE_LABELS} from '../src/course.js';

await RAPIER.init();

test('modular course declares every requested physical module',()=>{
  assert.equal(COURSE_LABELS.length,7);
  assert.ok(FUNNEL.inner>2*.17/2,'funnel hole is wide enough for a sphere');
  assert.ok(POOL.level>POOL.floor);
  assert.ok(LOOP.radius>.17);
  const samples=sampleSpline([[0,0,0],[1,.5,0],[2,0,.7]],24);
  assert.equal(samples.length,25);
  assert.deepEqual(samples[0].map(n=>Number(n.toFixed(5))),[0,0,0]);
});

test('elevator movement and gate timing are continuous, repeatable and bounded',()=>{
  const period=LIFT.bottomDwell+LIFT.rise+LIFT.topDwell+LIFT.return;
  let maxStep=0;
  for(let i=0;i<Math.ceil(period/FIXED_DT);i++){
    const t=i*FIXED_DT,y=liftHeight(t),next=liftHeight(t+FIXED_DT);
    assert.ok(y>=LIFT.bottom-1e-7&&y<=LIFT.top+1e-7);
    assert.ok(liftGateOpening(t)>=0&&liftGateOpening(t)<=1);
    maxStep=Math.max(maxStep,Math.abs(y-next));
  }
  assert.ok(maxStep<.04,`Elevator discontinuity ${maxStep}`);
  assert.ok(Math.abs(liftHeight(period+.95)-liftHeight(.95))<1e-7);
});

test('Rapier moves existing marbles without instantaneous funnel/elevator teleports',()=>{
  const scene=new THREE.Scene(),sim=new GardenSimulation(RAPIER,scene);
  assert.ok(sim.course.pieces.length>130);
  assert.ok(sim.course.pieces.some(piece=>piece.kind==='funnel'));
  let samples=0,largest=0;
  for(let step=0;step<720;step++){
    const before=new Map(sim.balls.map(ball=>[ball.id,{...ball.body.translation()}]));
    sim.step();
    for(const ball of sim.balls){
      const p=ball.body.translation(),old=before.get(ball.id);
      assert.ok(Number.isFinite(p.x+p.y+p.z),`nonfinite body id ${ball.id}`);
      if(old){const jump=Math.hypot(p.x-old.x,p.y-old.y,p.z-old.z);largest=Math.max(largest,jump);samples++;
        assert.ok(jump<1.2,`unphysical position discontinuity ${jump}m for id ${ball.id} at step ${step}`);
      }
    }
    assert.ok(sim.balls.length<=sim.options.capacity);
  }
  assert.ok(samples>1000);
  assert.equal(sim.stats.steps,720);
  console.log(JSON.stringify({marbles:sim.balls.length,contacts:'Rapier',largestStepDisplacement:largest,physicalSteps:sim.stats.steps,waterImpacts:sim.waterImpacts,losses:sim.losses}));
  sim.dispose();
});
