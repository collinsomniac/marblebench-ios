import * as THREE from 'three';
/** Physical impact bumper covering the entire pool outflow and return turnaround.
 * This reverses velocity through an actual collision, never direct body mutation.
 */
export function installReturnGuard(RAPIER,world,scene){
  const center={x:7.76,y:-.51,z:-.70};
  const halfDepth=1.49;
  const collider=world.createCollider(
    RAPIER.ColliderDesc.cuboid(.095,.75,halfDepth)
      .setTranslation(center.x,center.y,center.z)
      .setRestitution(.70)
      .setFriction(.23)
  );
  const mesh=new THREE.Mesh(
    new THREE.BoxGeometry(.19,1.50,halfDepth*2),
    new THREE.MeshStandardMaterial({color:0xff7058,roughness:.30,metalness:.12})
  );
  mesh.position.set(center.x,center.y,center.z);
  scene.add(mesh);
  return {collider,mesh};
}
