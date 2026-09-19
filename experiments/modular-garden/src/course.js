import * as THREE from 'three';

export const MARBLE_RADIUS=0.17;
export const POOL=Object.freeze({minX:3.1,maxX:6.4,minZ:-1.8,maxZ:.42,floor:.14,level:.86});
export const LIFT=Object.freeze({x:-7.25,z:-.88,bottom:-.54,top:7.48,rise:15,bottomDwell:2.8,topDwell:1.7,return:3});
export const LOOP=Object.freeze({x:-2.57,y:2.23,z:-.88,radius:.70});
export const FUNNEL=Object.freeze({x:2.60,y:4.04,z:-.88,inner:.26,outer:1.24});
export const COURSE_LABELS=Object.freeze(['Motorized ratchet lift','S-bend','Open vortex','Gravity loop','Spring trampoline','Floating moat','Return conveyor']);
export const PALETTE=Object.freeze({cyan:0x40c8d4,yellow:0xffd351,coral:0xff7058,violet:0x9c7be8,teal:0x29b3a4,mint:0x76dcbd,dark:0x263c51,cream:0xece8d9,brass:0xc69c57});
const V=(x,y,z)=>new THREE.Vector3(x,y,z),UP=V(0,1,0),boxGeometry=new THREE.BoxGeometry(1,1,1);
const mats=new Map();
function material(color,metalness=.05){const key=`${color}:${metalness}`;if(!mats.has(key))mats.set(key,new THREE.MeshStandardMaterial({color,metalness,roughness:metalness?.31:.43}));return mats.get(key)}
export function sampleSpline(points,segments=24){const curve=new THREE.CatmullRomCurve3(points.map(p=>V(...p)),false,'centripetal');return Array.from({length:segments+1},(_,i)=>curve.getPoint(i/segments).toArray())}
export function liftHeight(t){const {bottom,top,rise,bottomDwell,topDwell,return:back}=LIFT,period=bottomDwell+rise+topDwell+back,phase=((t%period)+period)%period;if(phase<bottomDwell)return bottom;if(phase<bottomDwell+rise)return bottom+(top-bottom)*(phase-bottomDwell)/rise;if(phase<bottomDwell+rise+topDwell)return top;return top+(bottom-top)*(phase-bottomDwell-rise-topDwell)/back}
export function liftGateOpening(t){const {rise,bottomDwell,topDwell,return:back}=LIFT,period=rise+bottomDwell+topDwell+back,phase=((t%period)+period)%period;if(phase<bottomDwell+rise)return 0;if(phase<bottomDwell+rise+.35)return(phase-bottomDwell-rise)/.35;if(phase<bottomDwell+rise+topDwell-.3)return 1;if(phase<bottomDwell+rise+topDwell)return Math.max(0,(bottomDwell+rise+topDwell-phase)/.3);return 0}

