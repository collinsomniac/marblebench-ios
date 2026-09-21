import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { chute, RADIUS } from "../src/geometry.js";
import { fitOrbitDistance } from "../src/framing.js";

test("tapered connectors report actual clear width and upward contact winding", () => {
  const shape = chute(
    [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)],
    { flat: true, widthAt: (p) => 0.04 + 0.01 * p.x },
  );
  assert.equal(shape.inlet.width, 0.04);
  assert.equal(shape.outlet.width, 0.05);
  assert.ok(shape.inlet.width > 2 * RADIUS);
  const p = shape.geometry.attributes.position,
    idx = shape.geometry.index.array;
  const a = new THREE.Vector3().fromBufferAttribute(p, idx[6]),
    b = new THREE.Vector3().fromBufferAttribute(p, idx[7]),
    c = new THREE.Vector3().fromBufferAttribute(p, idx[8]);
  assert.ok(b.sub(a).cross(c.sub(a)).y > 0, "rolling lane normal must face up");
  shape.geometry.dispose();
});
test("portrait framing increases distance without exceeding navigation limits", () => {
  assert.ok(fitOrbitDistance(0.5, 48) > fitOrbitDistance(1.7, 48));
  assert.ok(fitOrbitDistance(0.2, 48) <= 6);
});
