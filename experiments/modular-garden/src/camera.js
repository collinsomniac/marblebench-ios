import * as THREE from 'three';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const temp = new THREE.Vector3();
const point = new THREE.Vector3();
const direction = new THREE.Vector3(1, 0, 0);
const forward = new THREE.Vector3();
const right = new THREE.Vector3();

/** Camera owns only presentation/input; never writes simulated marble coordinates. */
export class CameraRig {
  constructor(camera, canvas, movementPad, movementThumb) {
    this.camera = camera;
    this.canvas = canvas;
    this.pad = movementPad;
    this.thumb = movementThumb;
    this.mode = 'orbit';
    this.focusId = null;
    this.target = new THREE.Vector3(0, 3.6, 0);
    this.eye = new THREE.Vector3(3, 6.5, 19);
    this.yaw = 0.12;
    this.pitch = 0.22;
    this.distance = 21;
    this.followDistance = 2.25;
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.move = { x: 0, y: 0 };
    this.pointers = new Map();
    this.padPointer = null;
    this.lastPinch = 0;
    this.camera.position.copy(this.eye);
    this.camera.lookAt(this.target);
    this.bind();
  }
  setMode(mode, balls = []) {
    if (!['orbit', 'explore', 'third', 'first'].includes(mode)) throw Error(`Unknown camera mode: ${mode}`);
    if ((mode === 'first' || mode === 'third') && !balls.length) mode = 'orbit';
    if (mode === 'explore') {
      this.eye.copy(this.camera.position);
      this.eye.y = clamp(this.eye.y, 0.7, 15);
      this.yaw = Math.atan2(this.target.x - this.eye.x, this.target.z - this.eye.z);
      this.pitch = 0;
    }
    if (mode === 'third' || mode === 'first') this.focusId = balls.find(b => b.id === this.focusId)?.id ?? balls[0].id;
    this.mode = mode;
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.pad.hidden = mode !== 'explore';
    this.move.x = this.move.y = 0;
    this.thumb.style.transform = 'translate(0px,0px)';
    this.pointers.clear();
    this.lastPinch = 0;
    return mode;
  }
  nextMarble(balls) {
    if (!balls.length) return null;
    const index = balls.findIndex(b => b.id === this.focusId);
    this.focusId = balls[(index + 1) % balls.length].id;
    return this.focusId;
  }
  bind() {
    const canvas = this.canvas;
    // The canvas owns camera gestures. Settings and document UI keep native scrolling.
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.lastPinch = 0;
    });
    canvas.addEventListener('pointermove', e => {
      const old = this.pointers.get(e.pointerId);
      if (!old) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size > 1) {
        const [a, b] = [...this.pointers.values()];
        const pinch = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.lastPinch) {
          const ratio = clamp(this.lastPinch / Math.max(pinch, 1), 0.85, 1.15);
          if (this.mode === 'orbit') this.distance = clamp(this.distance * ratio, 4, 38);
          else if (this.mode === 'third') this.followDistance = clamp(this.followDistance * ratio, 0.9, 6);
        }
        // Two-finger movement pans orbit focus in the camera's horizontal plane.
        if (this.mode === 'orbit') {
          const dx = (e.clientX - old.x) * this.distance * 0.0014;
          const dy = (e.clientY - old.y) * this.distance * 0.0014;
          this.target.x -= Math.cos(this.yaw) * dx;
          this.target.z += Math.sin(this.yaw) * dx;
          this.target.y = clamp(this.target.y + dy, 0.4, 11);
        }
        this.lastPinch = pinch;
        return;
      }
      const dx = e.clientX - old.x, dy = e.clientY - old.y;
      if (this.mode === 'orbit' || this.mode === 'explore') {
        this.yaw -= dx * 0.0055;
        this.pitch = clamp(this.pitch + (this.mode === 'explore' ? -dy : dy) * 0.0045, this.mode === 'orbit' ? -0.25 : -1.15, this.mode === 'orbit' ? 1.2 : 1.15);
      } else {
        this.lookYaw = clamp(this.lookYaw - dx * 0.003, -0.9, 0.9);
        this.lookPitch = clamp(this.lookPitch - dy * 0.003, -0.6, 0.6);
      }
    });
    const finish = e => { this.pointers.delete(e.pointerId); this.lastPinch = 0; };
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);
    canvas.addEventListener('lostpointercapture', finish);
    canvas.addEventListener('wheel', e => {
      if (this.mode === 'orbit' || this.mode === 'third') {
        e.preventDefault();
        const key = this.mode === 'orbit' ? 'distance' : 'followDistance';
        this[key] = clamp(this[key] * Math.exp(e.deltaY * 0.001), key === 'distance' ? 4 : 0.9, key === 'distance' ? 38 : 6);
      }
    }, { passive: false });
    this.pad.style.touchAction = 'none';
    const padMotion = e => {
      const rect = this.pad.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      const length = Math.hypot(dx, dy), scale = Math.min(1, 43 / Math.max(1, length));
      this.move.x = dx * scale / 43;
      this.move.y = -dy * scale / 43;
      this.thumb.style.transform = `translate(${(this.move.x * 43).toFixed(1)}px,${(-this.move.y * 43).toFixed(1)}px)`;
    };
    this.pad.addEventListener('pointerdown', e => {
      if (this.padPointer !== null) return;
      this.padPointer = e.pointerId;
      this.pad.setPointerCapture(e.pointerId);
      padMotion(e);
    });
    this.pad.addEventListener('pointermove', e => { if (this.padPointer === e.pointerId) padMotion(e); });
    const stop = e => {
      if (this.padPointer !== e.pointerId) return;
      this.padPointer = null;
      this.move.x = this.move.y = 0;
      this.thumb.style.transform = 'translate(0px,0px)';
    };
    this.pad.addEventListener('pointerup', stop);
    this.pad.addEventListener('pointercancel', stop);
    this.pad.addEventListener('lostpointercapture', stop);
  }
  update(dt, balls, alpha = 1) {
    dt = clamp(dt, 0, 0.08);
    const blend = 1 - Math.exp(-dt * 7.5);
    let wanted = temp;
    if (this.mode === 'orbit') {
      wanted.set(this.target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance,
        this.target.y + Math.sin(this.pitch) * this.distance,
        this.target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance);
      this.camera.position.lerp(wanted, blend);
      this.camera.lookAt(this.target);
      return;
    }
    if (this.mode === 'explore') {
      forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const speed = 4.5 * dt;
      this.eye.addScaledVector(forward, speed * this.move.y);
      this.eye.addScaledVector(right, speed * this.move.x);
      this.eye.y = clamp(this.eye.y, 0.65, 14);
      this.camera.position.lerp(this.eye, blend);
      point.set(this.camera.position.x + Math.sin(this.yaw) * Math.cos(this.pitch),
        this.camera.position.y + Math.sin(this.pitch),
        this.camera.position.z + Math.cos(this.yaw) * Math.cos(this.pitch));
      this.camera.lookAt(point);
      return;
    }
    const ball = balls.find(b => b.id === this.focusId);
    if (!ball) {
      this.setMode('orbit', balls);
      return;
    }
    const p = ball.body.translation(), previous = ball.previous;
    point.set(previous.x + (p.x - previous.x) * alpha,
      previous.y + (p.y - previous.y) * alpha,
      previous.z + (p.z - previous.z) * alpha);
    const velocity = ball.body.linvel();
    if (Math.hypot(velocity.x, velocity.y, velocity.z) > 0.35) {
      direction.set(velocity.x, velocity.y * 0.5, velocity.z).normalize();
      ball.lastDirection.copy(direction);
    } else direction.copy(ball.lastDirection);
    const heading = Math.atan2(direction.x, direction.z) + this.lookYaw;
    const inclination = clamp(Math.asin(clamp(direction.y, -1, 1)) + this.lookPitch, -0.95, 0.95);
    forward.set(Math.sin(heading) * Math.cos(inclination), Math.sin(inclination), Math.cos(heading) * Math.cos(inclination));
    if (this.mode === 'third') {
      wanted.copy(point).addScaledVector(forward, -this.followDistance);
      wanted.y += Math.max(0.5, this.followDistance * 0.36);
      this.camera.position.lerp(wanted, blend);
      this.camera.lookAt(point.x + forward.x * 0.35, point.y + 0.1 + forward.y * 0.35, point.z + forward.z * 0.35);
    } else {
      // The optical viewpoint sits just ahead of the sphere's surface, not inside its mesh.
      wanted.copy(point).addScaledVector(forward, ball.radius * 1.3);
      wanted.y += ball.radius * 0.25;
      this.camera.position.lerp(wanted, blend);
      this.camera.lookAt(wanted.x + forward.x * 3, wanted.y + forward.y * 3, wanted.z + forward.z * 3);
    }
  }
}
