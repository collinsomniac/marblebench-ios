import * as THREE from 'three';
import {POOL,LIFT} from './course.js';

/** Catch a floating marble at ANY lateral location across the pool. The original
 * narrow chute remains visible; this broad tray sits slightly beneath it.
 * Surfaces are static Rapier trimeshes, never position/velocity teleport triggers.
 */
export function installOverflowCatcher(RAPIER,world,scene){
  const x0=POOL.maxX-.15,x1=7.04,x2=7.58;
  const z0=POOL.minZ-.19,z1=POOL.maxZ+.19;
  const color=0x40c8d4,visual=new THREE.Group(),colliders=[];
  const mat=new THREE.MeshStandardMaterial({color,metalness:.1,roughness:.28,side:THREE.DoubleSide});
  const floor=[x0,.41,x1,.16,x2,-.50];
  const v=[],indices=[];
  for(let i=0;i<3;i++)v.push(floor[i*2],floor[i*2+1],z0,floor[i*2],floor[i*2+1],z1);
  for(let i=0;i<2;i++){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2)}
  function meshCollider(vertices,faces){
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(faces);geo.computeVertexNormals();
    const mesh=new THREE.Mesh(geo,mat);visual.add(mesh);
    const physics=world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(vertices),new Uint32Array(faces)).setFriction(.28).setRestitution(.07));
    colliders.push(physics);return mesh;
  }
  meshCollider(v,indices);
  // Side fences are two-sided colliders; their top rises to avoid lateral spills.
  for(const z of [z0,z1]){
    const walls=[],faces=[];
    for(let i=0;i<3;i++){walls.push(floor[2*i],floor[2*i+1]-.04,z,floor[2*i],floor[2*i+1]+.49,z)}
    for(let i=0;i<2;i++){const j=i*2;faces.push(j,j+2,j+1,j+1,j+2,j+3)}
    meshCollider(walls,faces);
  }
  // Wide return collection beneath the narrow motorized return lane. Avoid an end cap at the pool lip.
  const returnZ0=POOL.minZ-.12,returnZ1=POOL.maxZ+.12;
  const returnFloor=[7.58,-.59,4.20,-.68,0,-.70,-3.8,-.72,LIFT.x+.03,-.80];
  const rverts=[],rfaces=[];
  for(let i=0;i<returnFloor.length/2;i++)rverts.push(returnFloor[i*2],returnFloor[i*2+1],returnZ0,returnFloor[i*2],returnFloor[i*2+1],returnZ1);
  for(let i=0;i<returnFloor.length/2-1;i++){const j=i*2;rfaces.push(j,j+1,j+2,j+1,j+3,j+2)}
  meshCollider(rverts,rfaces);
  // Full-length guard rails prevent the broad lower collection lane spilling over its sides.
  for(const z of [returnZ0,returnZ1]){
    const vertices=[],faces=[];
    for(let i=0;i<returnFloor.length/2;i++)vertices.push(returnFloor[2*i],returnFloor[2*i+1],z,returnFloor[2*i],returnFloor[2*i+1]+.55,z);
    for(let i=0;i<returnFloor.length/2-1;i++){const j=2*i;faces.push(j,j+2,j+1,j+1,j+2,j+3)}
    meshCollider(vertices,faces);
  }
  scene.add(visual);
  return {visual,colliders,dispose(){visual.traverse(obj=>{if(obj.geometry)obj.geometry.dispose()});mat.dispose()}};
}
