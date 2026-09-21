import * as THREE from "three";
import {
  createCourse,
  LIFT,
  LOOP,
  WELL,
  WATER,
  SPAWN,
  STAGES,
} from "./course.js";
import { RADIUS, COLORS } from "./geometry.js";
export const DT = 1 / 240;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export class ToySimulation {
  constructor(R, scene = new THREE.Scene(), { flow = 0.2, capacity = 6 } = {}) {
    this.R = R;
    this.scene = scene;
    this.world = new R.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = DT;
    this.world.integrationParameters.lengthUnit = 0.1;
    this.world.integrationParameters.numSolverIterations = 8;
    this.world.integrationParameters.maxCcdSubsteps = 2;
    this.course = createCourse(R, this.world, scene);
    this.balls = [];
    this.sequence = 0;
    this.time = 0;
    this.credit = 0;
    this.events = [];
    this.losses = 0;
    this.laps = 0;
    this.options = { flow, capacity, speed: 1, water: true, elevator: true };
    this.lift = {
      phase: "loading",
      elapsed: 0,
      y: LIFT.bottom,
      startY: LIFT.bottom,
      occupants: new Set(),
    };
    const sphere = new THREE.SphereGeometry(RADIUS, 24, 16);
    this.marbleMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.12,
      metalness: 0.12,
      clearcoat: 1,
    });
    this.mesh = new THREE.InstancedMesh(sphere, this.marbleMaterial, 96);
    this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
    this.dummy = new THREE.Object3D();
    this.colors = COLORS.map((c) => new THREE.Color(c));
    this.shelf = this.world.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased().setTranslation(
        LIFT.x,
        LIFT.bottom,
        LIFT.z,
      ),
    );
    this.shelfGroup = new THREE.Group();
    scene.add(this.shelfGroup);
    this.dynamicResources = [];
    const part = (
      size,
      pos,
      color,
      body = this.shelf,
      group = this.shelfGroup,
      rotation = null,
    ) => {
      let desc = R.ColliderDesc.cuboid(...size.map((v) => v / 2))
        .setTranslation(...pos)
        .setFriction(0.3)
        .setRestitution(0.02);
      if (rotation) desc = desc.setRotation(rotation);
      this.world.createCollider(desc, body);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(...size),
        new THREE.MeshStandardMaterial({ color, roughness: 0.3 }),
      );
      mesh.position.set(...pos);
      if (rotation) mesh.quaternion.copy(rotation);
      group.add(mesh);
      this.dynamicResources.push(mesh);
      return mesh;
    };
    const q = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      -0.1,
    );
    part(
      [0.11, 0.008, 0.054],
      [0, 0, 0],
      COLORS[1],
      this.shelf,
      this.shelfGroup,
      q,
    );
    part([0.008, 0.05, 0.054], [0.012, 0.023, 0], COLORS[1]);

    for (const z of [-0.025, 0.025])
      part([0.12, 0.04, 0.008], [0, 0.016, z], COLORS[1]);
    this.gate = this.world.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased().setTranslation(
        LIFT.x + 0.058,
        LIFT.bottom + 0.02,
        LIFT.z,
      ),
    );
    this.gateGroup = new THREE.Group();
    scene.add(this.gateGroup);
    part(
      [0.008, 0.065, 0.085],
      [0, 0, 0],
      COLORS[0],
      this.gate,
      this.gateGroup,
    );
    this.queueGate = this.world.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased().setTranslation(
        LIFT.x + 0.067,
        0.12,
        LIFT.z + 0.14,
      ),
    );
    this.queueGroup = new THREE.Group();
    scene.add(this.queueGroup);
    part(
      [0.008, 0.085, 0.115],
      [0, 0, 0],
      COLORS[2],
      this.queueGate,
      this.queueGroup,
    );
    this.spawn();
    this.sync(1);
  }
  event(ball, type) {
    const record = {
      id: ball.id,
      type,
      time: +this.time.toFixed(4),
      position: { ...ball.body.translation() },
    };
    this.events.push(record);
    if (this.events.length > 1000) this.events.shift();
    ball.events.push(type);
    if (ball.events.length > 70) ball.events.shift();
    return record;
  }
  spawn() {
    if (
      this.balls.length >= this.options.capacity ||
      this.balls.some(
        (b) =>
          Math.hypot(
            b.body.translation().x - SPAWN.x,
            b.body.translation().y - SPAWN.y,
            b.body.translation().z - SPAWN.z,
          ) <
          RADIUS * 3,
      )
    )
      return false;
    const R = this.R,
      body = this.world.createRigidBody(
        R.RigidBodyDesc.dynamic()
          .setTranslation(SPAWN.x, SPAWN.y, SPAWN.z)
          .setCcdEnabled(true)
          .setLinearDamping(0.006)
          .setAngularDamping(0.006),
      );
    this.world.createCollider(
      R.ColliderDesc.ball(RADIUS)
        .setDensity(2500)
        .setFriction(0.28)
        .setRestitution(0.06),
      body,
    );
    this.balls.push({
      id: ++this.sequence,
      body,
      previous: { ...SPAWN },
      radius: RADIUS,
      lastDirection: new THREE.Vector3(1, 0, 0),
      stage: 0,
      events: [],
      wet: false,
      laps: 0,
    });
    return true;
  }
  updateLift() {
    const lift = this.lift;
    if (this.options.elevator) lift.elapsed += DT;
    const inside = this.balls.filter((b) => {
      const p = b.body.translation();
      return (
        Math.abs(p.x - LIFT.x) < 0.039 &&
        Math.abs(p.z - LIFT.z) < 0.04 &&
        p.y > lift.y &&
        p.y < lift.y + 0.05
      );
    });
    if (this.options.elevator) {
      if (lift.phase === "loading" && inside.length && lift.elapsed > 0.6) {
        lift.phase = "closing";
        lift.elapsed = 0;
        lift.startY = lift.y;
        lift.occupants = new Set(inside.map((b) => b.id));
        inside.forEach((b) => {
          if (b.stage === 5) {
            this.event(b, STAGES[5]);
            b.stage = 6;
          }
        });
      } else if (lift.phase === "closing" && lift.elapsed > 0.7) {
        lift.phase = "rising";
        lift.elapsed = 0;
      } else if (lift.phase === "rising") {
        const u = clamp(lift.elapsed / 5, 0, 1);
        lift.y = lift.startY + (LIFT.top - lift.startY) * (u * u * (3 - 2 * u));
        if (u === 1) {
          lift.phase = "unloading";
          lift.elapsed = 0;
        }
      } else if (
        lift.phase === "unloading" &&
        lift.elapsed > 1.5 &&
        inside.length === 0
      ) {
        lift.phase = "lowering";
        lift.elapsed = 0;
        lift.startY = lift.y;
      } else if (lift.phase === "lowering") {
        const u = clamp(lift.elapsed / 3, 0, 1);
        lift.y =
          lift.startY + (LIFT.bottom - lift.startY) * (u * u * (3 - 2 * u));
        if (u === 1) {
          lift.phase = "loading";
          lift.elapsed = 0;
        }
      }
    }
    this.queueGate.setNextKinematicTranslation({
      x: LIFT.x + 0.067,
      y: 0.12,
      z:
        LIFT.z +
        (lift.phase === "loading"
          ? 0.14
          : lift.phase === "closing"
            ? 0.14 * (1 - clamp(lift.elapsed / 0.6, 0, 1))
            : 0),
    });
    this.shelf.setNextKinematicTranslation({ x: LIFT.x, y: lift.y, z: LIFT.z });
    const open = lift.phase === "loading" || lift.phase === "unloading";
    this.gate.setNextKinematicTranslation({
      x: LIFT.x + 0.058,
      y: lift.y + 0.02,
      z: LIFT.z + (open ? 0.11 : 0),
    });
  }
  step() {
    this.time += DT;
    this.updateLift();
    for (const b of this.balls) {
      const p = b.body.translation(),
        v = b.body.linvel();
      b.previous = { ...p };
      b.body.resetForces(false);
      const inBowl =
        Math.hypot(p.x - WELL.x, p.z - WELL.z) < WELL.outer + 0.01 &&
        p.y > WELL.y - WELL.depth &&
        p.y < WELL.y + 0.05;
      b.body.setAngularDamping(inBowl ? 0.8 : 0.006);
      const h = clamp(WATER.level - (p.y - RADIUS), 0, 2 * RADIUS);
      const wet =
        this.options.water &&
        p.x > WATER.minX &&
        p.x < WATER.maxX &&
        p.z > WATER.minZ &&
        p.z < WATER.maxZ &&
        h > 0 &&
        p.y > 0.12;
      if (wet) {
        const volume = Math.PI * h * h * (RADIUS - h / 3),
          mass = b.body.mass();
        b.body.addForce(
          {
            x: -v.x * mass * 0.7,
            y: 1000 * 9.81 * volume - v.y * mass * 0.7,
            z: -v.z * mass * 0.7,
          },
          true,
        );
      }
      b.wet = wet;
    }
    this.world.step();
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i],
        p = b.body.translation();
      if (
        !Number.isFinite(p.x + p.y + p.z) ||
        p.y < -0.15 ||
        Math.abs(p.x) > 1.5 ||
        Math.abs(p.z) > 1.5
      ) {
        this.event(b, "Lost");
        this.world.removeRigidBody(b.body);
        this.balls.splice(i, 1);
        this.losses++;
        continue;
      }
      const gates = [
        p.x > LOOP.x - 0.035 && p.x < LOOP.x + 0.04 && p.y < LOOP.bottom + 0.06,
        p.y > LOOP.bottom + 2 * LOOP.radius - RADIUS - 0.016 &&
          Math.abs(p.x - LOOP.x) < 0.04,
        p.x > LOOP.x + 0.075 &&
          p.y < LOOP.bottom + 0.065 &&
          p.z < LOOP.z - LOOP.pitch * 0.7,
        Math.hypot(p.x - WELL.x, p.z - WELL.z) < WELL.outer &&
          p.y < WELL.y + 0.03,
        b.wet ||
          (!this.options.water &&
            p.x > WATER.minX &&
            p.x < WATER.maxX &&
            p.z > WATER.minZ &&
            p.z < WATER.maxZ &&
            p.y < 0.26),
      ];
      if (b.stage < 5 && gates[b.stage]) {
        this.event(b, STAGES[b.stage]);
        b.stage++;
      }
      if (b.stage === 6 && p.x > LIFT.x + 0.065 && p.y > LIFT.top - 0.045) {
        this.event(b, STAGES[6]);
        b.stage = 0;
        b.laps++;
        this.laps++;
      }
    }
    this.credit = Math.min(1, this.credit + DT * this.options.flow);
    if (this.credit >= 1 && this.spawn()) this.credit = 0;
  }
  sync(alpha = 1, hiddenId = null) {
    this.mesh.count = this.balls.length;
    for (let i = 0; i < this.balls.length; i++) {
      const b = this.balls[i],
        p = b.body.translation(),
        q = b.body.rotation();
      this.dummy.position.set(
        b.previous.x + (p.x - b.previous.x) * alpha,
        b.previous.y + (p.y - b.previous.y) * alpha,
        b.previous.z + (p.z - b.previous.z) * alpha,
      );
      this.dummy.quaternion.copy(q);
      this.dummy.scale.setScalar(b.id === hiddenId ? 0 : 1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, this.colors[b.id % 5]);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.shelfGroup.position.set(LIFT.x, this.lift.y, LIFT.z);
    this.gateGroup.position.copy(this.gate.translation());
    this.queueGroup.position.copy(this.queueGate.translation());
  }
  snapshot() {
    return {
      seconds: +this.time.toFixed(2),
      balls: this.balls.length,
      spawned: this.sequence,
      losses: this.losses,
      laps: this.laps,
      lift: this.lift.phase,
      stages: Object.fromEntries(
        STAGES.map((s) => [s, this.events.filter((e) => e.type === s).length]),
      ),
      settings: { ...this.options },
    };
  }
  dispose() {
    this.world.free();
    this.course.dispose();
    this.scene.remove(
      this.mesh,
      this.shelfGroup,
      this.gateGroup,
      this.queueGroup,
    );
    this.mesh.geometry.dispose();
    this.marbleMaterial.dispose();
    this.dynamicResources.forEach((m) => {
      m.geometry.dispose();
      m.material.dispose();
    });
  }
}
