import * as THREE from 'three';
/** Physical impact bumper at the abrupt pool-exit/return turnaround. No velocity assignment. */
export function installReturnGuard(RAPIER,world,scene){
  const center={x:7.76,y:-.51,z:-.88};
  const collider=world.createCollider(
    RAPIER.ColliderDesc.cuboid(.095,.75,.66)
      .setTranslation(center.x,center.y,center.z)
      .setRestitution(.78)
      .setFriction(.20)
  );
  const mesh=new THREE.Mesh(
    new THREE.BoxGeometry(.19,1.50,1.32),
    new THREE.MeshStandardMaterial({color:0xff7058,roughness:.30,metalness:.12})
  );
  mesh.position.set(center.x,center.y,center.z);
  scene.add(mesh);
  return {collider,mesh};
}
