import * as THREE from "three";
import {
  fitOrbitDistance,
  ORBIT_MIN_DISTANCE,
  ORBIT_MAX_DISTANCE,
} from "./framing.js";

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const FOLLOW_FOV_MULTIPLIER = 1.25;
const temp = new THREE.Vector3();
const point = new THREE.Vector3();
const direction = new THREE.Vector3(1, 0, 0);
const forward = new THREE.Vector3();
const right = new THREE.Vector3();

/** Camera owns presentation/input only; never writes simulated marble coordinates. */
export class CameraRig {
  constructor(camera, canvas, movementPad, movementThumb) {
    this.camera = camera;
    this.baseFov = camera.fov;
    this.canvas = canvas;
    this.pad = movementPad;
    this.thumb = movementThumb;
    this.mode = "orbit";
    this.focusId = null;
    this.target = new THREE.Vector3(0, 0.6, 0.2);
    this.eye = new THREE.Vector3(0.6, 1.1, 2.1);
    this.yaw = 0.3;
    this.pitch = 0.18;
    this.distance = fitOrbitDistance(camera.aspect, this.baseFov);
    this.followDistance = 0.285;
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.move = { x: 0, y: 0 };
    this.keys = new Set();
    this.pointers = new Map();
    this.padPointer = null;
    this.lastPinch = 0;
    this.camera.position.copy(this.eye);
    this.camera.lookAt(this.target);
    this.bind();
  }
  setMode(mode, balls = []) {
    if (!["orbit", "explore", "third", "first"].includes(mode))
      throw Error(`Unknown camera mode: ${mode}`);
    if ((mode === "first" || mode === "third") && !balls.length) mode = "orbit";
    if (mode === "explore") {
      this.eye.copy(this.camera.position);
      this.eye.y = clamp(this.eye.y, 0.07, 1.5);
      this.yaw = Math.atan2(
        this.target.x - this.eye.x,
        this.target.z - this.eye.z,
      );
      this.pitch = 0;
    }
    if (mode === "third" || mode === "first")
      this.focusId =
        balls.find((b) => b.id === this.focusId)?.id ?? balls[0].id;
    this.mode = mode;
    const follow = mode === "first" || mode === "third";
    this.camera.fov = follow
      ? Math.min(105, this.baseFov * FOLLOW_FOV_MULTIPLIER)
      : this.baseFov;
    this.camera.updateProjectionMatrix();
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.pad.hidden = mode !== "explore";
    this.keys.clear();
    this.move.x = this.move.y = 0;
    this.thumb.style.transform = "translate(0px,0px)";
    this.pointers.clear();
    this.lastPinch = 0;
    return mode;
  }
  resetView(balls = []) {
    this.target.set(0, 0.6, 0.2);
    this.yaw = 0.3;
    this.pitch = 0.18;
    this.distance = fitOrbitDistance(this.camera.aspect, this.baseFov);
    this.focusId = null;
    this.setMode("orbit", balls);
    this.clearInput();
  }
  clearInput() {
    this.keys.clear();
    this.pointers.clear();
    this.padPointer = null;
    this.lastPinch = 0;
    this.move.x = this.move.y = 0;
    this.thumb.style.transform = "translate(0px,0px)";
  }
  nextMarble(balls) {
    if (!balls.length) return null;
    const index = balls.findIndex((b) => b.id === this.focusId);
    this.focusId = balls[(index + 1) % balls.length].id;
    return this.focusId;
  }
  bind() {
    const canvas = this.canvas;
    const movementKeys = new Set([
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "ArrowUp",
      "ArrowLeft",
      "ArrowDown",
      "ArrowRight",
    ]);
    window.addEventListener("keydown", (e) => {
      if (
        this.mode !== "explore" ||
        !movementKeys.has(e.code) ||
        e.target.closest?.("input,select,button,textarea,[contenteditable]")
      )
        return;
      e.preventDefault();
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.clearInput());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.clearInput();
    });
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 2) return;
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.lastPinch = 0;
    });
    canvas.addEventListener("pointermove", (e) => {
      const old = this.pointers.get(e.pointerId);
      if (!old) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size > 1) {
        const [a, b] = [...this.pointers.values()];
        const pinch = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.lastPinch) {
          const ratio = clamp(this.lastPinch / Math.max(pinch, 1), 0.85, 1.15);
          if (this.mode === "orbit")
            this.distance = clamp(
              this.distance * ratio,
              ORBIT_MIN_DISTANCE,
              ORBIT_MAX_DISTANCE,
            );
          else if (this.mode === "third")
            this.followDistance = clamp(this.followDistance * ratio, 0.12, 0.7);
        }
        if (this.mode === "orbit") {
          const dx = (e.clientX - old.x) * this.distance * 0.0014;
          const dy = (e.clientY - old.y) * this.distance * 0.0014;
          this.target.x -= Math.cos(this.yaw) * dx;
          this.target.z += Math.sin(this.yaw) * dx;
          this.target.y = clamp(this.target.y + dy, 0.04, 1.4);
        }
        this.lastPinch = pinch;
        return;
      }
      const dx = e.clientX - old.x,
        dy = e.clientY - old.y;
      if (this.mode === "orbit" || this.mode === "explore") {
        this.yaw -= dx * 0.0055;
        this.pitch = clamp(
          this.pitch + (this.mode === "explore" ? -dy : dy) * 0.0045,
          this.mode === "orbit" ? -0.25 : -1.15,
          this.mode === "orbit" ? 1.2 : 1.15,
        );
      } else {
        this.lookYaw = clamp(this.lookYaw - dx * 0.003, -0.9, 0.9);
        this.lookPitch = clamp(this.lookPitch - dy * 0.003, -0.6, 0.6);
      }
    });
    const finish = (e) => {
      this.pointers.delete(e.pointerId);
      this.lastPinch = 0;
    };
    canvas.addEventListener("pointerup", finish);
    canvas.addEventListener("pointercancel", finish);
    canvas.addEventListener("lostpointercapture", finish);
    canvas.addEventListener(
      "wheel",
      (e) => {
        if (this.mode === "orbit" || this.mode === "third") {
          e.preventDefault();
          const key = this.mode === "orbit" ? "distance" : "followDistance";
          this[key] = clamp(
            this[key] * Math.exp(e.deltaY * 0.001),
            key === "distance" ? ORBIT_MIN_DISTANCE : 0.12,
            key === "distance" ? ORBIT_MAX_DISTANCE : 0.7,
          );
        }
      },
      { passive: false },
    );
    this.pad.style.touchAction = "none";
    const padMotion = (e) => {
      const rect = this.pad.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      const length = Math.hypot(dx, dy),
        scale = Math.min(1, 43 / Math.max(1, length));
      this.move.x = (dx * scale) / 43;
      this.move.y = (-dy * scale) / 43;
      this.thumb.style.transform = `translate(${(this.move.x * 43).toFixed(1)}px,${(-this.move.y * 43).toFixed(1)}px)`;
    };
    this.pad.addEventListener("pointerdown", (e) => {
      if (this.padPointer !== null) return;
      this.padPointer = e.pointerId;
      this.pad.setPointerCapture(e.pointerId);
      padMotion(e);
    });
    this.pad.addEventListener("pointermove", (e) => {
      if (this.padPointer === e.pointerId) padMotion(e);
    });
    const stop = (e) => {
      if (this.padPointer !== e.pointerId) return;
      this.padPointer = null;
      this.move.x = this.move.y = 0;
      this.thumb.style.transform = "translate(0px,0px)";
    };
    this.pad.addEventListener("pointerup", stop);
    this.pad.addEventListener("pointercancel", stop);
    this.pad.addEventListener("lostpointercapture", stop);
  }
  update(dt, balls, alpha = 1) {
    dt = clamp(dt, 0, 0.08);
    const blend = 1 - Math.exp(-dt * 7.5);
    let wanted = temp;
    if (this.mode === "orbit") {
      wanted.set(
        this.target.x +
          Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance,
        this.target.y + Math.sin(this.pitch) * this.distance,
        this.target.z +
          Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance,
      );
      this.camera.position.lerp(wanted, blend);
      this.camera.lookAt(this.target);
      return;
    }
    if (this.mode === "explore") {
      forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      right.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
      const speed = 0.45 * dt;
      const down = (...codes) =>
        codes.some((code) => this.keys.has(code)) ? 1 : 0;
      const x =
        this.move.x + down("KeyD", "ArrowRight") - down("KeyA", "ArrowLeft");
      const y =
        this.move.y + down("KeyW", "ArrowUp") - down("KeyS", "ArrowDown");
      const norm = Math.max(1, Math.hypot(x, y));
      this.eye.addScaledVector(forward, (speed * y) / norm);
      this.eye.addScaledVector(right, (speed * x) / norm);
      this.eye.y = clamp(this.eye.y, 0.065, 1.4);
      this.camera.position.lerp(this.eye, blend);
      point.set(
        this.camera.position.x + Math.sin(this.yaw) * Math.cos(this.pitch),
        this.camera.position.y + Math.sin(this.pitch),
        this.camera.position.z + Math.cos(this.yaw) * Math.cos(this.pitch),
      );
      this.camera.lookAt(point);
      return;
    }
    const ball = balls.find((b) => b.id === this.focusId);
    if (!ball) {
      this.setMode("orbit", balls);
      return;
    }
    const p = ball.body.translation(),
      previous = ball.previous;
    point.set(
      previous.x + (p.x - previous.x) * alpha,
      previous.y + (p.y - previous.y) * alpha,
      previous.z + (p.z - previous.z) * alpha,
    );
    const velocity = ball.body.linvel();
    if (Math.hypot(velocity.x, velocity.y, velocity.z) > 0.035) {
      direction.set(velocity.x, velocity.y * 0.5, velocity.z).normalize();
      ball.lastDirection.copy(direction);
    } else direction.copy(ball.lastDirection);
    const heading = Math.atan2(direction.x, direction.z) + this.lookYaw;
    const inclination = clamp(
      Math.asin(clamp(direction.y, -1, 1)) + this.lookPitch,
      -0.95,
      0.95,
    );
    forward.set(
      Math.sin(heading) * Math.cos(inclination),
      Math.sin(inclination),
      Math.cos(heading) * Math.cos(inclination),
    );
    if (this.mode === "third") {
      wanted.copy(point).addScaledVector(forward, -this.followDistance);
      wanted.y += Math.max(0.065, this.followDistance * 0.36);
      this.camera.position.lerp(wanted, blend);
      this.camera.lookAt(
        point.x + forward.x * 0.065,
        point.y + 0.016 + forward.y * 0.065,
        point.z + forward.z * 0.065,
      );
    } else {
      wanted.copy(point).addScaledVector(forward, ball.radius * 1.3);
      wanted.y += ball.radius * 0.5;
      this.camera.position.lerp(wanted, blend);
      this.camera.lookAt(
        wanted.x + forward.x * 0.3,
        wanted.y + forward.y * 0.3,
        wanted.z + forward.z * 0.3,
      );
    }
  }
}
