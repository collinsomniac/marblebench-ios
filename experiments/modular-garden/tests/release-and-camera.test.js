import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {GardenSimulation} from '../src/physics.js';
import {CameraRig,FOLLOW_FOV_MULTIPLIER} from '../src/camera.js';
await RAPIER.init();

const stub=()=>({style:{},hidden:false,addEventListener(){},setPointerCapture(){},getBoundingClientRect(){return {left:0,top:0,width:116,height:116}}});

test('both follow views widen FOV 25 percent and orbit/explore restore original projection',()=>{
  const camera=new THREE.PerspectiveCamera(47,1,.045,110);
  const rig=new CameraRig(camera,stub(),stub(),stub());
  const balls=[{id:42}];
  assert.equal(FOLLOW_FOV_MULTIPLIER,1.25);
  assert.equal(rig.setMode('third',balls),'third');
  assert.ok(Math.abs(camera.fov-58.75)<.0001);
  assert.ok(rig.followDistance>=2.8);
  assert.equal(rig.setMode('first',balls),'first');
  assert.ok(Math.abs(camera.fov-58.75)<.0001);
  rig.setMode('orbit',balls);assert.equal(camera.fov,47);
  rig.setMode('explore',balls);assert.equal(camera.fov,47);
});

test('marbles appear singly and release scheduler never accumulates a future burst',()=>{
  const sim=new GardenSimulation(RAPIER,new THREE.Scene());
  assert.equal(sim.balls.length,1);
  assert.deepEqual(sim.releaseTimes,[0]);
  for(let i=0;i<120;i++)sim.step();
  assert.equal(sim.sequence,1,'do not release a second marble before the first two seconds');
  for(let i=0;i<840;i++)sim.step();
  assert.ok(sim.sequence>=3,'the course should continue releasing marbles');
  const gaps=sim.releaseTimes.slice(1).map((t,i)=>t-sim.releaseTimes[i]);
  assert.ok(gaps.every(g=>g>=1.98),`no catch-up cluster: ${gaps.join(',')}`);
  sim.options.flow=0;
  const old=sim.sequence;
  for(let i=0;i<360;i++)sim.step();
  assert.equal(sim.sequence,old,'flow zero should not release additional marbles');
  assert.ok(sim.spawnAccumulator<=1,'unreleased credits must remain bounded');
  console.log('RELEASE_SCHEDULE '+JSON.stringify({initial:1,releases:sim.sequence,gaps:gaps.map(g=>+g.toFixed(3)),last:sim.snapshot()}));
  sim.dispose();
});
