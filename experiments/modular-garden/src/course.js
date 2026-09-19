import * as THREE from 'three';

/** Metres and seconds; Y is up. Layout remains data-driven and reusable by tests. */
export const MARBLE_RADIUS = 0.17;
export const POOL = Object.freeze({ minX: 3.1, maxX: 6.4, minZ: -1.8, maxZ: 0.42, floor: 0.14, level: 0.86 });
export const LIFT = Object.freeze({ x: -7.25, z: -0.88, bottom: -0.54, top: 7.48, rise: 15.0, bottomDwell: 2.8, topDwell: 1.7, return: 3.0 });
export const LOOP = Object.freeze({ x: -2.57, y: 2.23, z: -0.88, radius: 0.70 });
export const FUNNEL = Object.freeze({ x: 2.60, y: 4.04, z: -0.88, inner: 0.26, outer: 1.24 });
export const COURSE_LABELS = Object.freeze(['Motorized ratchet lift', 'S-bend', 'Open vortex', 'Gravity loop', 'Spring trampoline', 'Floating moat', 'Return conveyor']);
export const PALETTE = Object.freeze({ cyan: 0x40c8d4, yellow: 0xffd351, coral: 0xff7058, violet: 0x9c7be8, teal: 0x29b3a4, mint: 0x76dcbd, dark: 0x263c51, cream: 0xece8d9, brass: 0xc69c57 });

const V = (x,y,z) => new THREE.Vector3(x,y,z);
const q = new THREE.Quaternion();
const m = new THREE.Matrix4();
const v3 = V(0,0,0);
const UP = V(0,1,0);
const boxGeometry = new THREE.BoxGeometry(1,1,1);
const palette = new Map();
function material(hex, metalness = 0.05) {
  const key = `${hex}:${metalness}`;
  if (!palette.has(key)) palette.set(key, new THREE.MeshStandardMaterial({color:hex,metalness,roughness:metalness ? .31 : .43}));
  return palette.get(key);
}
export function sampleSpline(points, segments = 24) {
  const curve = new THREE.CatmullRomCurve3(points.map(p=>V(...p)), false, 'centripetal');
  return Array.from({length:segments+1},(_,i)=>curve.getPoint(i/segments).toArray());
}
export function liftHeight(t) {
  const {bottom,top,rise,bottomDwell,topDwell,return:back}=LIFT;
  const cycle=bottomDwell+rise+topDwell+back;
  const phase=((t%cycle)+cycle)%cycle;
  if(phase<bottomDwell)return bottom;
  if(phase<bottomDwell+rise)return bottom+(top-bottom)*(phase-bottomDwell)/rise;
  if(phase<bottomDwell+rise+topDwell)return top;
  return top+(bottom-top)*(phase-bottomDwell-rise-topDwell)/back;
}
export function liftGateOpening(t) {
  const {rise,bottomDwell,topDwell,return:back}=LIFT,period=rise+bottomDwell+topDwell+back;
  const phase=((t%period)+period)%period;
  if(phase<bottomDwell+rise)return 0;
  if(phase<bottomDwell+rise+.35)return (phase-bottomDwell-rise)/.35;
  if(phase<bottomDwell+rise+topDwell-.3)return 1;
  if(phase<bottomDwell+rise+topDwell)return Math.max(0,(bottomDwell+rise+topDwell-phase)/.3);
  return 0;
}

