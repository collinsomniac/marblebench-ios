import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { chute, spline, bowl, addCollider, COLORS, UNIT } from "./geometry.js";

export const LIFT = { x: -0.53, z: 0.2441, bottom: 0.084, top: 1.016 };
export const WELL = {
  x: 0.4,
  y: 0.475,
  z: 0.24,
  outer: 0.145,
  inner: 0.028,
  depth: 0.085,
};
export const LOOP = {
  x: 0.03,
  bottom: 0.653,
  radius: 0.049,
  z: 0.2,
  pitch: 0.042,
};
export const WATER = {
  minX: -0.16,
  maxX: 0.16,
  minZ: 0.31,
  maxZ: 0.4,
  level: 0.234,
};
export const SPAWN = { x: -0.477, y: 1.029, z: 0.2441 };
export const STAGES = [
  "Loop entry",
  "Loop apex",
  "Loop exit",
  "Funnel",
  "Water",
  "Lift pickup",
  "Lift delivery",
];
export function createCourse(R, world, scene) {
  const materials = COLORS.map(
    (color) =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.25,
        metalness: 0,
        clearcoat: 0.45,
        clearcoatRoughness: 0.22,
        side: THREE.DoubleSide,
      }),
  );
  const batches = materials.map(() => []),
    tracks = [],
    colliders = [],
    owned = [];
  function surface(geometry, color = 0, physics = true) {
    geometry.deleteAttribute("uv");
    batches[color].push(geometry);
    if (physics)
      colliders.push(addCollider(R, world, geometry, { friction: 0.13 }));
    return geometry;
  }
  function track(id, points, color, options = {}) {
    const shape = chute(points, options);
    if (options.roof) {
      // Keep one continuous collision mesh; show the retaining lid as clear plastic.
      colliders.push(addCollider(R, world, shape.geometry, { friction: 0.13 }));
      const indices = Array.from(shape.geometry.index.array),
        base = [],
        lid = [];
      for (let i = 0; i < indices.length; i += 6)
        (i % 24 === 18 ? lid : base).push(...indices.slice(i, i + 6));
      const cover = shape.geometry.clone();
      cover.setIndex(lid);
      const material = new THREE.MeshPhysicalMaterial({
        color: 0xcbe4f4,
        transparent: true,
        opacity: 0.22,
        roughness: 0.18,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(cover, material);
      scene?.add(mesh);
      owned.push(mesh);
      const lane = shape.geometry.clone();
      lane.setIndex(base);
      surface(lane, color, false);
      shape.geometry.dispose();
    } else surface(shape.geometry, color);
    tracks.push({ id, ...shape });
    return shape;
  }
  const map = (p) =>
    new THREE.Vector3(
      p[0] * 0.07 + 0.2099,
      p[1] * 0.07 + 0.5459,
      p[2] * 0.07 + 0.2616,
    );
  const raw = [
    [-6.2, 6.2, -0.25],
    [-5.6, 5.75, -0.31],
    [-4.7, 2.95, -0.47],
    [-4.02, 1.84, -0.67],
    [-3.63, 1.56, -0.74],
    [-3.2, 1.53, -0.79],
    [-2.57, 1.53, -0.88],
  ];
  const curve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-0.48, 1.011, 0.2441),
      new THREE.Vector3(-0.4, 1.006, 0.2441),
      new THREE.Vector3(-0.3, 0.998, 0.2441),
      ...raw.map(map),
    ],
    false,
    "centripetal",
  );
  const entry = Array.from({ length: 73 }, (_, i) => curve.getPoint(i / 72));
  const loop = Array.from({ length: 129 }, (_, i) => {
    const a = (i / 128) * Math.PI * 2;
    return new THREE.Vector3(
      LOOP.x + LOOP.radius * Math.sin(a),
      LOOP.bottom + LOOP.radius * (1 - Math.cos(a)),
      LOOP.z - (LOOP.pitch * i) / 128,
    );
  });
  track("gravity-ramp", entry, 0, {
    width: 0.03,
    wall: 0.04,
    flat: true,
    roof: true,
    frame: "depth",
    widthAt: (p) =>
      0.03 + 0.012 * Math.max(0, Math.min(1, (-0.4 - p.x) / 0.08)),
  });
  track("loop", loop, 2, {
    width: 0.0336,
    wall: 0.0217,
    flat: true,
    frame: "depth",
  });
  const outletRaw = [
    [-2.57, 1.53, -1.48],
    [-2.15, 1.5, -1.535],
    [-1.7, 1.38, -1.58],
    [-1.2, 1.15, -1.58],
  ];
  const outCurve = new THREE.CatmullRomCurve3(
    outletRaw.map(map),
    false,
    "centripetal",
  );
  track(
    "loop-outlet",
    Array.from({ length: 29 }, (_, i) => outCurve.getPoint(i / 28)),
    1,
    { width: 0.0455, wall: 0.0245, flat: true, frame: "depth" },
  );
  track(
    "bowl-approach",
    spline(
      [
        [1.259, 6.264, 1.51],
        [2.2, 5.7, 1.3],
        [3.0, 4.95, 1.16],
        [3.5, 4.76, 1.25],
      ],
      64,
    ),
    1,
    { width: 0.06, wall: 0.035 },
  );
  surface(bowl(WELL), 3);
  // A generous sloping receiver below the real throat; no position corrections.
  track(
    "collector",
    spline(
      [
        [4.65, 3.6, 2.4],
        [4, 3.55, 2.4],
        [3.3, 3.3, 2.4],
        [2.3, 2.75, 3.2],
        [1.6, 2.52, 3.5],
        [0.3, 2.2, 3.5],
        [-1.6, 1.76, 3.5],
        [-3.2, 1.25, 2.441],
        [-4.2, 1.03, 2.441],
        [-4.8, 0.94, 2.441],
      ],
      100,
    ),
    4,
    {
      width: 0.09,
      wall: 0.055,
      initialSide: [0, 0, -1],
      widthAt: (p) =>
        0.032 + 0.058 * Math.max(0, Math.min(1, (p.x + 0.48) / 0.3)),
    },
  );
  // The bowl's vertical drop is caught by a short receiver end wall.
  const back = new THREE.BoxGeometry(0.012, 0.1, 0.095);
  back.translate(0.467, 0.395, 0.24);
  surface(back, 4);
  // Repeated stacked sleeves. Non-contact decorative supports are intentionally
  // outside the rolling envelope; only track/mechanism geometry enters physics.
  const towers = [
    [-5.9, 10.3, 2.441],
    [-4, 9.95, 2.441],
    [-2.1, 9.35, 2.7],
    [0.3, 6.1, 2.7],
    [2.4, 5.4, 0.6],
    [4, 3.4, 2.4],
    [1.4, 2.3, 4.1],
    [-3.8, 1.0, 2.441],
  ];
  for (let n = 0; n < towers.length; n++) {
    const [x, height, z] = towers[n];
    for (let y = 0.35, k = 0; y < height - 0.1; y += 0.62, k++) {
      const h = Math.min(0.6, height - y),
        g = new THREE.CylinderGeometry(0.023, 0.023, h * UNIT, 24);
      g.translate(x * UNIT, (y + h / 2) * UNIT, z * UNIT);
      surface(g, (k + n) % 5, false);
      const collar = new THREE.TorusGeometry(0.023, 0.0025, 6, 24);
      collar.rotateX(Math.PI / 2);
      collar.translate(x * UNIT, y * UNIT, z * UNIT);
      surface(collar, (k + n) % 5, false);
    }
    const foot = new THREE.CylinderGeometry(0.039, 0.049, 0.025, 32);
    foot.translate(x * UNIT, 0.017, z * UNIT);
    surface(foot, n % 5, false);
  }
  // Footprint/base tray unifies the construction without an expensive shadow pass.
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0xe8e0ce,
    roughness: 0.8,
  });
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 0.025, 0.76),
    baseMat,
  );
  base.position.set(-0.02, -0.012, 0.21);
  scene?.add(base);
  owned.push(base);
  const meshes = [];
  batches.forEach((parts, i) => {
    if (!parts.length) return;
    const geo = mergeGeometries(parts, false);
    const mesh = new THREE.Mesh(geo, materials[i]);
    scene?.add(mesh);
    meshes.push(mesh);
    parts.forEach((g) => g.dispose());
  });
  const waterGeo = new THREE.PlaneGeometry(
    WATER.maxX - WATER.minX,
    WATER.maxZ - WATER.minZ,
    36,
    12,
  );
  waterGeo.rotateX(-Math.PI / 2);
  waterGeo.translate(0, WATER.level, (WATER.minZ + WATER.maxZ) / 2);
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x60c9df,
    roughness: 0.13,
    metalness: 0.15,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
    side: THREE.DoubleSide,
    clearcoat: 1,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.renderOrder = 2;
  scene?.add(water);
  owned.push(water);
  return {
    tracks,
    colliders,
    water,
    meshes,
    materials,
    dispose() {
      for (const m of [...meshes, ...owned]) {
        scene?.remove(m);
        m.geometry.dispose();
        if (owned.includes(m)) m.material.dispose();
      }
      materials.forEach((m) => m.dispose());
      baseMat.dispose();
      waterMat.dispose();
    },
  };
}
