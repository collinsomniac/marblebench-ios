import test from 'node:test';
import assert from 'node:assert/strict';
import {VORTEX_PROFILE as P,createVortexGeometry,vortexHeight,vortexSlope} from '../src/vortex-profile.js';

test('coin well is deeper, open, axisymmetric and steepens toward throat',()=>{
  assert.ok(P.rimY-P.throatY>1.1);
  assert.ok(P.inner>.34,'throat must remain wider than marble diameter');
  assert.ok(Math.abs(vortexHeight(P.inner)-P.throatY)<1e-10);
  assert.ok(Math.abs(vortexHeight(P.outer)-P.rimY)<1e-10);
  assert.ok(vortexSlope(P.inner)>vortexSlope(P.outer)*4);
  const mesh=createVortexGeometry({x:2.60,z:-.88});
  assert.equal(mesh.bowlTriangles,P.radialSegments*P.angularSegments*2);
  assert.ok(mesh.wallSections>0&&mesh.wallSections<P.angularSegments,'real lip must have inlet gap');
  assert.ok(mesh.vertices.every(Number.isFinite));
  assert.ok(mesh.indices.every(i=>i<mesh.vertices.length/3));
  assert.equal(mesh.indices.length%3,0);
  assert.ok(mesh.vertices.length/3<10000,'profile is finite static geometry, not a particle fluid');
});

test('last approach points tangentially along rim, not toward central hole',()=>{
  // Expected final two physical S-bend centerline waypoints.
  const previous=[1.72,5.00,-2.13],last=[2.33,4.97,-2.21];
  const r=[last[0]-2.60,last[2]+.88];
  const tangent=[last[0]-previous[0],last[2]-previous[2]];
  const radial=Math.abs(r[0]*tangent[0]+r[1]*tangent[1])/(Math.hypot(...r)*Math.hypot(...tangent));
  assert.ok(radial<.15,`expected tangential approach, got radial cosine ${radial}`);
  assert.ok(Math.abs(Math.atan2(r[1],r[0])-P.inletAngle)<.08);
  console.log('COIN_WELL_GEOMETRY '+JSON.stringify({depth:P.rimY-P.throatY,throatDiameterRatio:P.inner/.17,entranceRadialCosine:+radial.toFixed(3),wallSections:createVortexGeometry({x:2.6,z:-.88}).wallSections}));
});