export function buildCourse({THREE: T=THREE,RAPIER,world,scene}) {
  const instances = new Map(), staticColliders=[], pieces=[];
  function makeCollider(center,size,rotation,options={}) {
    const desc=RAPIER.ColliderDesc.cuboid(size.x/2,size.y/2,size.z/2)
      .setTranslation(center.x,center.y,center.z)
      .setRotation(rotation)
      .setFriction(options.friction??.55)
      .setRestitution(options.restitution??.10);
    const collider=world.createCollider(desc);
    staticColliders.push(collider);
    return collider;
  }
  function block(center,size,color,rotation=new THREE.Quaternion(),options={}) {
    const c=Array.isArray(center)?V(...center):center;
    const s=Array.isArray(size)?V(...size):size;
    const key=`${color}:${options.metalness??.05}`;
    if(!instances.has(key)) instances.set(key,{color,metalness:options.metalness??.05,matrices:[]});
    m.compose(c,rotation,s);
    instances.get(key).matrices.push(m.clone());
    if(options.collider!==false)makeCollider(c,s,rotation,options);
    pieces.push({kind:'block',center:c.toArray(),size:s.toArray(),tag:options.tag??'structure'});
  }
  function railPath(points,color=PALETTE.cyan,{width=.48,wall=.25,friction=.5,tag='rail'}={}) {
    for(let i=1;i<points.length;i++){
      const a=V(...points[i-1]),b=V(...points[i]),tangent=b.clone().sub(a),length=tangent.length();
      if(length<.001)continue;
      tangent.divideScalar(length);
      const side=new THREE.Vector3().crossVectors(tangent,UP);
      if(side.lengthSq()<.000001)side.set(0,0,1);
      side.normalize();
      const up=new THREE.Vector3().crossVectors(side,tangent).normalize();
      const basis=new THREE.Matrix4().makeBasis(tangent,up,side);
      const rotation=new THREE.Quaternion().setFromRotationMatrix(basis);
      const mid=a.clone().add(b).multiplyScalar(.5);
      block(mid.clone().addScaledVector(up,-.063),V(length+.012,.115,width),color,rotation,{friction,tag});
      for(const sideSign of [-1,1]){
        const pos=mid.clone().addScaledVector(up,.10).addScaledVector(side,sideSign*(width*.5-.032));
        block(pos,V(length+.014,wall,.065),color,rotation,{friction,tag});
      }
    }
  }
  // A physical elevated exit connects directly to the lift when its gate opens.
  railPath([[-6.78,7.49,-.88],[-6.05,7.30,-.88],[-4.45,6.86,-.88]],PALETTE.coral,{width:.55,tag:'lift-exit'});
  const sBend=sampleSpline([[-4.45,6.86,-.88],[-3.20,6.53,-.20],[-1.96,6.08,-1.43],[-.65,5.70,-.21],[1.42,4.94,-.86]],29);
  railPath(sBend,PALETTE.cyan,{width:.48,tag:'s-bend'});
  // One connected annular, sloping rigid collider: the sphere drops through its real hole.
  const n=56,k=8,verts=[],faces=[];
  for(let j=0;j<=k;j++){
    const r=FUNNEL.inner+(FUNNEL.outer-FUNNEL.inner)*j/k;
    for(let i=0;i<=n;i++){
      const a=i/n*Math.PI*2;
      verts.push(FUNNEL.x+r*Math.cos(a),FUNNEL.y+(r-FUNNEL.inner)*.58,FUNNEL.z+r*Math.sin(a));
    }
  }
  for(let j=0;j<k;j++)for(let i=0;i<n;i++){
    const a=j*(n+1)+i,b=(j+1)*(n+1)+i,c=a+1,d=b+1;
    faces.push(a,c,b,c,d,b);
  }
  const surface=new THREE.BufferGeometry();
  surface.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  surface.setIndex(faces);
  surface.computeVertexNormals();
  const funnelMesh=new THREE.Mesh(surface,new THREE.MeshStandardMaterial({color:PALETTE.yellow,roughness:.29,metalness:.05,side:THREE.DoubleSide}));
  scene.add(funnelMesh);
  const funnelCollider=world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(verts),new Uint32Array(faces)).setFriction(.25));
  staticColliders.push(funnelCollider);
  pieces.push({kind:'funnel',radius:FUNNEL.outer,hole:FUNNEL.inner,tag:'vortex'});
  // A continuous physical chute beneath the hole (no funnel teleport or position snap).
  railPath(sampleSpline([[2.60,3.50,-.88],[2.60,3.12,-.88],[1.68,3.01,-.88],[.05,2.83,-.88],[-2.7,2.42,-.88],[-4.87,2.50,-.88],[-3.62,1.54,-.88]],34),PALETTE.violet,{width:.46,tag:'post-funnel'});
  railPath([[-3.62,1.54,-.88],[LOOP.x,LOOP.y-LOOP.radius,-.88]],PALETTE.coral,{width:.43,tag:'loop-entry'});
  // The loop is a ring of oriented collision segments, not a trigger that forces completion.
  const loop=[];
  for(let i=0;i<=52;i++){
    const a=i/52*Math.PI*2;
    loop.push([LOOP.x+LOOP.radius*Math.sin(a),LOOP.y-LOOP.radius*Math.cos(a),LOOP.z]);
  }
  railPath(loop,PALETTE.coral,{width:.43,wall:.31,friction:.17,tag:'gravity-loop'});
  railPath(sampleSpline([[LOOP.x,LOOP.y-LOOP.radius,LOOP.z],[-1.72,1.48,-.88],[-.56,1.10,-.88],[.20,.86,-.88]],12),PALETTE.yellow,{width:.49,tag:'trampoline-entry'});
  // A passive catch route collects balls that miss the trampoline; never scripted through it.
  railPath([[-.25,.28,-.88],[.50,.20,-.88],[1.45,.18,-.88],[2.75,.11,-.88]],PALETTE.mint,{width:.67,tag:'safety-net'});
  railPath(sampleSpline([[1.38,1.55,-.88],[2.15,1.43,-.88],[3.17,1.17,-.88],[3.42,.96,-.88]],12),PALETTE.cyan,{width:.53,tag:'trampoline-landing'});
  // Transparent pool surface is presentation, not a CFD solver.
  const basinMat=new THREE.MeshStandardMaterial({color:PALETTE.cyan,roughness:.22,metalness:.04,transparent:true,opacity:.40,depthWrite:false,side:THREE.DoubleSide});
  const poolWidth=POOL.maxX-POOL.minX,poolDepth=POOL.maxZ-POOL.minZ;
  const water=new THREE.Mesh(new THREE.PlaneGeometry(poolWidth,poolDepth),basinMat);
  water.rotation.x=-Math.PI/2;
  water.position.set((POOL.minX+POOL.maxX)/2,POOL.level,(POOL.minZ+POOL.maxZ)/2);
  water.renderOrder=2;
  scene.add(water);
  block([(POOL.minX+POOL.maxX)/2,POOL.floor-.13,(POOL.minZ+POOL.maxZ)/2],[poolWidth+.20,.24,poolDepth+.20],PALETTE.dark,undefined,{tag:'basin-floor'});
  for(const z of [POOL.minZ,POOL.maxZ])block([(POOL.minX+POOL.maxX)/2,.51,z],[poolWidth+.2,.84,.12],PALETTE.teal,undefined,{tag:'basin-wall'});
  block([POOL.minX,.49,(POOL.minZ+POOL.maxZ)/2],[.12,.82,poolDepth+.1],PALETTE.teal,undefined,{tag:'basin-wall'});
  block([POOL.maxX,.33,(POOL.minZ+POOL.maxZ)/2],[.12,.50,poolDepth+.1],PALETTE.teal,undefined,{tag:'basin-exit'});
  railPath([[POOL.maxX,.52,-.88],[7.05,.26,-.88],[7.48,-.42,-.88]],PALETTE.yellow,{width:.58,tag:'pool-exit'});
  railPath([[7.48,-.42,-.88],[5.0,-.52,-.88],[1.0,-.52,-.88],[-3.9,-.52,-.88],[LIFT.x,LIFT.bottom-.10,LIFT.z]],PALETTE.violet,{width:.54,wall:.30,tag:'motorized-return'});
  // Architectural supports and visible modular peg towers.
  for(const x of [-6.4,-3.5,-.3,2.65,5.8]){
    block([x,3.14,-2.0],[.12,6.30,.12],PALETTE.cream,undefined,{tag:'support'});
    block([x,-.85,-2.0],[.7,.12,.7],PALETTE.dark,undefined,{tag:'foot'});
  }
  for(const [key,entry] of instances){
    const mesh=new THREE.InstancedMesh(boxGeometry,material(entry.color,entry.metalness),entry.matrices.length);
    entry.matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
    mesh.instanceMatrix.needsUpdate=true;
    mesh.frustumCulled=false;
    mesh.userData.pieceGroup=key;
    scene.add(mesh);
  }
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(26,17),new THREE.MeshStandardMaterial({color:0xe4eced,roughness:.86}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-1.05;scene.add(floor);
  return {pieces,staticColliders,water,dispose(){surface.dispose();floor.geometry.dispose();water.geometry.dispose();for(const obj of scene.children){if(obj.isInstancedMesh)obj.dispose?.();}}};
}
