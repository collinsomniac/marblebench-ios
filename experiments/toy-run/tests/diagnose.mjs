import R from "@dimforge/rapier3d-compat";
import { ToySimulation, DT } from "../src/simulation.js";
await R.init();
const sim = new ToySimulation(R, undefined, {
  flow: Number(process.env.FLOW ?? 0),
  capacity: Number(process.env.CAPACITY ?? 24),
});
for (let i = 0; i < 240 * Number(process.env.SECONDS ?? 40); i++) {
  sim.step();
  if (i % 240 === 0)
    console.log(
      JSON.stringify({
        t: sim.time.toFixed(2),
        lift: sim.lift.phase,
        balls: sim.balls
          .slice(0, 3)
          .map((b) => ({
            id: b.id,
            stage: b.stage,
            p: b.body.translation(),
            v: b.body.linvel(),
          })),
      }),
    );
}
console.log(JSON.stringify(sim.snapshot()));
console.log(JSON.stringify(sim.events));
sim.dispose();
