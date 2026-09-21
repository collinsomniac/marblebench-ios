import * as THREE from "three";

// Design drawings use decimetres; all exported geometry and physics use metres.
export const UNIT = 0.1;
export const RADIUS = 0.012;
export const COLORS = [0xe93838, 0xffc928, 0x1678dd, 0x15aa63, 0x8f48cd];
export const vec = (p) => new THREE.Vector3(...p).multiplyScalar(UNIT);
export function spline(points, segments = 64) {
  const curve = new THREE.CatmullRomCurve3(
    points.map(vec),
    false,
    "centripetal",
  );
  return Array.from({ length: segments + 1 }, (_, i) =>
    curve.getPoint(i / segments),
  );
}

/** Parallel transport keeps the same cross-section through vertical tangents.
 * The visible contact surface and Rapier trimesh use these exact vertices.
 */
export function chute(
  points,
  {
    width = 0.052,
    wall = 0.035,
    initialSide = [0, 0, 1],
    frame = "transport",
    covered = false,
    round = false,
    flat = false,
    roof = false,
    widthAt = null,
  } = {},
) {
  const tangents = points.map((p, i) =>
    points[Math.min(i + 1, points.length - 1)]
      .clone()
      .sub(points[Math.max(0, i - 1)])
      .normalize(),
  );
  let side = new THREE.Vector3(...initialSide);
  side.addScaledVector(tangents[0], -side.dot(tangents[0])).normalize();
  if (side.lengthSq() < 0.9) throw Error("Degenerate inlet frame");
  const frames = [],
    positions = [],
    indices = [];
  // Rounded U section: flat rolling lane with curved shoulders and vertical lips.
  const profile = [
    [-width / 2, wall],
    [-width / 2, 0.009],
    [-width / 2 + 0.006, 0.002],
    [-width / 2 + 0.012, 0],
    [width / 2 - 0.012, 0],
    [width / 2 - 0.006, 0.002],
    [width / 2, 0.009],
    [width / 2, wall],
  ];
  if (flat) {
    profile.length = 0;
    profile.push(
      [-width / 2, wall],
      [-width / 2, 0],
      [width / 2, 0],
      [width / 2, wall],
    );
  }
  if (roof) profile.push(profile[0]);
  if (covered || round) {
    profile.length = 0;
    const span = covered ? Math.PI : Math.PI * 0.65;
    for (let i = 0; i <= 24; i++) {
      const a = -span + (i / 24) * span * 2;
      profile.push([
        (width / 2) * Math.sin(a),
        (width / 2) * (1 - Math.cos(a)),
      ]);
    }
  }
  for (let i = 0; i < points.length; i++) {
    if (frame === "depth") side.set(0, 0, 1);
    else if (i)
      side.applyQuaternion(
        new THREE.Quaternion().setFromUnitVectors(tangents[i - 1], tangents[i]),
      );
    side.addScaledVector(tangents[i], -side.dot(tangents[i])).normalize();
    const normal = new THREE.Vector3()
      .crossVectors(side, tangents[i])
      .normalize();
    frames.push({
      point: points[i],
      tangent: tangents[i],
      side: side.clone(),
      normal,
    });
    for (const [u, v] of profile)
      positions.push(
        ...points[i]
          .clone()
          .addScaledVector(
            side,
            u * (widthAt ? widthAt(points[i], i) / width : 1),
          )
          .addScaledVector(normal, v)
          .toArray(),
      );
  }
  const n = profile.length;
  for (let i = 1; i < points.length; i++)
    for (let j = 0; j < n - 1; j++) {
      const a = (i - 1) * n + j,
        b = i * n + j;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const connector = (i) => ({
    position: points[i].toArray(),
    tangent: tangents[i].toArray(),
    normal: frames[i].normal.toArray(),
    width: widthAt ? widthAt(points[i], i) : width,
    marbleRadius: RADIUS,
  });
  return {
    geometry,
    points,
    frames,
    inlet: connector(0),
    outlet: connector(points.length - 1),
  };
}
export function bowl({ x, y, z, outer = 0.145, inner = 0.028, depth = 0.085 }) {
  const positions = [],
    indices = [],
    rings = 24,
    slices = 96;
  for (let j = 0; j <= rings; j++) {
    const r = inner + ((outer - inner) * j) / rings;
    const h = y - depth + (depth * (1 - inner / r)) / (1 - inner / outer);
    for (let i = 0; i <= slices; i++) {
      const a = (i / slices) * Math.PI * 2;
      positions.push(x + r * Math.cos(a), h, z + r * Math.sin(a));
    }
  }
  for (let j = 0; j < rings; j++)
    for (let i = 0; i < slices; i++) {
      const a = j * (slices + 1) + i,
        b = a + slices + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  // Full raised lip, including inlet: the entry chute lands above it.
  const base = positions.length / 3;
  for (let i = 0; i <= slices; i++) {
    const a = (i / slices) * Math.PI * 2;
    for (const h of [y - 0.002, y + 0.07])
      positions.push(x + outer * Math.cos(a), h, z + outer * Math.sin(a));
  }
  for (let i = 0; i < slices; i++) {
    const angle = ((i + 0.5) / slices) * Math.PI * 2;
    if (Math.abs(angle - 4.13) < 0.2) continue;
    const a = base + i * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
export function addCollider(
  R,
  world,
  geometry,
  { friction = 0.22, restitution = 0.02 } = {},
) {
  const vertices = geometry.attributes.position.array;
  const indices = new Uint32Array(geometry.index.array);
  return world.createCollider(
    R.ColliderDesc.trimesh(vertices, indices, R.TriMeshFlags.FIX_INTERNAL_EDGES)
      .setFriction(friction)
      .setRestitution(restitution),
  );
}
