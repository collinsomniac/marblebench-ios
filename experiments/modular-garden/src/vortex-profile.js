/** Coin-well geometry: a surface of revolution, never a pre-scripted spiral.
 * Radius r is measured from the vertical axis. The hyperbolic-like profile
 * y(r) = throatY + depth * (1-inner/r)/(1-inner/outer) has slope proportional
 * to 1/r². Gravity and real tangential entry velocity produce the orbit.
 * See https://doi.org/10.1119/1.4747481 and UW-Madison Gravity Pit exhibit.
 */
export const VORTEX_PROFILE=Object.freeze({
  inner:.49,outer:1.55,throatY:3.74,rimY:4.99,
  // The approach enters at the rear of the bowl; the rail arrives near +X.
  inletAngle:-1.771,inletHalfAngle:.34,
  guardHeight:.51,guardRadius:1.585,
  radialSegments:30,angularSegments:128
});
const TAU=Math.PI*2;
export function vortexHeight(r,p=VORTEX_PROFILE){
  if(!(r>=p.inner&&r<=p.outer))throw RangeError('radius outside vortex profile');
  return p.throatY+(p.rimY-p.throatY)*(1-p.inner/r)/(1-p.inner/p.outer);
}
export function vortexSlope(r,p=VORTEX_PROFILE){
  if(!(r>=p.inner&&r<=p.outer))throw RangeError('radius outside vortex profile');
  return (p.rimY-p.throatY)*p.inner/((1-p.inner/p.outer)*r*r);
}
function angleDifference(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
/** One indexed mesh for render and static collision. Open throat and rim entry.
 * The lip is an annular, curved sidewall outside the bowl; its mesh triangles
 * are omitted at the inlet sector, not replaced with a force or trigger.
 */
export function createVortexGeometry({x,y,z},p=VORTEX_PROFILE){
  const vertices=[],indices=[],N=p.angularSegments,K=p.radialSegments;
  const vertex=(r,a,h)=>{vertices.push(x+r*Math.cos(a),h,z+r*Math.sin(a));return vertices.length/3-1;};
  const grid=[];
  for(let j=0;j<=K;j++){
    const r=p.inner+(p.outer-p.inner)*j/K,row=[];
    for(let i=0;i<=N;i++)row.push(vertex(r,i*TAU/N,vortexHeight(r,p)));
    grid.push(row);
  }
  for(let j=0;j<K;j++)for(let i=0;i<N;i++){
    const a=grid[j][i],b=grid[j+1][i],c=grid[j][i+1],d=grid[j+1][i+1];
    indices.push(a,c,b,c,d,b);
  }
  let wallSections=0;
  for(let i=0;i<N;i++){
    const a0=i*TAU/N,a1=(i+1)*TAU/N,mid=(a0+a1)/2;
    if(Math.abs(angleDifference(mid,p.inletAngle))<p.inletHalfAngle)continue;
    const b0=vertex(p.guardRadius,a0,p.rimY-.055),b1=vertex(p.guardRadius,a1,p.rimY-.055);
    const t0=vertex(p.guardRadius,a0,p.rimY+p.guardHeight),t1=vertex(p.guardRadius,a1,p.rimY+p.guardHeight);
    indices.push(b0,t0,b1,b1,t0,t1);
    wallSections++;
  }
  return {vertices:new Float32Array(vertices),indices:new Uint32Array(indices),wallSections,
    bowlTriangles:K*N*2,throatRadius:p.inner,rimHeight:p.rimY};
}
