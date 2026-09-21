import test from "node:test";
import assert from "node:assert/strict";
import R from "@dimforge/rapier3d-compat";
import { ToySimulation, DT } from "../src/simulation.js";
import { STAGES } from "../src/course.js";
await R.init();
const advance = (sim, seconds) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) sim.step();
};

test("the same glass marble completes repeated physical circuits", () => {
  const sim = new ToySimulation(R, undefined, { flow: 0, capacity: 1 });
  try {
    const body = sim.balls[0].body;
    advance(sim, 120);
    assert.equal(sim.losses, 0);
    assert.equal(sim.sequence, 1);
    assert.equal(sim.balls[0].body, body);
    assert.ok(sim.laps >= 6, JSON.stringify(sim.snapshot()));
    const events = sim.events.filter((e) => e.id === 1).map((e) => e.type);
    for (let i = 0; i < STAGES.length * 6; i++)
      assert.equal(events[i], STAGES[i % STAGES.length]);
    assert.ok(
      sim.events.filter((e) => e.type === "Lift delivery").at(-1).time > 100,
    );
  } finally {
    sim.dispose();
  }
});

test("six-marble default sustains circulation without replacement or escapes", () => {
  const sim = new ToySimulation(R);
  try {
    advance(sim, 180);
    assert.equal(sim.losses, 0, JSON.stringify(sim.snapshot()));
    assert.equal(sim.sequence, 6);
    assert.equal(sim.balls.length, 6);
    assert.ok(sim.laps >= 15, JSON.stringify(sim.snapshot()));
    assert.ok(
      sim.events.filter((e) => e.type === "Lift delivery").at(-1).time > 160,
      "must still circulate at the end",
    );
    for (const ball of sim.balls)
      assert.ok(ball.laps >= 1, `marble ${ball.id} never returned`);
  } finally {
    sim.dispose();
  }
});

test("turning off lift power freezes its clock and resumes without a position jump", () => {
  const sim = new ToySimulation(R, undefined, { flow: 0, capacity: 1 });
  try {
    while (sim.time < 40 && sim.lift.phase !== "rising") sim.step();
    assert.equal(sim.lift.phase, "rising");
    advance(sim, 1);
    sim.options.elevator = false;
    const y = sim.lift.y,
      elapsed = sim.lift.elapsed;
    advance(sim, 4);
    assert.equal(sim.lift.y, y);
    assert.equal(sim.lift.elapsed, elapsed);
    sim.options.elevator = true;
    sim.step();
    assert.ok(Math.abs(sim.lift.y - y) < 0.002);
  } finally {
    sim.dispose();
  }
});

test("a dry channel preserves physical circulation and stage accounting", () => {
  const sim = new ToySimulation(R, undefined, { flow: 0, capacity: 1 });
  try {
    sim.options.water = false;
    advance(sim, 60);
    assert.equal(sim.losses, 0);
    assert.ok(sim.laps >= 2, JSON.stringify(sim.snapshot()));
    assert.equal(sim.balls[0].wet, false);
  } finally {
    sim.dispose();
  }
});
