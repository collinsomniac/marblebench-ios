import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fitOrbitDistance,ORBIT_MAX_DISTANCE} from '../src/framing.js';
import {CameraRig} from '../src/camera.js';
const stub=()=>({style:{},hidden:false,addEventListener(){},setPointerCapture(){}});
test('portrait orbit frames full 18.4m course and permits manual zoom out',()=>{
 const aspect=393/852, fov=47;
 const fit=fitOrbitDistance(aspect,fov),camera=new THREE.PerspectiveCamera(fov,aspect,.045,110);
 const rig=new CameraRig(camera,stub(),stub(),stub());
 const visibleWidth=2*fit*Math.tan(fov*Math.PI/360)*aspect;
 assert.ok(visibleWidth>=18.39,`horizontal field ${visibleWidth} must fit course`);
 assert.ok(rig.distance>38 && rig.distance<=ORBIT_MAX_DISTANCE,`portrait distance ${rig.distance}`);
 assert.ok(fitOrbitDistance(16/9,fov)<=fit);
 assert.ok(fitOrbitDistance(0,fov)>0);
});
