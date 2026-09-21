import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { CameraRig } from "../src/camera.js";
class Element extends EventTarget {
  style = {};
  hidden = false;
  setPointerCapture() {}
}
function fixture() {
  globalThis.window = new EventTarget();
  globalThis.document = new EventTarget();
  const camera = new THREE.PerspectiveCamera(48, 1.5, 0.003, 20);
  return {
    camera,
    rig: new CameraRig(camera, new Element(), new Element(), new Element()),
  };
}
function key(type, code) {
  const e = new Event(type, { cancelable: true });
  e.code = code;
  window.dispatchEvent(e);
}
test("Explore keyboard input moves the camera and blur releases held keys", () => {
  const { rig } = fixture();
  rig.setMode("explore");
  const start = rig.eye.clone();
  key("keydown", "KeyW");
  rig.update(0.08, []);
  assert.ok(rig.eye.distanceTo(start) > 0.03);
  window.dispatchEvent(new Event("blur"));
  const stopped = rig.eye.clone();
  rig.update(0.08, []);
  assert.equal(rig.eye.distanceTo(stopped), 0);
});
test("reset restores the orbit target and FOV after exploration", () => {
  const { rig, camera } = fixture();
  rig.target.set(1, 1, 1);
  rig.yaw = 2;
  rig.setMode("first", [{ id: 1 }]);
  assert.equal(camera.fov, 60);
  rig.resetView([]);
  assert.equal(rig.mode, "orbit");
  assert.equal(camera.fov, 48);
  assert.deepEqual(rig.target.toArray(), [0, 0.6, 0.2]);
  assert.equal(rig.yaw, 0.3);
});

test("Explore right input strafes toward camera right", () => {
  const { rig } = fixture();
  rig.setMode("explore");
  rig.yaw = 0;
  const x = rig.eye.x;
  key("keydown", "KeyD");
  rig.update(0.08, []);
  assert.ok(rig.eye.x < x, "when looking +Z, screen-right points toward -X");
});
