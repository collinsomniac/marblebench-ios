import assert from 'node:assert/strict';
import {makeSimulation,FIXED_STEP,TRACKS,POOL} from '../site/3d/physics.js';
assert.equal(FIXED_STEP,1/120);
assert.ok(TRACKS.length>=5);
const a=makeSimulation(82419),b=makeSimulation(82419);
for(let i=0;i<180;i++){a.step();b.step();}
assert.deepEqual(a.balls.map(({x,y,z})=>[x,y,z]),b.balls.map(({x,y,z})=>[x,y,z]),'same seed must reproduce trajectories');
let waterFrames=0;let maxCount=0;
for(let i=0;i<7200;i++){
 a.step();if(a.balls.some(ball=>ball.water))waterFrames++;
 maxCount=Math.max(maxCount,a.balls.length);
 for(const ball of a.balls)assert.ok(Number.isFinite(ball.x+ball.y+ball.z),'finite marble state');
 assert.ok(a.balls.length<=a.options.capacity,'capacity bound');
 assert.ok(a.droplets.length<=a.options.spray,'particle cap');
}
assert.ok(waterFrames>0,'marbles must enter pool');
assert.ok((a.splashes||0)>0,'pool triggers spray');
a.options.particles=false;a.step();assert.equal(a.droplets.length,0,'disabling particles releases particles');
a.options.capacity=12;a.step();assert.ok(a.balls.length<=12,'shrinking capacity releases marbles');
console.log('PASS 3D deterministic simulation, 5+ tracks, water crossings, splash response, resource caps, finite state.');
console.log(JSON.stringify({waterFrames,splashes:a.splashes,maxCount,steps:a.steps}));
