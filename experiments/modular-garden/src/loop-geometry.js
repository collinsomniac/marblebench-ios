import * as THREE from 'three';
/** A genuine 3D loop: its descending lower-left return runs BEHIND the
 * incoming rail before joining the bottom tangent. No ball teleport, magnetic
 * acceleration, or scripted velocity. The offset is zero with zero derivative
 * at both endpoints, so its centerline is C1-continuous at the join.
 */
export const LOOP_CLEARANCE=Object.freeze({returnDepth:1.15,startAngle:Math.PI*1.5,endAngle:Math.PI*2,segments:96});
export function loopCenterline(loop,options=LOOP_CLEARANCE){
 const points=[];
 for(let i=0;i<=options.segments;i++){
  const a=i/options.segments*Math.PI*2;
  let depth=0;
  if(a>options.startAngle&&a<options.endAngle){
   const u=(a-options.startAngle)/(options.endAngle-options.startAngle);
   depth=-options.returnDepth*Math.sin(Math.PI*u)**2;
  }
  points.push([loop.x+loop.radius*Math.sin(a),loop.y-loop.radius*Math.cos(a),loop.z+depth]);
 }
 return points;
}
/** One continuous collider strip. The old frame used tangent × world-up;
 * it FLIPPED the cross-section around vertical tangents, producing twisted
 * walls and incorrect contact normals at the top of a vertical loop.
 * Instead project a stable depth-axis binormal perpendicular to each tangent.
 * For this predominantly XY-loop it stays nondegenerate, preserving an inward
 * surface normal through all four quadrants and the smooth return detour.
 */
export function loopColliderGeometry(points,{width=.48,wall=.31}={}){
 const depthAxis=new THREE.Vector3(0,0,1),path=points.map(p=>new THREE.Vector3(...p));
 const sections=path.map((p,i)=>{
  const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)];
  const tangent=b.clone().sub(a).normalize();
  const side=depthAxis.clone().addScaledVector(tangent,-depthAxis.dot(tangent));
  if(side.lengthSq()<1e-7)throw Error('Loop path approaches the reference depth axis: use a transported frame');
  side.normalize();
  const normal=new THREE.Vector3().crossVectors(side,tangent).normalize();
  return {left:p.clone().addScaledVector(side,-width/2),right:p.clone().addScaledVector(side,width/2),normal};
 });
 const vertices=[],indices=[];
 const quad=(a,b,c,d)=>{const k=vertices.length/3;for(const p of [a,b,c,d])vertices.push(p.x,p.y,p.z);indices.push(k,k+1,k+2,k+1,k+3,k+2)};
 for(let i=1;i<sections.length;i++){
  const a=sections[i-1],b=sections[i];
  quad(a.left,a.right,b.left,b.right);
  quad(a.left,b.left,a.left.clone().addScaledVector(a.normal,wall),b.left.clone().addScaledVector(b.normal,wall));
  quad(a.right,a.right.clone().addScaledVector(a.normal,wall),b.right,b.right.clone().addScaledVector(b.normal,wall));
 }
 return {vertices:new Float32Array(vertices),indices:new Uint32Array(indices)};
}
