import {performance} from 'node:perf_hooks';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {GardenSimulation,FIXED_DT} from '../src/physics.js';

// Node/Rapier CPU throughput only. This is NOT an iPhone, GPU, Safari, thermal,
// or end-to-end frame benchmark. No performance threshold is asserted here.
await RAPIER.init();
const percent=(sorted,q)=>sorted[Math.min(sorted.length-1,Math.floor(q*(sorted.length-1)))];
const scenarios=[{flow:.48,capacity:24},{flow:1.2,capacity:48},{flow:2.4,capacity:90}];
const result={kind:'headless-rapier-cpu',fixedDt:FIXED_DT,node:process.version,platform:process.platform,arch:process.arch,warmupSteps:1200,measuredSteps:2400,scenarios:[]};
for(const config of scenarios){
  const sim=new GardenSimulation(RAPIER,new THREE.Scene());
  sim.options.flow=config.flow;sim.options.capacity=config.capacity;
  for(let i=0;i<result.warmupSteps;i++)sim.step();
  const measured=[],start=performance.now();let ballSum=0,peakBalls=0;
  const initialLosses=sim.losses,initialWater=sim.waterImpacts;
  for(let i=0;i<result.measuredSteps;i++){
    const before=performance.now();sim.step();measured.push(performance.now()-before);
    ballSum+=sim.balls.length;peakBalls=Math.max(peakBalls,sim.balls.length);
  }
  const wallMs=performance.now()-start;measured.sort((a,b)=>a-b);
  result.scenarios.push({flow:config.flow,capacity:config.capacity,averageBalls:+(ballSum/result.measuredSteps).toFixed(2),peakBalls,
    p50StepMs:+percent(measured,.5).toFixed(4),p95StepMs:+percent(measured,.95).toFixed(4),
    wallMs:+wallMs.toFixed(2),headlessSimSecondsPerWallSecond:+((result.measuredSteps*FIXED_DT)/(wallMs/1000)).toFixed(2),
    losses:sim.losses-initialLosses,waterEntries:sim.waterImpacts-initialWater,rssMB:+(process.memoryUsage().rss/1048576).toFixed(1)});
  sim.dispose();
}
console.log(JSON.stringify(result,null,2));
