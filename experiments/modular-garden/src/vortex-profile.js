/** Axisymmetric coin well (no prescribed spiral, inward force or groove).
 * The short inlet apron extends the bowl surface out to the incoming rail.
 * Everywhere INSIDE outer radius, y(r) depends ONLY on radius. The apron is a
 * smooth geometric handoff rather than a track controlling the orbit.
 * Profile reference: https://doi.org/10.1119/1.4747481
 */
export const VORTEX_PROFILE=Object.freeze({
  inner:.49,outer:1.55,throatY:3.74,rimY:4.99,
  inletAngle:-2.30,inletHalfAngle:.43,
  apronRadius:1.96,apronBands:10,
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
function inInlet(a,p){return Math.abs(angleDifference(a,p.inletAngle))<p.inletHalfAngle;}
/** Bowl, short tangential entry apron and partial physical retaining lip.
 * All surfaces use shared indexed vertices at adjoining radial sections.
 * There is no center disc, invisible guidance rail or position-triggered action.
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
  function join(a,b){for(let i=0;i<N;i++){
    const c=a[i],d=b[i],e=a[i+1],f=b[i+1];
    indices.push(c,e,d,e,f,d);
  }}
  for(let j=0;j<K;j++)join(grid[j],grid[j+1]);
  // A C1-continuous radial extension only where the approach enters. The bowl
  // remains rotationally symmetric: no spiral channel exists in the well.
  let last=grid[K],apronTriangles=0;
  for(let j=1;j<=p.apronBands;j++){
    const r=p.outer+(p.apronRadius-p.outer)*j/p.apronBands;
    const height=p.rimY+vortexSlope(p.outer,p)*(r-p.outer),row=[];
    for(let i=0;i<=N;i++)row.push(vertex(r,i*TAU/N,height));
    for(let i=0;i<N;i++)if(inInlet((i+.5)*TAU/N,p)){
      const a=last[i],b=last[i+1],c=row[i],d=row[i+1];
      indices.push(a,b,c,b,d,c);apronTriangles+=2;
    }
    last=row;
  }
  let wallSections=0;
  for(let i=0;i<N;i++){
    const a0=i*TAU/N,a1=(i+1)*TAU/N,mid=(a0+a1)/2;
    if(inInlet(mid,p))continue;
    const b0=vertex(p.guardRadius,a0,p.rimY-.055),b1=vertex(p.guardRadius,a1,p.rimY-.055);
    const t0=vertex(p.guardRadius,a0,p.rimY+p.guardHeight),t1=vertex(p.guardRadius,a1,p.rimY+p.guardHeight);
    indices.push(b0,t0,b1,b1,t0,t1);wallSections++;
  }
  return {vertices:new Float32Array(vertices),indices:new Uint32Array(indices),wallSections,apronTriangles,
    bowlTriangles:K*N*2,throatRadius:p.inner,rimHeight:p.rimY};
}
