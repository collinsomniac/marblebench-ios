import test from 'node:test';
import assert from 'node:assert/strict';
import {LIFT} from '../src/course.js';
import {steppedLiftHeight,ratchetStage,RATCHET_STEPS,RATCHET_DUTY} from '../src/ratchet.js';

test('ratchet motor has twelve rises with zero-velocity dwell and no position jump',()=>{
  assert.equal(RATCHET_STEPS,12);
  const slot=LIFT.rise/RATCHET_STEPS,increment=(LIFT.top-LIFT.bottom)/RATCHET_STEPS;
  for(let i=0;i<RATCHET_STEPS;i++){
    const start=LIFT.bottomDwell+i*slot;
    const riseEnd=start+slot*RATCHET_DUTY;
    const middleOfHold=riseEnd+(slot*(1-RATCHET_DUTY))/2;
    assert.ok(Math.abs(steppedLiftHeight(start)-(LIFT.bottom+i*increment))<1e-8);
    assert.ok(Math.abs(steppedLiftHeight(riseEnd)-(LIFT.bottom+(i+1)*increment))<1e-8);
    assert.ok(Math.abs(steppedLiftHeight(middleOfHold)-steppedLiftHeight(riseEnd))<1e-8);
    assert.equal(ratchetStage(middleOfHold).moving,false);
  }
  const dt=1/120,total=LIFT.bottomDwell+LIFT.rise+LIFT.topDwell+LIFT.return;
  let peakDelta=0;
  for(let t=0;t<total-dt;t+=dt){
    const a=steppedLiftHeight(t),b=steppedLiftHeight(t+dt);
    peakDelta=Math.max(peakDelta,Math.abs(b-a));
    assert.ok(a>=LIFT.bottom-1e-6&&a<=LIFT.top+1e-6);
  }
  assert.ok(peakDelta<.04,`kinematic shelf motion too abrupt: ${peakDelta}`);
  assert.ok(Math.abs(steppedLiftHeight(1.4)-steppedLiftHeight(1.4+total))<1e-8);
  console.log(JSON.stringify({steps:RATCHET_STEPS,peakPositionDelta:peakDelta}));
});