export function buildCourse({RAPIER,world,scene}){
  const instances=new Map(),pieces=[],staticColliders=[];
  function collider(center,size,rotation,options={}){const desc=RAPIER.ColliderDesc.cuboid(size.x/2,size.y/2,size.z/2).setTranslation(center.x,center.y,center.z).setRotation(rotation).setFriction(options.friction??.48).setRestitution(options.restitution??.08);staticColliders.push(world.createCollider(desc))}
  function block(center,size,color,rotation=new THREE.Quaternion(),options={}){
    const c=Array.isArray(center)?V(...center):center,s=Array.isArray(size)?V(...size):size;
    const key=`${color}:${options.metalness??.05}`;if(!instances.has(key))instances.set(key,{color,metalness:options.metalness??.05,matrices:[]});
    const matrix=new THREE.Matrix4().compose(c,rotation,s);instances.get(key).matrices.push(matrix);
    if(options.collider!==false)collider(c,s,rotation,options);
    pieces.push({kind:'block',center:c.toArray(),size:s.toArray(),tag:options.tag??'structure'});
  }
  function railPath(points,color=PALETTE.cyan,{width=.48,wall=.25,friction=.33,tag='rail'}={}){
    const path=points.map(p=>V(...p));if(path.length<2)return;
    const sections=path.map((p,i)=>{
      const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)];
      const tangent=b.clone().sub(a).normalize(),side=new THREE.Vector3().crossVectors(tangent,UP);
      if(side.lengthSq()<1e-6)side.set(0,0,1);else side.normalize();
      const up=new THREE.Vector3().crossVectors(side,tangent).normalize();
      return {p,tangent,side,up,left:p.clone().addScaledVector(side,-width/2),right:p.clone().addScaledVector(side,width/2)};
    });
    // One continuous non-box collider per complete lane, with no internal vertical end caps.
    const vertices=[],indices=[];
    function quad(a,b,c,d){const base=vertices.length/3;for(const p of [a,b,c,d])vertices.push(p.x,p.y,p.z);indices.push(base,base+1,base+2,base+1,base+3,base+2)}
    for(let i=1;i<sections.length;i++){
      const a=sections[i-1],b=sections[i];const center=a.p.clone().add(b.p).multiplyScalar(.5);
      const t=b.p.clone().sub(a.p),length=t.length();if(length<.001)continue;t.normalize();
      const side=new THREE.Vector3().crossVectors(t,UP).normalize(),up=new THREE.Vector3().crossVectors(side,t).normalize();
      const rotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(t,up,side));
      block(center.clone().addScaledVector(up,-.063),V(length+.01,.115,width),color,rotation,{collider:false,tag});
      for(const sign of [-1,1])block(center.clone().addScaledVector(up,.10).addScaledVector(side,sign*(width/2-.032)),V(length+.01,wall,.065),color,rotation,{collider:false,tag});
      // Shared boundary vertices at every spline node make the floor and walls continuous.
      quad(a.left,a.right,b.left,b.right);
      quad(a.left,b.left,a.left.clone().addScaledVector(a.up,wall),b.left.clone().addScaledVector(b.up,wall));
      quad(a.right,a.right.clone().addScaledVector(a.up,wall),b.right,b.right.clone().addScaledVector(b.up,wall));
    }
    const strip=RAPIER.ColliderDesc.trimesh(new Float32Array(vertices),new Uint32Array(indices)).setFriction(friction).setRestitution(.08);
    staticColliders.push(world.createCollider(strip));
  }
  railPath([[-6.78,7.49,-.88],[-6.05,7.30,-.88],[-4.45,6.86,-.88]],PALETTE.coral,{width:.56,friction:.29,tag:'lift-exit'});
  // The first tangent is aligned with the preceding descent; lateral changes begin gradually.
  const bend=sampleSpline([[-4.45,6.86,-.88],[-3.70,6.65,-.88],[-2.60,6.25,-.37],[-1.15,5.81,-1.29],[.09,5.36,-.41],[1.42,4.94,-.88]],40);
  railPath(bend,PALETTE.cyan,{width:.65,friction:.25,tag:'s-bend'});
  const n=56,k=8,verts=[],faces=[];
  for(let j=0;j<=k;j++){const r=FUNNEL.inner+(FUNNEL.outer-FUNNEL.inner)*j/k;for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;verts.push(FUNNEL.x+r*Math.cos(a),FUNNEL.y+(r-FUNNEL.inner)*.58,FUNNEL.z+r*Math.sin(a))}}
  for(let j=0;j<k;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=(j+1)*(n+1)+i,c=a+1,d=b+1;faces.push(a,c,b,c,d,b)}
  const funnelGeometry=new THREE.BufferGeometry();funnelGeometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));funnelGeometry.setIndex(faces);funnelGeometry.computeVertexNormals();
  scene.add(new THREE.Mesh(funnelGeometry,new THREE.MeshStandardMaterial({color:PALETTE.yellow,roughness:.29,metalness:.05,side:THREE.DoubleSide})));
  staticColliders.push(world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(verts),new Uint32Array(faces)).setFriction(.23)));
  pieces.push({kind:'funnel',radius:FUNNEL.outer,hole:FUNNEL.inner,tag:'vortex'});
  railPath(sampleSpline([[2.6,3.50,-.88],[2.6,3.12,-.88],[1.68,3.01,-.88],[.05,2.83,-.88],[-2.7,2.42,-.88],[-4.87,2.50,-.88],[-3.62,1.54,-.88]],40),PALETTE.violet,{width:.56,tag:'post-funnel'});
  railPath([[-3.62,1.54,-.88],[LOOP.x,LOOP.y-LOOP.radius,-.88]],PALETTE.coral,{width:.47,friction:.16,tag:'loop-entry'});
  const loop=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;loop.push([LOOP.x+LOOP.radius*Math.sin(a),LOOP.y-LOOP.radius*Math.cos(a),LOOP.z])}
  railPath(loop,PALETTE.coral,{width:.48,wall:.31,friction:.13,tag:'gravity-loop'});
  railPath(sampleSpline([[LOOP.x,LOOP.y-LOOP.radius,LOOP.z],[-1.72,1.48,-.88],[-.56,1.10,-.88],[.20,.86,-.88]],16),PALETTE.yellow,{width:.56,tag:'trampoline-entry'});
  railPath([[-.25,.28,-.88],[.5,.20,-.88],[1.45,.18,-.88],[2.75,.11,-.88]],PALETTE.mint,{width:.69,tag:'safety-net'});
  railPath(sampleSpline([[1.38,1.55,-.88],[2.15,1.43,-.88],[3.17,1.17,-.88],[3.42,.96,-.88]],18),PALETTE.cyan,{width:.60,tag:'trampoline-landing'});
  const water=new THREE.Mesh(new THREE.PlaneGeometry(POOL.maxX-POOL.minX,POOL.maxZ-POOL.minZ),new THREE.MeshStandardMaterial({color:PALETTE.cyan,roughness:.22,metalness:.04,transparent:true,opacity:.4,depthWrite:false,side:THREE.DoubleSide}));
  water.rotation.x=-Math.PI/2;water.position.set((POOL.minX+POOL.maxX)/2,POOL.level,(POOL.minZ+POOL.maxZ)/2);water.renderOrder=2;scene.add(water);
  const mid=(POOL.minX+POOL.maxX)/2,zmid=(POOL.minZ+POOL.maxZ)/2,w=POOL.maxX-POOL.minX,d=POOL.maxZ-POOL.minZ;
  block([mid,POOL.floor-.13,zmid],[w+.2,.24,d+.2],PALETTE.dark,undefined,{tag:'basin-floor'});
  for(const z of [POOL.minZ,POOL.maxZ])block([mid,.51,z],[w+.2,.84,.12],PALETTE.teal,undefined,{tag:'basin-wall'});
  block([POOL.minX,.49,zmid],[.12,.82,d+.1],PALETTE.teal,undefined,{tag:'basin-wall'});
  block([POOL.maxX,.33,zmid],[.12,.50,d+.1],PALETTE.teal,undefined,{tag:'basin-exit'});
  railPath([[POOL.maxX,.52,-.88],[7.05,.26,-.88],[7.48,-.42,-.88]],PALETTE.yellow,{width:.62,tag:'pool-exit'});
  railPath([[7.48,-.42,-.88],[5,-.52,-.88],[1,-.52,-.88],[-3.9,-.52,-.88],[LIFT.x,LIFT.bottom-.1,LIFT.z]],PALETTE.violet,{width:.62,wall:.32,tag:'motorized-return'});
  for(const x of [-6.4,-3.5,-.3,2.65,5.8]){
    block([x,3.14,-2],[.12,6.30,.12],PALETTE.cream,undefined,{tag:'support'});
    block([x,-.85,-2],[.7,.12,.7],PALETTE.dark,undefined,{tag:'foot'});
  }
  for(const entry of instances.values()){
    const mesh=new THREE.InstancedMesh(boxGeometry,material(entry.color,entry.metalness),entry.matrices.length);
    entry.matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.instanceMatrix.needsUpdate=true;
    mesh.frustumCulled=false;scene.add(mesh);
  }
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(26,17),new THREE.MeshStandardMaterial({color:0xe4eced,roughness:.86}));floor.rotation.x=-Math.PI/2;floor.position.y=-1.05;scene.add(floor);
  return {pieces,staticColliders,water,dispose(){funnelGeometry.dispose();floor.geometry.dispose();water.geometry.dispose();}};
}
